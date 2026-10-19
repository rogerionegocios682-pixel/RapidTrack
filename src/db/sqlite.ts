/**
 * Delivery_OS — Backend SQLite local (fallback offline / sem Supabase)
 * ---------------------------------------------------------------------------
 * Quando NÃO há `DATABASE_URL` configurada, o sistema usa este módulo para
 * operar com o banco SQLite local (`data/delivery_os.db`, via `sql.js`).
 *
 * Isso garante que o sistema continue acessível mesmo sem o Postgres/Supabase,
 * preservando integralmente os dados já existentes no arquivo local.
 *
 * A API pública espelha a de `src/db/index.ts` (query/queryOne/write/execute/…),
 * então os repositórios e as Server Actions não precisam saber qual banco está
 * ativo. A escolha é feita em `src/db/index.ts`.
 *
 * IMPORTANTE: este módulo é EXCLUSIVO DO SERVIDOR (usa `node:fs`).
 */
import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database, type SqlValue } from 'sql.js';

/* ===========================================================================
 * Estado do singleton (sobrevive ao hot-reload do Next.js via globalThis)
 * ===========================================================================*/

interface SqliteState {
  db: Database;
  file: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __deliveryOsSqlite: SqliteState | undefined;
  // eslint-disable-next-line no-var
  var __deliveryOsSqliteInit: Promise<SqliteState> | undefined;
  // eslint-disable-next-line no-var
  var __deliveryOsSqliteWriteChain: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __deliveryOsSqliteSubscribers: Set<() => void> | undefined;
  // eslint-disable-next-line no-var
  var __deliveryOsSqlitePendingPersist: ReturnType<typeof setTimeout> | undefined;
  // eslint-disable-next-line no-var
  var __deliveryOsShutdownHooked: boolean | undefined;
}

/**
 * Intervalo de coalescência da persistência em disco.
 * -------------------------------------------------------------------------
 * Gravar o banco inteiro a CADA escrita custa caro (exportar + escrever o
 * arquivo inteiro) e é o principal gargalo de tempo de resposta das ações.
 * Aqui as escritas são agrupadas numa pequena janela: várias operações
 * próximas geram uma única gravação, sem perder durabilidade percebida —
 * uma gravação é sempre agendada e acontece logo depois do último write.
 */
const PERSIST_DEBOUNCE_MS = Number(process.env.SQLITE_PERSIST_DEBOUNCE_MS ?? 120);

/** Caminho do arquivo SQLite. Respeita DATA_DIR (volumes de deploy). */
function dbFilePath(): string {
  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(process.cwd(), 'data');
  return path.join(dataDir, 'delivery_os.db');
}

/** Carrega o schema SQLite (idempotente) quando o arquivo ainda não existe. */
function schemaText(): string {
  const file = path.join(process.cwd(), 'src', 'db', 'schema.sql');
  return fs.readFileSync(file, 'utf8');
}

/**
 * Aplica as migrations de sincronização (Fase 1) de forma idempotente.
 * -------------------------------------------------------------------------
 * O SQLite não suporta `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`: se a coluna
 * já existe, ele lança "duplicate column name". Por isso cada instrução é
 * executada individualmente e esse erro específico é ignorado — assim o mesmo
 * arquivo pode rodar em bancos novos e em bancos já migrados sem quebrar.
 */
function applyMigrations(db: Database): void {
  const file = path.join(process.cwd(), 'db', 'migrations', '001_sync.sql');
  if (!fs.existsSync(file)) return; // ambiente sem o arquivo: nada a fazer

  const sql = fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  for (const stmt of sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)) {
    try {
      db.run(stmt);
    } catch (err) {
      const msg = String((err as Error)?.message || '').toLowerCase();
      if (msg.includes('duplicate column') || msg.includes('already exists')) continue;
      throw err;
    }
  }
}

/** Inicializa (uma única vez) o banco SQLite em memória a partir do arquivo. */
async function init(): Promise<SqliteState> {
  if (globalThis.__deliveryOsSqlite) return globalThis.__deliveryOsSqlite;
  if (globalThis.__deliveryOsSqliteInit) return globalThis.__deliveryOsSqliteInit;

  globalThis.__deliveryOsSqliteInit = (async () => {
    const file = dbFilePath();
    const SQL = await initSqlJs({
      locateFile: (f: string) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', f),
    });

    let db: Database;
    let needsPersist = false;
    if (fs.existsSync(file)) {
      db = new SQL.Database(new Uint8Array(fs.readFileSync(file)));
    } else {
      // Primeira execução: cria o arquivo já com o schema.
      fs.mkdirSync(path.dirname(file), { recursive: true });
      db = new SQL.Database();
      db.run(schemaText());
      needsPersist = true;
    }

    // O sql.js inicia com as chaves estrangeiras DESLIGADAS por conexão (o
    // PRAGMA não é persistido no arquivo). Sem isto, ON DELETE CASCADE e
    // ON DELETE RESTRICT não funcionariam: excluir uma empresa deixaria
    // vínculos de bairro e taxas órfãos no banco. Precisa ser ligado em toda
    // inicialização, antes de qualquer escrita.
    db.run('PRAGMA foreign_keys = ON');

    // Garante as estruturas de sincronização (idempotente) em qualquer banco.
    applyMigrations(db);

    const state: SqliteState = { db, file };
    if (needsPersist) persist(state);
    globalThis.__deliveryOsSqlite = state;

    // Garante que uma gravação pendente (coalescida) seja executada antes do
    // processo encerrar — evita perda de dados em SIGINT/SIGTERM.
    registerShutdownFlush(state);

    return state;
  })();

  return globalThis.__deliveryOsSqliteInit;
}

/**
 * Garante a gravação pendente no encerramento do processo.
 * Só é registrado uma vez (via flag global) para não acumular listeners.
 */
function registerShutdownFlush(state: SqliteState): void {
  if (globalThis.__deliveryOsShutdownHooked) return;
  globalThis.__deliveryOsShutdownHooked = true;
  const onExit = () => {
    try {
      if (globalThis.__deliveryOsSqlitePendingPersist) {
        clearTimeout(globalThis.__deliveryOsSqlitePendingPersist);
        globalThis.__deliveryOsSqlitePendingPersist = undefined;
      }
      if (globalThis.__deliveryOsSqlite?.db === state.db) persistNow(state);
    } catch {
      /* melhor esforço: não pode lançar durante o encerramento */
    }
  };
  process.once('exit', onExit);
  process.once('SIGINT', () => {
    onExit();
    process.exit(130);
  });
  process.once('SIGTERM', () => {
    onExit();
    process.exit(143);
  });
}

/** Grava o banco em disco agora (atômico via arquivo temporário). */
function persistNow(state: SqliteState): void {
  const data = state.db.export();
  const tmp = `${state.file}.tmp`;
  fs.writeFileSync(tmp, Buffer.from(data));
  fs.renameSync(tmp, state.file);
}

/**
 * Grava o banco em disco de forma ASSÍNCRONA (não bloqueia o event loop).
 * -------------------------------------------------------------------------
 * `db.export()` é síncrono e serializa o banco inteiro; se a escrita em disco
 * for feita com `writeFileSync`, o processo fica travado até terminar — foi o
 * que deixava o sistema lento. Aqui a parte de I/O roda no threadpool do Node,
 * liberando o servidor para atender outras requisições em paralelo.
 *
 * A escrita é atômica (arquivo temporário + rename) e nunca lança para quem
 * chamou: em caso de falha de I/O, apenas reporta no console.
 */
function persistNowAsync(state: SqliteState): void {
  let data: Uint8Array;
  try {
    data = state.db.export();
  } catch {
    return; // banco já fechado
  }
  const tmp = `${state.file}.tmp`;
  fs.writeFile(tmp, Buffer.from(data), (err) => {
    if (err) {
      console.error('[sqlite] falha ao gravar o banco:', err.message);
      return;
    }
    fs.rename(tmp, state.file, (renameErr) => {
      if (renameErr) console.error('[sqlite] falha ao trocar o arquivo:', renameErr.message);
    });
  });
}

/**
 * Persiste o banco em disco de forma agrupada (coalescing).
 * -------------------------------------------------------------------------
 * Antes, cada escrita chamava `persist()` de forma síncrona. Como o arquivo é
 * reescrito por inteiro, cadastros e mudanças de status ficavam lentos. Agora
 * as escritas próximas compartilham uma única gravação; a durabilidade é
 * garantida porque a gravação pendente é sempre executada (e pode ser forçada
 * com `flush()`), inclusive ao fechar o banco.
 */
function persist(state: SqliteState): void {
  if (PERSIST_DEBOUNCE_MS <= 0) {
    persistNow(state);
    return;
  }
  if (globalThis.__deliveryOsSqlitePendingPersist) return;

  const pending = setTimeout(() => {
    globalThis.__deliveryOsSqlitePendingPersist = undefined;
    if (globalThis.__deliveryOsSqlite?.db === state.db) persistNowAsync(state);
  }, PERSIST_DEBOUNCE_MS);

  // Não mantém o processo vivo apenas por causa da gravação pendente.
  if (typeof pending === 'object' && pending !== null && 'unref' in pending) {
    (pending as { unref: () => void }).unref();
  }
  globalThis.__deliveryOsSqlitePendingPersist = pending;
}

/** Grava imediatamente qualquer persistência pendente (ex.: ao fechar o banco). */
export async function flush(): Promise<void> {
  if (globalThis.__deliveryOsSqlitePendingPersist) {
    clearTimeout(globalThis.__deliveryOsSqlitePendingPersist);
    globalThis.__deliveryOsSqlitePendingPersist = undefined;
  }
  const state = globalThis.__deliveryOsSqlite;
  if (state) persistNow(state);
}

/** Notifica os listeners de tempo real (SSE). */
function notify(): void {
  const subs = globalThis.__deliveryOsSqliteSubscribers;
  if (!subs) return;
  for (const fn of subs) {
    try {
      fn();
    } catch {
      /* listener já encerrado */
    }
  }
}

/* ===========================================================================
 * API pública (mesma assinatura do backend Postgres)
 * ===========================================================================*/

/** SELECT que devolve uma lista de objetos tipados. */
export async function query<T = Record<string, SqlValue>>(
  sql: string,
  params: SqlValue[] = [],
): Promise<T[]> {
  const { db } = await init();
  const stmt = db.prepare(sql);
  try {
    if (params.length) stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as unknown as T);
    return rows;
  } finally {
    stmt.free();
  }
}

/** SELECT de um único registro (ou null). */
export async function queryOne<T = Record<string, SqlValue>>(
  sql: string,
  params: SqlValue[] = [],
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length ? rows[0] : null;
}

/** Insere/atualiza/remove e devolve as linhas afetadas. */
export async function execute(
  sql: string,
  params: SqlValue[] = [],
): Promise<{ changes: number }> {
  const state = await init();
  const stmt = state.db.prepare(sql);
  try {
    if (params.length) stmt.bind(params);
    stmt.step();
  } finally {
    stmt.free();
  }
  const changes = state.db.getRowsModified();
  persist(state);
  notify();
  return { changes };
}

/** Interface de transação compatível com o `db` do sql.js. */
export interface SqliteTx {
  exec(sql: string): { columns: string[]; values: SqlValue[][] }[];
  run(sql: string): void;
}

/**
 * Executa um bloco de escritas numa transação real e notifica os listeners.
 * Serializa as escritas (um mutex simples) para evitar intercalação.
 */
export async function write(
  fn: (db: SqliteTx) => void,
  opts: { notify?: boolean } = {},
): Promise<void> {
  const state = await init();

  const previous = globalThis.__deliveryOsSqliteWriteChain ?? Promise.resolve();
  let release!: () => void;
  globalThis.__deliveryOsSqliteWriteChain = new Promise((res) => (release = res));
  await previous;

  try {
    state.db.run('BEGIN');
    try {
      fn(state.db as unknown as SqliteTx);
      state.db.run('COMMIT');
    } catch (err) {
      try {
        state.db.run('ROLLBACK');
      } catch {
        /* transação já encerrada */
      }
      throw err;
    }
    persist(state);
    if (opts.notify !== false) notify();
  } finally {
    release();
  }
}

/** Executa uma instrução com valores já escapados (compatibilidade sql.js). */
export function runSql(db: SqliteTx, sql: string): void {
  db.exec(sql);
}

/** Assina mudanças do banco para transmissão em tempo real (SSE). */
export async function subscribe(listener: () => void): Promise<() => void> {
  if (!globalThis.__deliveryOsSqliteSubscribers) {
    globalThis.__deliveryOsSqliteSubscribers = new Set();
  }
  const subs = globalThis.__deliveryOsSqliteSubscribers;
  subs.add(listener);
  return () => subs.delete(listener);
}

/** Executa o texto de um arquivo .sql (DDL). */
export async function runSchema(sqlText: string): Promise<void> {
  const state = await init();
  state.db.run(sqlText);
  persist(state);
}

/** Fecha o banco (usado por scripts e testes). Grava pendências antes de fechar. */
export async function closeSqlite(): Promise<void> {
  if (globalThis.__deliveryOsSqlite) {
    await flush();
    globalThis.__deliveryOsSqlite.db.close();
    globalThis.__deliveryOsSqlite = undefined;
    globalThis.__deliveryOsSqliteInit = undefined;
  }
}

export type { SqlValue };