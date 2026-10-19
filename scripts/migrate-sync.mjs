/**
 * Delivery_OS — Runner de migrations de sincronização
 * ---------------------------------------------------------------------------
 * FASE 1 da arquitetura local-first.
 *
 * Aplica `db/migrations/*.sql` de forma IDEMPOTENTE, tanto no SQLite local
 * quanto no Postgres/Supabase. É seguro rodar múltiplas vezes: cada instrução
 * já é escrita com `IF NOT EXISTS` ou tem o erro tolerado.
 *
 * Por que existe: o SQLite NÃO suporta `ALTER TABLE ... ADD COLUMN IF NOT
 * EXISTS` — se a coluna já existe, ele lança "duplicate column name". Este
 * runner captura exatamente esse erro e segue adiante, tornando a migration
 * re-executável sem quebrar bancos já migrados.
 *
 * Uso:
 *   node scripts/migrate-sync.mjs        # aplica as migrations
 *   node scripts/migrate-sync.mjs --check # só verifica o estado atual
 * ---------------------------------------------------------------------------
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(ROOT, 'db', 'migrations');

const CONNECTION_STRING = process.env.DATABASE_URL || process.env.DIRECT_URL || '';
const MODE = CONNECTION_STRING ? 'postgres' : 'sqlite';

/** Erros de SQLite que significam "já aplicado" e devem ser ignorados. */
function isBenignSqliteError(message) {
  const m = String(message).toLowerCase();
  return (
    m.includes('duplicate column name') ||
    m.includes('already exists') ||
    m.includes('duplicate column')
  );
}

/* ===========================================================================
 * SQLite — usa o mesmo singleton de src/db/sqlite.ts (via sql.js)
 * ===========================================================================*/
async function migrateSqlite() {
  const initSqlJs = (await import('sql.js')).default;
  const dataDir = process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.join(ROOT, 'data');
  const file = path.join(dataDir, 'delivery_os.db');

  const SQL = await initSqlJs({
    locateFile: (f) => path.join(ROOT, 'node_modules', 'sql.js', 'dist', f),
  });

  fs.mkdirSync(dataDir, { recursive: true });

  let db;
  if (fs.existsSync(file)) {
    db = new SQL.Database(new Uint8Array(fs.readFileSync(file)));
    console.log(`[sqlite] banco existente carregado: ${file}`);
  } else {
    db = new SQL.Database();
    const schema = fs.readFileSync(path.join(ROOT, 'src', 'db', 'schema.sql'), 'utf8');
    db.run(schema);
    console.log('[sqlite] banco novo criado com o schema base.');
  }

  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, '001_sync.sql'), 'utf8');

  // Divide em instruções: o sql.js executa uma por vez. Remove comentários
  // de linha antes de separar por ';' para não partir dentro de um comentário.
  const stripped = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');

  const statements = stripped
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);

  let applied = 0;
  let skipped = 0;
  for (const stmt of statements) {
    try {
      db.run(stmt);
      applied++;
    } catch (err) {
      if (isBenignSqliteError(err?.message)) {
        skipped++;
        continue;
      }
      throw err;
    }
  }

  // Persiste de forma atômica (tmp + rename), igual ao sqlite.ts.
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, Buffer.from(db.export()));
  fs.renameSync(tmp, file);

  db.close();
  console.log(`[sqlite] migration 001_sync aplicada (${applied} instruções, ${skipped} já existentes).`);
}

/* ===========================================================================
 * Postgres — usa o mesmo `pg` do projeto
 * ===========================================================================*/
async function migratePostgres() {
  const { default: pg } = await import('pg');
  const ssl = /supabase\.(co|com)/i.test(CONNECTION_STRING)
    ? { rejectUnauthorized: false }
    : false;

  const pool = new pg.Pool({ connectionString: CONNECTION_STRING, ssl });
  const client = await pool.connect();
  try {
    const files = ['001_sync.postgres.sql', '002_sync_server.postgres.sql'];
    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query(sql);
      console.log(`[postgres] migration ${file} aplicada com sucesso.`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

/* ===========================================================================
 * Verificação do estado atual
 * ===========================================================================*/
async function checkSqlite() {
  const initSqlJs = (await import('sql.js')).default;
  const file = path.join(
    process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, 'data'),
    'delivery_os.db',
  );
  if (!fs.existsSync(file)) {
    console.log('[check] Nenhum banco SQLite encontrado.');
    return;
  }
  const SQL = await initSqlJs({
    locateFile: (f) => path.join(ROOT, 'node_modules', 'sql.js', 'dist', f),
  });
  const db = new SQL.Database(new Uint8Array(fs.readFileSync(file)));

  const tables = db
    .exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")[0]
    ?.values.flat() ?? [];
  const hasOutbox = tables.includes('sync_outbox');
  const hasState = tables.includes('sync_state');

  const cols = db.exec('PRAGMA table_info(users)')[0]?.values ?? [];
  const names = cols.map((c) => c[1]);

  console.log('[check] Tabelas de sync:');
  console.log(`  sync_outbox: ${hasOutbox ? 'OK' : 'AUSENTE'}`);
  console.log(`  sync_state : ${hasState ? 'OK' : 'AUSENTE'}`);
  console.log(`[check] users.rev=${names.includes('rev')} deleted_at=${names.includes('deleted_at')} origin_device=${names.includes('origin_device')}`);

  const version = db
    .exec("SELECT value FROM app_meta WHERE key='schema_version'")[0]
    ?.values?.[0]?.[0];
  console.log(`[check] schema_version = ${version ?? 'não definida'}`);

  db.close();
}

/* ===========================================================================
 * Ponto de entrada
 * ===========================================================================*/
const isCheck = process.argv.includes('--check');

try {
  console.log(`[migrate-sync] modo do banco: ${MODE}`);
  if (isCheck) {
    if (MODE === 'sqlite') await checkSqlite();
    else console.log('[check] Verificação automática só disponível no modo SQLite.');
  } else if (MODE === 'sqlite') {
    await migrateSqlite();
  } else {
    await migratePostgres();
  }
  process.exit(0);
} catch (err) {
  console.error('[migrate-sync] FALHOU:', err?.message || err);
  process.exit(1);
}
