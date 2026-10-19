

// Inspeção rápida do banco SQLite local (data/delivery_os.db)
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';

const file = path.join(process.cwd(), 'data', 'delivery_os.db');
if (!fs.existsSync(file)) {
  console.log('DB não existe:', file);
  process.exit(0);
}

const SQL = await initSqlJs({
  locateFile: (f) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', f),
});
const db = new SQL.Database(new Uint8Array(fs.readFileSync(file)));

const tables = [
  'users',
  'neighborhoods',
  'companies',
  'motoboys',
  'company_neighborhoods',
  'delivery_fees',
  'deliveries',
  'audits',
];

for (const t of tables) {
  try {
    const r = db.exec(`SELECT COUNT(*) AS n FROM ${t}`);
    console.log(`\n== ${t}: ${r[0].values[0][0]} registro(s)`);
    const sample = db.exec(`SELECT * FROM ${t} LIMIT 3`);
    if (sample.length) {
      const { columns, values } = sample[0];
      for (const row of values) {
        const obj = {};
        columns.forEach((c, i) => (obj[c] = row[i]));
        console.log('  ', JSON.stringify(obj));
      }
    }
  } catch (e) {
    console.log(`\n== ${t}: ERRO -> ${e.message}`);
  }
}

// Índices e schema das tabelas principais
for (const t of ['companies', 'motoboys', 'neighborhoods', 'delivery_fees']) {
  const info = db.exec(`PRAGMA table_info(${t})`);
  if (info.length) {
    console.log(`\n-- colunas de ${t}: ${info[0].values.map((v) => v[1]).join(', ')}`);
  }
}
