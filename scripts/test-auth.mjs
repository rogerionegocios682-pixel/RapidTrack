// Testa a autenticação usando EXATAMENTE a lógica de src/lib/utils.ts (verifyPassword)
// contra os hashes do banco, para descobrir quais senhas funcionam.
import fs from 'node:fs';
import path from 'node:path';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import initSqlJs from 'sql.js';

function verifyPassword(password, stored) {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, n, r, p, saltB64, hashB64] = parts;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');
    const actual = scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

const SQL = await initSqlJs({
  locateFile: (f) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', f),
});
const db = new SQL.Database(new Uint8Array(fs.readFileSync('data/delivery_os.db')));
const r = db.exec('SELECT email, password_hash FROM users');
const rows = r[0].values;

const candidates = ['admin123', '123456', 'admin', 'delivery123', 'senha123', 'Admin@123', 'rogerio123', 'Rogerio@123', 'password'];
for (const [email, hash] of rows) {
  console.log(`\nUsuário: ${email}`);
  for (const pw of candidates) {
    if (verifyPassword(pw, hash)) console.log(`   >>> SENHA CORRETA: ${pw}`);
  }
}
console.log('\n(fim)');