import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';

const SQL = await initSqlJs({
  locateFile: (f) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', f),
});
const db = new SQL.Database(new Uint8Array(fs.readFileSync('data/delivery_os.db')));

const show = (sql, label) => {
  const r = db.exec(sql);
  console.log(`\n--- ${label}`);
  if (!r.length) {
    console.log('(vazio)');
    return;
  }
  const cols = r[0].columns;
  for (const v of r[0].values) {
    const o = {};
    cols.forEach((c, i) => (o[c] = v[i]));
    console.log(JSON.stringify(o));
  }
};

show('SELECT id, name, email, role, status, created_at, last_login_at FROM users', 'usuários');
show(
  "SELECT action, description, created_at FROM audits WHERE entity = 'user' ORDER BY created_at DESC LIMIT 8",
  'auditoria de usuários',
);
show('SELECT key, value FROM app_meta', 'app_meta');
show('SELECT COUNT(*) AS n FROM sync_outbox', 'sync_outbox');