/**
 * Redefine a senha do administrador para um valor temporário de QA,
 * guardando o hash original para restauração posterior.
 *
 * Uso:
 *   node scripts/qa-set-password.mjs set   -> salva o hash e troca por QA_TEMP
 *   node scripts/qa-set-password.mjs restore -> restaura o hash salvo
 */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, scryptSync } from 'node:crypto';
import initSqlJs from 'sql.js';

const DB = path.join(process.cwd(), 'data', 'delivery_os.db');
const BACKUP = path.join(process.cwd(), 'scripts', '.qa-password-backup.json');
const QA_PASSWORD = 'QaTeste@2026';
const EMAIL = 'rogerionegocios682@gmail.com';

const SCRYPT = { N: 16384, r: 8, p: 1 };
function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

const SQL = await initSqlJs({
  locateFile: (f) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', f),
});
const db = new SQL.Database(new Uint8Array(fs.readFileSync(DB)));
const mode = process.argv[2];

if (mode === 'set') {
  const r = db.exec(`SELECT password_hash FROM users WHERE email = '${EMAIL}'`);
  const original = r[0].values[0][0];
  fs.writeFileSync(BACKUP, JSON.stringify({ email: EMAIL, password_hash: original }, null, 2));
  db.run('UPDATE users SET password_hash = ? WHERE email = ?', [hashPassword(QA_PASSWORD), EMAIL]);
  fs.writeFileSync(DB, Buffer.from(db.export()));
  console.log('Senha temporária definida. Hash original salvo em scripts/.qa-password-backup.json');
  console.log('Senha de QA:', QA_PASSWORD);
} else if (mode === 'restore') {
  if (!fs.existsSync(BACKUP)) {
    console.error('Backup não encontrado — nada a restaurar.');
    process.exit(1);
  }
  const { email, password_hash } = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
  db.run('UPDATE users SET password_hash = ? WHERE email = ?', [password_hash, email]);
  fs.writeFileSync(DB, Buffer.from(db.export()));
  fs.unlinkSync(BACKUP);
  console.log('Hash de senha original restaurado e backup removido.');
} else {
  console.error('Use: set | restore');
  process.exit(1);
}