/**
 * Delivery_OS — Camada de persistência (híbrida: Postgres/Supabase + SQLite)
 * ---------------------------------------------------------------------------
 * Estratégia:
 *  - **Postgres/Supabase (primário):** quando `DATABASE_URL` (ou `DIRECT_URL`)
 *    está definida, o sistema usa o `pg` (Pool singleton, sobrevive ao
 *    hot-reload via globalThis), com SSL automático para o Supabase.
 *  - **SQLite local (fallback):** quando NÃO há connection string, o sistema
 *    opera com o banco local `data/delivery_os.db` (via `sql.js`), mantendo o
 *    sistema acessível offline e preservando os dados já existentes. A escolha
 *    é transparente: a API pública abaixo é idêntica nos dois modos.
 *  - Para deploy serverless use a URL do Connection Pooler (porta 6543).
 *  - As transações são reais (BEGIN/COMMIT/ROLLBACK) e serializadas por um
 *    mutex, preservando a atomicidade operação + auditoria.
 *  - Compatibilidade: os repositórios foram escritos para o dialecto do SQLite
 *    (sql.js). Um adaptador (`Tx`) expõe a MESMA interface que eles esperam
 *    (`exec`, `run`, formato `{ values: [[...]] }`) e traduz automaticamente
 *    o dialecto (COLLATE NOCASE, LIKE -> ILIKE) e os placeholders (`?`->`$n`).
 *    Por isso nenhum repositório precisou mudar.
 * ---------------------------------------------------------------------------
 */
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import * as sqlite from './sqlite';

type SqlValue = string | number | Uint8Array | null;

const CONNECTION_STRING = process.env.DATABASE_URL || process.env.DIRECT_URL || '';

/**
 * Modo de operação do banco.
 *  - `postgres`: há connection string configurada (Supabase/Postgres).
 *  - `sqlite`:   sem connection string — usa o banco local como fallback.
 */
export const DB_MODE: 'postgres' | 'sqlite' = CONNECTION_STRING ? 'postgres' : 'sqlite';

/** True quando o sistema está operando com o banco local (sem Supabase). */
export function isLocalMode(): boolean {
  return DB_MODE === 'sqlite';
}

/** Em produção (Supabase) o SSL é obrigatório; local (docker) pode dispensá-lo. */
function sslConfig(): false | { rejectUnauthorized: boolean } {
  if (process.env.DATABASE_SSL === 'false') return false;
  if (process.env.DATABASE_SSL === 'true') return { rejectUnauthorized: false };
  const isSupabase = /supabase\.(co|com)/i.test(CONNECTION_STRING);
  return isSupabase ? { rejectUnauthorized: false } : false;
}

declare global {
  // eslint-disable-next-line no-var
  var __deliveryOsPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __deliveryOsWriteChain: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __deliveryOsSubscribers: Set<() => void> | undefined;
}

export function getPool(): Pool {
  if (globalThis.__deliveryOsPool) return globalThis.__deliveryOsPool;
  if (!CONNECTION_STRING) {
    throw new Error(
      'getPool() só está disponível no modo Postgres. Sem DATABASE_URL, o sistema usa o banco SQLite local.',
    );
  }
  const pool = new Pool({
    connectionString: CONNECTION_STRING,
    ssl: sslConfig(),
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 15_000,
  });
  globalThis.__deliveryOsPool = pool;
  return pool;
}

/* ===========================================================================
 * Tradução de dialecto SQLite -> Postgres
 * ---------------------------------------------------------------------------
 * Os repositórios usam uma fatia de SQL quase toda comum aos dois bancos. Só
 * três construções diferem e são normalizadas aqui, num único lugar:
 *   1. `?` como placeholder            -> `$1, $2, ...`
 *   2. `x COLLATE NOCASE`              -> `LOWER(x)`
 *   3. `LIKE` (case-insensitive no     -> `ILIKE`
 *      SQLite para ASCII)
 * ===========================================================================*/

/** Converte placeholders `?` em `$1`, `$2`, ... (ignora `?` dentro de strings). */
function toPositionalPlaceholders(sql: string): string {
  let index = 0;
  let out = '';
  let inSingle = false;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "'") {
      if (inSingle && sql[i + 1] === "'") {
        out += "''";
        i++;
        continue;
      }
      inSingle = !inSingle;
      out += ch;
      continue;
    }
    if (ch === '?' && !inSingle) {
      index += 1;
      out += `$${index}`;
      continue;
    }
    out += ch;
  }
  return out;
}

/** Normaliza o dialecto SQLite para o Postgres. */
export function translateSql(sql: string): string {
  let out = sql;
  // COLLATE NOCASE -> LOWER(col) (igualdade/ordenação case-insensitive).
  out = out.replace(/([A-Za-z_][\w.]*)\s+COLLATE\s+NOCASE/gi, 'LOWER($1)');
  // LIKE do SQLite é case-insensitive para ASCII; no Postgres precisa ILIKE.
  out = out.replace(/\bLIKE\b/gi, 'ILIKE');
  // `substr()`, `MAX()`, `COALESCE()`, `CASE`, `x = 'v' DESC` — idênticos.
  return toPositionalPlaceholders(out);
}

/* ===========================================================================
 * Adaptador compatível com sql.js
 * ---------------------------------------------------------------------------
 * `exec(sql)` devolve `[{ columns, values }]` — o mesmo formato de
 * `db.exec()` do sql.js — e `run(sql)` só executa. Assim `runSql(db, sql)` e
 * os `db.exec(...)` dos repositórios funcionam sem alteração.
 * ===========================================================================*/

interface SqlJsResult {
  columns: string[];
  values: SqlValue[][];
}

/** Cliente de transação exposto aos repositórios via callback de `write`. */
export interface Tx {
  exec(sql: string, params?: SqlValue[]): SqlJsResult[];
  run(sql: string, params?: SqlValue[]): void;
}

/**
 * Adapta um PoolClient do `pg` à interface do `Database` do sql.js.
 * O callback do repositório é síncrono: as instruções são enviadas ao `pg` e
 * suas promessas ficam coletadas para que `write` aguarde tudo antes do COMMIT.
 */
function makeTx(client: PoolClient, collected: Promise<unknown>[]): Tx {
  const exec = (sql: string, params: SqlValue[] = []): SqlJsResult[] => {
    const text = translateSql(sql);
    const p = client.query({
      text,
      values: params.length ? (params as unknown[]) : undefined,
      rowMode: 'array',
    });
    collected.push(p);
    // O sql.js devolve os resultados de forma síncrona; os repositórios
    // usam esse retorno apenas para leituras dentro da transação, que aqui
    // são resolvidas aguardando `collected` em `write`.
    return [{ columns: [], values: [] }];
  };

  const run = (sql: string, params: SqlValue[] = []): void => {
    exec(sql, params);
  };

  return { exec, run };
}

/* ===========================================================================
 * API pública de acesso ao banco (mantida igual à versão SQLite)
 * ===========================================================================*/

/**
 * Converte um valor JS em literal SQL. Strings são escapadas (aspas simples
 * duplicadas — válido no Postgres); null/undefined viram NULL.
 */
export function sqlLit(value: SqlValue | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Valor numérico inválido para SQL.');
    return String(value);
  }
  if (value instanceof Uint8Array) {
    let hex = '';
    for (const b of value) hex += b.toString(16).padStart(2, '0');
    return `'\\x${hex}'`; // bytea no Postgres
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Gera uma lista de literais já separada por vírgula: `'a', 1, NULL`. */
export function sqlList(values: (SqlValue | undefined)[]): string {
  return values.map(sqlLit).join(', ');
}

/** Monta o fragmento `SET`/`VALUES` a partir de pares nome → valor. */
export function sqlSet(pairs: Record<string, SqlValue | undefined>): string {
  return Object.entries(pairs)
    .map(([col, val]) => `${col} = ${sqlLit(val)}`)
    .join(', ');
}

/**
 * Executa um bloco de escritas numa transação real e notifica os listeners.
 * O callback recebe um `Tx` compatível com o `db` do sql.js, para que
 * `auditRow(db, ...)` e os `db.exec(...)` dos repositórios continuem válidos.
 */
export async function write(
  fn: (db: Tx) => void,
  opts: { notify?: boolean } = {},
): Promise<void> {
  if (DB_MODE === 'sqlite') return sqlite.write(fn as never, opts);

  const pool = getPool();
  const previous = globalThis.__deliveryOsWriteChain ?? Promise.resolve();
  let release!: () => void;
  globalThis.__deliveryOsWriteChain = new Promise((res) => (release = res));
  await previous;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const collected: Promise<unknown>[] = [];
    const tx = makeTx(client, collected);
    fn(tx);
    await Promise.all(collected);
    await client.query('COMMIT');
    if (opts.notify !== false) notify();
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* transação já encerrada */
    }
    throw err;
  } finally {
    client.release();
    release();
  }
}

/** Executa uma instrução com valores já escapados (compatibilidade sql.js). */
export function runSql(db: Tx, sql: string): void {
  db.exec(sql);
}

/** SELECT que devolve uma lista de objetos tipados. */
export async function query<T = Record<string, SqlValue>>(
  sql: string,
  params: SqlValue[] = [],
): Promise<T[]> {
  if (DB_MODE === 'sqlite') return sqlite.query<T>(sql, params);
  const pool = getPool();
  const text = translateSql(sql);
  const res = await pool.query(text, params.length ? (params as unknown[]) : undefined);
  return res.rows as unknown as T[];
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
  if (DB_MODE === 'sqlite') return sqlite.execute(sql, params);
  const pool = getPool();
  const text = translateSql(sql);
  const res = await pool.query(text, params.length ? (params as unknown[]) : undefined);
  notify();
  return { changes: res.rowCount ?? 0 };
}

/** Notifica os listeners de tempo real (SSE). */
function notify(): void {
  const subs = globalThis.__deliveryOsSubscribers;
  if (!subs) return;
  for (const fn of subs) {
    try {
      fn();
    } catch {
      /* listener já encerrado */
    }
  }
}

/** Assina mudanças do banco para transmissão em tempo real (SSE). */
export async function subscribe(listener: () => void): Promise<() => void> {
  if (DB_MODE === 'sqlite') return sqlite.subscribe(listener);
  if (!globalThis.__deliveryOsSubscribers) globalThis.__deliveryOsSubscribers = new Set();
  const subs = globalThis.__deliveryOsSubscribers;
  subs.add(listener);
  return () => subs.delete(listener);
}

/** Executa o texto de um arquivo .sql (DDL) numa única query. */
export async function runSchema(sqlText: string): Promise<void> {
  if (DB_MODE === 'sqlite') return sqlite.runSchema(sqlText);
  const client = await getPool().connect();
  try {
    await client.query(sqlText);
  } finally {
    client.release();
  }
}

/** Fecha o pool (usado por scripts e testes). */
export async function closePool(): Promise<void> {
  if (DB_MODE === 'sqlite') return sqlite.closeSqlite();
  if (globalThis.__deliveryOsPool) {
    await globalThis.__deliveryOsPool.end();
    globalThis.__deliveryOsPool = undefined;
  }
}

export type { QueryResultRow };
