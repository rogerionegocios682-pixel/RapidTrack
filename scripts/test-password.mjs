import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import initSqlJs from 'sql.js';

const SQL = await initSqlJs({
  locateFile: (f) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', f),
});
const db = new SQL.Database(new Uint8Array(fs.readFileSync('data/delivery_os.db')));
const r = db.exec("SELECT password_hash FROM users WHERE email='rogerionegocios682@gmail.com'");
const ph = r[0].values[0][0];
const parts = ph.split('$');
const N = +parts[1], rr = +parts[2], p = +parts[3];
const salt = Buffer.from(parts[4], 'base64');
const hash = Buffer.from(parts[5], 'base64');
const test = (pw) => crypto.scryptSync(pw, salt, hash.length, { N, r: rr, p }).equals(hash);
for (const pw of ['admin123', 'admin', '123456', 'delivery123', 'senha123', 'Admin@123', 'rogerio123']) {
  console.log(pw.padEnd(12), '->', test(pw));
}
