/* Inspeção rápida do banco SQLite local (temporário). */
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

initSqlJs({
  locateFile: (f) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', f),
}).then((SQL) => {
  const file = path.join(process.cwd(), 'data', 'delivery_os.db');
  const db = new SQL.Database(new Uint8Array(fs.readFileSync(file)));

  const tables = db.exec(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  );
  console.log('TABELAS:', tables[0] ? tables[0].values.map((v) => v[0]).join(', ') : '(nenhuma)');

  const users = db.exec('SELECT id, name, email, role, status FROM users');
  console.log('USUARIOS:', JSON.stringify(users, null, 2));

  for (const t of ['companies', 'motoboys', 'neighborhoods', 'fees', 'deliveries', 'audits']) {
    try {
      const r = db.exec(`SELECT COUNT(*) AS n FROM ${t}`);
      console.log(`COUNT ${t}:`, r[0].values[0][0]);
    } catch (e) {
      console.log(`COUNT ${t}: erro -> ${e.message}`);
    }
  }
});
