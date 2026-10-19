/**
 * Delivery_OS — Sync Engine: envio das operações pendentes (Fase 2)
 * ---------------------------------------------------------------------------
 * Lê a `sync_outbox` local e envia os lotes ao servidor remoto, marcando cada
 * operação como sincronizada (`synced_at`) somente após confirmação.
 *
 * Garantias:
 *  - **Idempotência:** cada entrada tem `id` (UUID v4) próprio; o servidor
 *    ignora entradas cujo id já aplicou. Reenvio nunca duplica.
 *  - **Retry com backoff exponencial:** falha de rede não perde dado nem
 *    martela o servidor. `attempts`/`last_error` ficam registrados.
 *  - **Batch:** envia até `BATCH_SIZE` operações por requisição.
 *  - **Sem perda:** só marca `synced_at` após resposta 2xx do servidor.
 *
 * Não existe neste arquivo nenhum acesso direto ao banco: as operações de
 * leitura/marcação chegam via callbacks (`deps`), para que o mesmo engine
 * sirva ao modo SQLite e ao modo Postgres.
 *
 * IMPORTANTE: EXCLUSIVO DO SERVIDOR.
 * ---------------------------------------------------------------------------
 */
import 'server-only';
import type { SyncOp } from './sql-parse';

/* ===========================================================================
 * Tipos
 * ===========================================================================*/

/** Uma operação pendente, como lida da `sync_outbox`. */
export interface PendingOp {
  id: string;
  entity: string;
  entity_id: string;
  op: SyncOp;
  payload: string | null;
  device_id: string;
  created_at: string;
  attempts: number;
}

/** Resultado do processamento de um lote. */
export interface PushResult {
  sent: number;
  acked: number;
  failed: number;
  /** `true` quando a fila ficou vazia nesta rodada. */
  drained: boolean;
  /** Erro da última tentativa, quando houve falha. */
  error?: string;
  /** Próximo atraso sugerido (ms), quando ainda restam itens. */
  retryInMs?: number;
}

/** Dependências injetadas — desacopla o engine do banco. */
export interface SyncDeps {
  /** Lê até `limit` operações ainda não sincronizadas, mais antigas primeiro. */
  readPending(limit: number): Promise<PendingOp[]>;
  /** Marca operações como sincronizadas com sucesso. */
  markSynced(ids: string[]): Promise<void>;
  /** Registra uma tentativa que falhou (incrementa `attempts`, grava o erro). */
  markFailed(ids: string[], error: string): Promise<void>;
  /** Envia o lote ao servidor. Deve lançar em falha de rede/HTTP. */
  send(ops: PendingOp[]): Promise<{ accepted: string[] }>;
  /** Quantidade total de pendências (para saber se ainda há trabalho). */
  countPending(): Promise<number>;
}

/* ===========================================================================
 * Configuração
 * ===========================================================================*/

const BATCH_SIZE = Number(process.env.SYNC_BATCH_SIZE || 100);
const MAX_ATTEMPTS = Number(process.env.SYNC_MAX_ATTEMPTS || 10);
const BASE_DELAY_MS = Number(process.env.SYNC_BASE_DELAY_MS || 1_000);
const MAX_DELAY_MS = Number(process.env.SYNC_MAX_DELAY_MS || 5 * 60_000);

/**
 * Atraso do backoff exponencial com "jitter".
 * `attempts` = quantas tentativas já falharam para aquele item.
 * Após esgotar `MAX_ATTEMPTS`, o item fica com atraso máximo (não é descartado —
 * o dado continua na fila para inspeção manual).
 */
export function backoffDelay(attempts: number): number {
  const exp = Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1), MAX_DELAY_MS);
  // Jitter de ±20% evita sincronizar todos os dispositivos no mesmo instante.
  const jitter = exp * 0.2 * (Math.random() * 2 - 1);
  return Math.max(BASE_DELAY_MS, Math.round(exp + jitter));
}

/* ===========================================================================
 * Engine
 * ===========================================================================*/

/**
 * Executa UMA rodada de sincronização: lê um lote, envia, marca.
 *
 * Nunca lança por erro de rede — devolve `PushResult` com `error` preenchido.
 * Isso é deliberado: uma falha de sincronização não pode derrubar a operação
 * do sistema (o motoboy continua trabalhando offline).
 */
export async function pushOnce(deps: SyncDeps): Promise<PushResult> {
  const pending = await deps.readPending(BATCH_SIZE);

  if (pending.length === 0) {
    return { sent: 0, acked: 0, failed: 0, drained: true };
  }

  // Itens que já estouraram o limite de tentativas ficam de fora desta rodada,
  // mas permanecem na fila (não são perdidos nem reprocessados em loop).
  const eligible = pending.filter((op) => op.attempts < MAX_ATTEMPTS);
  if (eligible.length === 0) {
    const maxAttempts = Math.max(...pending.map((o) => o.attempts));
    return {
      sent: 0,
      acked: 0,
      failed: pending.length,
      drained: false,
      error: `Todas as ${pending.length} operações pendentes excederam ${MAX_ATTEMPTS} tentativas.`,
      retryInMs: backoffDelay(maxAttempts),
    };
  }

  try {
    const { accepted } = await deps.send(eligible);

    // O servidor pode aceitar parcialmente (ex.: conflito em algumas linhas).
    // Só marcamos como sincronizado o que ele confirmou.
    const ackedIds = eligible.filter((op) => accepted.includes(op.id)).map((op) => op.id);
    const rejected = eligible.filter((op) => !accepted.includes(op.id));

    if (ackedIds.length) await deps.markSynced(ackedIds);
    if (rejected.length) {
      await deps.markFailed(
        rejected.map((op) => op.id),
        'Servidor não confirmou a operação.',
      );
    }

    const stillPending = await deps.countPending();
    const result: PushResult = {
      sent: eligible.length,
      acked: ackedIds.length,
      failed: rejected.length,
      drained: stillPending === 0,
    };
    if (stillPending > 0) result.retryInMs = backoffDelay(1);
    return result;
  } catch (err) {
    const message = (err as Error)?.message || 'Falha desconhecida na sincronização.';
    await deps.markFailed(
      eligible.map((op) => op.id),
      message.slice(0, 500),
    );
    const maxAttempts = Math.max(...eligible.map((o) => o.attempts)) + 1;
    return {
      sent: eligible.length,
      acked: 0,
      failed: eligible.length,
      drained: false,
      error: message,
      retryInMs: backoffDelay(maxAttempts),
    };
  }
}

/**
 * Executa rodadas até drenar a fila, com um teto de segurança.
 * Usado quando se quer "empurrar tudo agora" (ex.: botão manual na UI).
 */
export async function pushAll(
  deps: SyncDeps,
  opts: { maxRounds?: number } = {},
): Promise<PushResult> {
  const maxRounds = opts.maxRounds ?? 50;
  const total: PushResult = { sent: 0, acked: 0, failed: 0, drained: false };

  for (let round = 0; round < maxRounds; round++) {
    const r = await pushOnce(deps);
    total.sent += r.sent;
    total.acked += r.acked;
    total.failed += r.failed;
    if (r.error) total.error = r.error;
    if (r.drained) {
      total.drained = true;
      break;
    }
    // Sem progresso nesta rodada: parar evita loop infinito.
    if (r.acked === 0 && r.sent === 0) break;
  }

  return total;
}

/* ===========================================================================
 * Estado legível para a UI
 * ===========================================================================*/

export interface SyncStatus {
  pending: number;
  failed: number;
  oldestPendingAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  enabled: boolean;
}

/** Monta o status a partir de dados já lidos (mantém o engine sem I/O). */
export function buildStatus(input: {
  pending: number;
  failed: number;
  oldestPendingAt?: string | null;
  lastSuccessAt?: string | null;
  lastError?: string | null;
  enabled: boolean;
}): SyncStatus {
  return {
    pending: input.pending,
    failed: input.failed,
    oldestPendingAt: input.oldestPendingAt ?? null,
    lastSuccessAt: input.lastSuccessAt ?? null,
    lastError: input.lastError ?? null,
    enabled: input.enabled,
  };
}

export { BATCH_SIZE, MAX_ATTEMPTS };
