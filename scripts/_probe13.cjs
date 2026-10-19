/* A diferenca crucial: db.run(sql, params) funciona; prepare+bind+step as vezes
   nao. Vamos reproduzir o createNeighborhood dos DOIS jeitos, lado a lado. */
const path = require('path');
const initSqlJs = require('sql.js');

(async () => {
  const SQL = await initSqlJs({
    locateFile: (f) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', f),
  });

  const DDL = `CREATE TABLE neighborhoods (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, state TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`;

  const SQL_INSERT = `INSERT INTO neighborhoods (id, name, city, state, status, created_at, updated_at)
       VALUES (?, ?, ?)`;
  const ARGS = ['ID1', 'Centro', 'Sao Paulo', 'SP', 'active', 'ts', 'ts'];

  // ---- A) db.run(sql, params) — o que o projeto USA ----
  {
    const db = new SQL.Database();
    db.run(DDL);
    try {
      db.run(SQL_INSERT, ARGS);
      console.log('A) db.run(sql, params)        : OK');
    } catch (e) {
      console.log('A) db.run(sql, params)        : ERRO ->', e.message);
    }
    console.log('   linhas:', db.exec('SELECT * FROM neighborhoods').length ? db.exec('SELECT * FROM neighborhoods')[0].values.length : 0);
  }

  // ---- B) prepare + bind + step — o que meus probes faziam ----
  {
    const db = new SQL.Database();
    db.run(DDL);
    let stmt;
    try {
      stmt = db.prepare(SQL_INSERT);
      stmt.bind(ARGS);
      stmt.step();
      console.log('B) prepare+bind+step          : OK');
    } catch (e) {
      console.log('B) prepare+bind+step          : ERRO ->', e.message);
    } finally {
      try { if (stmt) stmt.free(); } catch { }
    }
  }

  // ---- C) prepare(sql, params) + step ----
  {
    const db = new SQL.Database();
    db.run(DDL);
    let stmt;
    try {
      stmt = db.prepare(SQL_INSERT, ARGS);
      stmt.step();
      console.log('C) prepare(sql, params)+step  : OK');
    } catch (e) {
      console.log('C) prepare(sql, params)+step  : ERRO ->', e.message);
    } finally {
      try { if (stmt) stmt.free(); } catch { }
    }
  }

  // ---- D) STATEMENT REUTILIZADO (bind duas vezes) ----
  {
    const db = new SQL.Database();
    db.run(DDL);
    let stmt;
    try {
      stmt = db.prepare(SQL_INSERT);
      stmt.bind(['ID1', 'A', 'B', 'SP', 'active', 't', 't']);
      stmt.step();
      stmt.reset();
      stmt.bind(['ID2', 'C', 'D', 'SP', 'active', 't', 't']);
      stmt.step();
      console.log('D) stmt reutilizado (2 binds): OK');
    } catch (e) {
      console.log('D) stmt reutilizado (2 binds): ERRO ->', e.message);
    } finally {
      try { if (stmt) stmt.free(); } catch { }
    }
  }
})();
