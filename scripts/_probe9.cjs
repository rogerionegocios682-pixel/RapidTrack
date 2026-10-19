/* Diagnostico final: o erro "3 values for N columns" vem do PARSER de SQL do
   sql.js, independentemente da contagem real de placeholders. Vamos ver quais
   formas de INSERT passam e quais nao. */
const path = require('path');
const initSqlJs = require('sql.js/dist/sql-wasm-debug.js');

(async () => {
  const SQL = await initSqlJs({
    locateFile: (f) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', f),
  });
  const db = new SQL.Database();
  db.run('CREATE TABLE n (id TEXT, name TEXT, city TEXT, state TEXT)');

  const P = ['A', 'Centro', 'SP', 'SP'];
  const cases = [
    ['com colunas         ', 'INSERT INTO n (id, name, city, state) VALUES (?,?)', P],
    ['com colunas (3 vals)', 'INSERT INTO n (id, name, city, state) VALUES (?,?)', P],
    ['sem colunas         ', 'INSERT INTO n VALUES (?,?)', P],
    ['sem colunas (3 vals)', 'INSERT INTO n VALUES (?,?)', P],
    ['3 colunas / 3 vals  ', 'INSERT INTO n (id, name, city) VALUES (?,?)', ['A', 'C', 'SP']],
    ['2 colunas / 2 vals  ', 'INSERT INTO n (id, name) VALUES (?,?)', ['B', 'C']],
    ['1 coluna  / 1 val   ', 'INSERT INTO n (id) VALUES (?)', ['D']],
    ['colunas = todas     ', 'INSERT INTO n (id,name,city,state) VALUES (?,?)', P],
  ];

  for (const [label, sql, p] of cases) {
    let stmt;
    try {
      stmt = db.prepare(sql);
      stmt.bind(p);
      stmt.step();
      console.log(`${label}: OK`);
    } catch (e) {
      console.log(`${label}: ERRO -> ${e && e.message ? e.message : String(e)}`);
    } finally {
      try { if (stmt) stmt.free(); } catch { }
    }
  }
  console.log('conteudo:', JSON.stringify(db.exec('SELECT * FROM n')));
})();
