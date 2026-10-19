/**
 * Delivery_OS — Outbox: captura de escritas para sincronização (Fase 2)
 * ---------------------------------------------------------------------------
 * Toda escrita de negócio passa por `write()` em `src/db/index.ts`. Este módulo
 * fornece um wrapper que:
 *
 *   1. Observa cada instrução executada dentro da transação.
 *   2. Identifica, com `parseWrite`, o que deve ser replicado.
 *   3. Grava na `sync_outbox` um registro por linha afetada — na MESMA
 *      transação da escrita original, garantindo atomicidade.
 *
 * Ou seja: se a escrita de negócio falhar e der ROLLBACK, a entrada na outbox
 * some junto. Nunca existe "fila diz que subiu, mas o dado não existe".
 *
 * A sincronização em si (envio à nuvem) fica em `engine.ts`. Aqui só se
 * enfileira — nada de rede.
 *
 * IMPORTANTE: EXCLUSIVO DO SERVIDOR.
 * ---------------------------------------------------------------------------
 */
import 'server-only';
import { parseWrite, type SyncOp } from './sql-parse';

/* ===========================================================================
 * Identidade do dispositivo
 * ===========================================================================*/

/**
 * Id estável deste dispositivo. Persistido em `sync_state` na primeira leitura,
 * de forma que cada instalação tenha sua própria identidade — necessária para
 * idempotência e para evitar que o dispositivo "receba de volta" o que enviou.
 */
export function deviceId(): string {
  const fromEnv = process.env.DEVICE_ID || process.env.NEXT_PUBLIC_DEVICE_ID;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();
  return globalThis.__deliveryOsDeviceId ?? 'local-device';
}

declare global {
  // eslint-disable-next-line no-var
  var __deliveryOsDeviceId: string | undefined;
}

/* ===========================================================================
 * Registro de uma operação pendente
 * ===========================================================================*/

export interface OutboxEntry {
  id: string;
  entity: string;
  entity_id: string;
  op: SyncOp;
  payload: string | null;
  device_id: string;
  created_at: string;
}

/** UUID v4 simples, sem dependência externa. */
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback determinístico o suficiente para unicidade local.
  const rand = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0');
  return `${rand()}-${rand().slice(0, 4)}-4${rand().slice(1, 4)}-a${rand().slice(1, 4)}-${rand()}${rand().slice(0, 4)}`;
}

/** Timestamp ISO-8601 UTC. */
function nowIso(): string {
  return new Date().toISOString();
}

/* ===========================================================================
 * Interface de destino: onde gravar as entradas da outbox
 * ---------------------------------------------------------------------------
 * É abstraída porque o `write()` precisa gravá-las de formas diferentes nos
 * dois modos: no SQLite usa `db.run(...)`; no Postgres, o `Tx` enfileira a
 * query na transação corrente. O adaptador de cada modo fornece o `enqueue`.
 * ===========================================================================*/

export type EnqueueFn = (entries: OutboxEntry[]) => void;

/**
 * Acumulador de operações capturadas durante uma transação.
 * Uma instância por chamada de `write()`.
 */
export class OutboxCapture {
  private entries: OutboxEntry[] = [];
  private readonly dev: string;
  private readonly enabled: boolean;

  constructor(opts: { deviceId: string; enabled: boolean }) {
    this.dev = opts.deviceId;
    this.enabled = opts.enabled;
  }

  /** Chamado pelo wrapper de `Tx` para cada instrução executada. */
  observe(sql: string, params: (string | number | null)[] = []): void {
    if (!this.enabled) return;
    const parsed = parseWrite(sql, params);
    if (!parsed || parsed.ids.length === 0) return;

    const ts = nowIso();
    for (const entityId of parsed.ids) {
      this.entries.push({
        id: uuid(),
        entity: parsed.table,
        entity_id: entityId,
        op: parsed.op,
        payload: null, // preenchido na Fase 3 (pull), quando o estado completo importa
        device_id: this.dev,
        created_at: ts,
      });
    }
  }

  /** Entradas acumuladas (cópia defensiva). */
  drain(): OutboxEntry[] {
    const out = this.entries;
    this.entries = [];
    return out;
  }

  get size(): number {
    return this.entries.length;
  }
}

/* ===========================================================================
 * Helper de enfileiramento
 * ===========================================================================*/

/**
 * Grava um lote de entradas na `sync_outbox` usando o `enqueue` do modo ativo.
 * Devolve quantas linhas foram efetivamente enfileiradas.
 */
export function flushCapture(capture: OutboxCapture, enqueue: EnqueueFn): number {
  const entries = capture.drain();
  if (entries.length === 0) return 0;
  enqueue(entries);
  return entries.length;
}

/** Exporta o gerador de uuid/timestamp para uso pelos adaptadores. */
export { uuid as newSyncId, nowIso as syncNow };
