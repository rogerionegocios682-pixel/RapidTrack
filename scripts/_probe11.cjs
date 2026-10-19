/* Sera que a string "VALUES" (maiuscula) e o gatilho? */
const path = require('path');
const initSqlJs = require('sql.js');

(async () => {
  const SQL = await initSqlJs({
    locateFile: (f) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', f),
  });
  const db = new SQL.Database();
  db.run('CREATE TABLE n (id TEXT, name TEXT, city TEXT, state TEXT)');

  const cases = [
    ['VALUES (2 vals)  ', 'INSERT INTO n (id,name,city,state) VALUES (?,?)', ['A', 'B', 'C', 'D']],
    ['values (2 vals)  ', 'INSERT INTO n (id,name,city,state) values (?,?)', ['E', 'B', 'C', 'D']],
    ['ValueS (2 vals)  ', 'INSERT INTO n (id,name,city,state) ValueS (?,?)', ['F', 'B', 'C', 'D']],
    ['SELECT ... UNION ', 'INSERT INTO n (id,name,city,state) SELECT ?,?,?', ['G', 'B', 'C', 'D']],
    ['VALUES (4 vals)  ', 'INSERT INTO n (id,name,city,state) VALUES (?,?)', ['H', 'B', 'C', 'D']],
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
