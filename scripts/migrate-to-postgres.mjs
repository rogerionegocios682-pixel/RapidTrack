/**
 * Migração de dados: SQLite (data/delivery_os.db) -> Postgres (Supabase).
 * ---------------------------------------------------------------------------
 * Lê o arquivo SQLite local e copia TODAS as linhas para o Postgres, na ordem
 * que respeita as chaves estrangeiras. As tabelas de destino devem existir —
 * rode antes:  node scripts/seed.mjs --schema
 *
 * Uso:
 *   node scripts/migrate-to-postgres.mjs
 *   node scripts/migrate-to-postgres.mjs --truncate   (limpa o destino antes)
 *
 * É idempotente por natureza apenas com --truncate; sem ele, uma linha que já
 * exista (mesma PK) provoca erro de chave duplicada — o script aborta a tabela
 * e informa. Recomendado rodar com --truncate na primeira migração.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import pg from 'pg';

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');

const root = path.resolve(import.meta.dirname, '..');
const DB_FILE = path.join(root, 'data', 'delivery_os.db');
const truncate = process.argv.includes('--truncate');

/** Carrega variáveis de um .env simples (sem dependência externa). */
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
loadEnvFile(path.join(root, '.env.local'));
loadEnvFile(path.join(root, '.env'));

const CONNECTION_STRING = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
if (!CONNECTION_STRING) {
  console.error('[migrate] DATABASE_URL/DIRECT_URL não configurada.');
  process.exit(1);
}
const SSL = /supabase\.(co|com)/i.test(CONNECTION_STRING) || process.env.DATABASE_SSL === 'true'
  ? { rejectUnauthorized: false }
  : false;

// Ordem de inserção que respeita as FKs.
const TABLES = [
  'neighborhoods',
  'companies',
  'motoboys',
  'users',
  'password_resets',
  'company_neighborhoods',
  'delivery_fees',
  'deliveries',
  'delivery_status_history',
  'internal_messages',
  'audits',
  'app_meta',
];

async function main() {
  if (!fs.existsSync(DB_FILE)) {
    console.error(`[migrate] arquivo SQLite não encontrado: ${DB_FILE}`);
    process.exit(1);
  }

  const SQL = await initSqlJs({
    locateFile: (file) => path.join(root, 'node_modules', 'sql.js', 'dist', file),
  });
  const sqlite = new SQL.Database(new Uint8Array(fs.readFileSync(DB_FILE)));

  const client = new pg.Client({ connectionString: CONNECTION_STRING, ssl: SSL });
  await client.connect();
  console.log('[migrate] conectado ao Postgres.');

  // Um único bloco de transação para tudo — aborta tudo se algo falhar.
  await client.query('BEGIN');
  try {
    if (truncate) {
      // CASCADE + RESTART: limpa o destino respeitando dependências.
      const list = TABLES.map((t) => `"${t}"`).join(', ');
      await client.query(`TRUNCATE ${list} CASCADE`);
      console.log('[migrate] destino limpo (TRUNCATE ... CASCADE).');
    }

    for (const table of TABLES) {
      // Lê todas as linhas do SQLite.
      const res = sqlite.exec(`SELECT * FROM ${table}`);
      if (!res.length) {
        console.log(`[migrate] ${table}: tabela ausente no SQLite, pulando.`);
        continue;
      }
      const { columns, values } = res[0];
      if (values.length === 0) {
        console.log(`[migrate] ${table}: 0 linha(s).`);
        continue;
      }

      const colList = columns.map((c) => `"${c}"`).join(', ');
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const insert = `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`;

      let inserted = 0;
      for (const row of values) {
        const params = row.map((v) => (v === undefined ? null : v));
        await client.query(insert, params);
        inserted++;
      }
      console.log(`[migrate] ${table}: ${inserted} linha(s) migrada(s).`);
    }

    await client.query('COMMIT');
    console.log('[migrate] migração concluída com sucesso.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrate] erro — nada foi gravado (rollback):', err.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[migrate] erro:', err);
  process.exit(1);
});
