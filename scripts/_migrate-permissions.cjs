const initSqlJs = require('sql.js/dist/sql-wasm.js');
const fs = require('fs');
const path = require('path');

(async () => {
  const file = path.join(__dirname, '..', 'data', 'delivery_os.db');
  const SQL = await initSqlJs({
    locateFile: (f) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', f),
  });
  const db = new SQL.Database(fs.readFileSync(file));

  // Verifica se a coluna já existe
  const cols = db.exec("PRAGMA table_info(users)");
  const names = cols.length ? cols[0].values.map((r) => r[1]) : [];
  if (names.includes('permissions')) {
    console.log('coluna permissions já existe — nada a fazer.');
    return;
  }

  db.run('ALTER TABLE users ADD COLUMN permissions TEXT');
  fs.writeFileSync(file, Buffer.from(db.export()));

  const after = db.exec("PRAGMA table_info(users)");
  console.log('colunas após migração:', after[0].values.map((r) => r[1]).join(', '));
})().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});