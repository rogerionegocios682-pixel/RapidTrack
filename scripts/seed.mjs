/**
 * Seed inicial do Delivery_OS (Postgres / Supabase).
 * ---------------------------------------------------------------------------
 * Cria o esquema (db/schema.postgres.sql) e o usuário Administrador padrão.
 *
 * IMPORTANTE: este script NÃO cria empresas, motoboys, bairros, taxas nem
 * corridas fictícias. Todos esses dados são cadastrados pelo usuário real
 * através do sistema, conforme a regra de não utilizar dados fictícios.
 *
 * Uso:
 *   node scripts/seed.mjs            (aplica o schema e cria o admin se vazio)
 *   node scripts/seed.mjs --force    (recria o administrador padrão)
 *   node scripts/seed.mjs --schema   (aplica SOMENTE o schema, sem seed)
 *
 * Requer DATABASE_URL (ou DIRECT_URL) no ambiente/.env.local.
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import pg from 'pg';

const root = path.resolve(import.meta.dirname, '..');
const SCHEMA_FILE = path.join(root, 'db', 'schema.postgres.sql');

const force = process.argv.includes('--force');
const schemaOnly = process.argv.includes('--schema');

/** Carrega variáveis de um .env simples (sem dependência externa). */
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.join(root, '.env.local'));
loadEnvFile(path.join(root, '.env'));

const CONNECTION_STRING = process.env.DATABASE_URL || process.env.DIRECT_URL || '';
if (!CONNECTION_STRING) {
  console.error('[seed] DATABASE_URL não configurada. Defina no .env.local.');
  process.exit(1);
}

const SSL =
  /supabase\.(co|com)/i.test(CONNECTION_STRING) || process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : false;

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@deliveryos.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'admin123';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'Administrador';

const SCRYPT = { N: 16384, r: 8, p: 1 };

/** Mesmo formato usado em src/lib/utils.ts: scrypt$N$r$p$salt$hash */
function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, SCRYPT);
  return [
    'scrypt',
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$');
}

async function main() {
  const client = new pg.Client({ connectionString: CONNECTION_STRING, ssl: SSL });
  await client.connect();
  console.log('[seed] conectado ao Postgres.');

  // 1. Aplica o schema (idempotente).
  await client.query(fs.readFileSync(SCHEMA_FILE, 'utf8'));
  console.log('[seed] schema aplicado (CREATE TABLE IF NOT EXISTS).');

  if (schemaOnly) {
    await client.end();
    console.log('[seed] --schema: encerrando sem seed.');
    return;
  }

  const now = new Date().toISOString();
  const { rows } = await client.query('SELECT COUNT(*)::int AS n FROM users');
  const total = Number(rows[0]?.n ?? 0);

  if (total > 0 && !force) {
    console.log(`[seed] banco já possui ${total} usuário(s). Nada a fazer.`);
  } else {
    const id = randomUUID();
    await client.query('BEGIN');
    try {
      await client.query('DELETE FROM users WHERE LOWER(email) = LOWER($1)', [ADMIN_EMAIL]);
      await client.query(
        `INSERT INTO users
           (id, name, email, phone, password_hash, role, status, motoboy_id, last_login_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,'admin','active',NULL,NULL,$6,$6)`,
        [id, ADMIN_NAME, ADMIN_EMAIL, null, hashPassword(ADMIN_PASSWORD), now],
      );
      await client.query(
        `INSERT INTO audits
           (id, user_id, user_name, action, entity, entity_id, description, metadata, created_at)
         VALUES ($1,$2,$3,'create','user',$2,$4,NULL,$5)`,
        [randomUUID(), id, ADMIN_NAME, 'Usuário administrador inicial criado pelo seed', now],
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    }

    console.log('[seed] administrador criado com sucesso:');
    console.log(`[seed]   e-mail : ${ADMIN_EMAIL}`);
    console.log(`[seed]   senha  : ${ADMIN_PASSWORD}`);
    console.log('[seed] Troque a senha em "Meu Perfil" após o primeiro acesso.');
  }

  // 2. Versão do esquema (upsert).
  await client.query(
    `INSERT INTO app_meta (key, value, updated_at) VALUES ('schema_version', '1', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    [now],
  );

  await client.end();
  console.log('[seed] concluído.');
}

main().catch((err) => {
  console.error('[seed] erro:', err);
  process.exit(1);
});

