const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const initSqlJs = require('sql.js');

const appRoot = fs.existsSync(path.join(__dirname, 'src', 'db', 'schema.sql'))
  ? __dirname
  : path.resolve(__dirname, '..');
const dataDir = path.resolve(process.env.DATA_DIR || path.join(appRoot, 'data'));
const dbFile = path.join(dataDir, 'delivery_os.db');
const credentialsFile = path.join(path.dirname(dataDir), 'initial-admin.txt');
const schemaFile = path.join(appRoot, 'src', 'db', 'schema.sql');
const migrationFile = path.join(appRoot, 'db', 'migrations', '001_sync.sql');
const scrypt = { N: 16384, r: 8, p: 1 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, {
    N: scrypt.N,
    r: scrypt.r,
    p: scrypt.p,
    maxmem: 64 * 1024 * 1024,
  });
  return ['scrypt', scrypt.N, scrypt.r, scrypt.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

function applyMigration(db, file) {
  const statements = fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    try {
      db.run(statement);
    } catch (error) {
      const message = String(error?.message || '').toLowerCase();
      if (message.includes('duplicate column') || message.includes('already exists')) continue;
      throw error;
    }
  }
}

async function main() {
  if (!fs.existsSync(schemaFile) || !fs.existsSync(migrationFile)) {
    throw new Error('Arquivos do esquema SQLite ausentes na instalação.');
  }

  fs.mkdirSync(dataDir, { recursive: true });
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(appRoot, 'node_modules', 'sql.js', 'dist', file),
  });
  const db = fs.existsSync(dbFile)
    ? new SQL.Database(new Uint8Array(fs.readFileSync(dbFile)))
    : new SQL.Database();

  try {
    db.run(fs.readFileSync(schemaFile, 'utf8'));
    applyMigration(db, migrationFile);

    const row = db.exec('SELECT COUNT(*) FROM users')[0]?.values[0]?.[0];
    if (Number(row || 0) === 0) {
      const email = 'admin@deliveryos.local';
      const password = crypto.randomBytes(18).toString('base64url');
      const now = new Date().toISOString();
      const stmt = db.prepare(
        `INSERT INTO users
          (id, name, email, password_hash, role, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'admin', 'active', ?, ?)`,
      );
      try {
        stmt.run([crypto.randomUUID(), 'Administrador', email, hashPassword(password), now, now]);
      } finally {
        stmt.free();
      }

      fs.writeFileSync(
        credentialsFile,
        [
          'Acesso inicial do Delivery OS',
          '',
          `E-mail: ${email}`,
          `Senha temporária: ${password}`,
          '',
          'Entre no sistema e altere a senha assim que possível.',
          'Apague este arquivo depois de guardar a nova senha em local seguro.',
          '',
        ].join('\r\n'),
        { mode: 0o600 },
      );
      console.log(`Primeiro acesso criado. Consulte: ${credentialsFile}`);
    }

    const temporaryFile = `${dbFile}.tmp`;
    fs.writeFileSync(temporaryFile, Buffer.from(db.export()));
    fs.renameSync(temporaryFile, dbFile);
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(`[delivery-os] Falha ao preparar o banco local: ${error.message}`);
  process.exitCode = 1;
});
