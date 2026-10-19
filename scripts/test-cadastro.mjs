// Testa as operações de CRUD de cadastro direto no banco SQLite,
// replicando exatamente as queries dos repositórios (com placeholders).
import fs from 'node:fs';
import path from 'node:path';
import initSqlJs from 'sql.js';

const file = path.join(process.cwd(), 'data', 'delivery_os.db');
const SQL = await initSqlJs({
  locateFile: (f) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', f),
});

// Trabalha numa cópia para não alterar o banco real.
const tmp = path.join(process.cwd(), 'data', 'test_cadastro.db');
fs.copyFileSync(file, tmp);
const db = new SQL.Database(new Uint8Array(fs.readFileSync(tmp)));
db.run('PRAGMA foreign_keys = ON'); // mesmo comportamento do src/db/sqlite.ts

const uuid = () => {
  const b = new Uint8Array(16);
  for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const nowIso = () => new Date().toISOString();
const sqlLit = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};
const sqlList = (arr) => arr.map(sqlLit).join(', ');

let pass = 0;
let fail = 0;
function check(name, fn) {
  try {
    fn();
    console.log(`  OK   ${name}`);
    pass++;
  } catch (e) {
    console.log(`  FAIL ${name} -> ${e.message}`);
    fail++;
  }
}
function expect(cond, msg) {
  if (!cond) throw new Error(msg || 'condição falhou');
}
function exec(sql) {
  db.run(sql);
}
function one(sql) {
  const r = db.exec(sql);
  if (!r.length || !r[0].values.length) return null;
  const cols = r[0].columns;
  const row = r[0].values[0];
  const o = {};
  cols.forEach((c, i) => (o[c] = row[i]));
  return o;
}
function all(sql) {
  const r = db.exec(sql);
  if (!r.length) return [];
  const cols = r[0].columns;
  return r[0].values.map((row) => {
    const o = {};
    cols.forEach((c, i) => (o[c] = row[i]));
    return o;
  });
}

console.log('\n== 1. BAIRRO (createNeighborhood)');
const nbId = uuid();
const ts = nowIso();
exec(
  `INSERT INTO neighborhoods (id, name, city, state, status, created_at, updated_at)
   VALUES (${sqlList([nbId, 'Centro', 'Recife', 'PE', 'active', ts, ts])})`,
);
check('bairro inserido', () => {
  const row = one(`SELECT * FROM neighborhoods WHERE id = ${sqlLit(nbId)}`);
  expect(row && row.name === 'Centro', 'não encontrou o bairro');
  expect(row.city === 'Recife' && row.state === 'PE', 'cidade/uf incorretos');
});

console.log('\n== 2. EMPRESA (createCompany)');
const compId = uuid();
exec(
  `INSERT INTO companies
     (id, name, trade_name, cnpj, phone, whatsapp, email, address, neighborhood, city, state, status, created_at, updated_at)
   VALUES (${sqlList([
     compId,
     'Empresa Teste LTDA',
     'Teste',
     '12345678000199',
     '(81) 99999-0000',
     '(81) 99999-0000',
     'teste@empresa.com',
     'Rua A, 100',
     'Centro',
     'Recife',
     'PE',
     'active',
     ts,
     ts,
   ])})`,
);
check('empresa inserida com todos os campos', () => {
  const row = one(`SELECT * FROM companies WHERE id = ${sqlLit(compId)}`);
  expect(row, 'empresa não encontrada');
  expect(row.cnpj === '12345678000199', 'cnpj');
  expect(row.email === 'teste@empresa.com', 'email');
  expect(row.address === 'Rua A, 100', 'address');
  expect(row.neighborhood === 'Centro', 'neighborhood');
  expect(row.city === 'Recife', 'city');
  expect(row.state === 'PE', 'state');
  expect(row.status === 'active', 'status');
});

console.log('\n== 3. MOTOBOY (createMotoboy)');
const motId = uuid();
exec(
  `INSERT INTO motoboys
     (id, name, cpf, phone, whatsapp, motorcycle_plate, motorcycle_model, notes, status, created_at, updated_at)
   VALUES (${sqlList([
     motId,
     'João Motoboy',
     '12345678901',
     '(81) 98888-1111',
     '(81) 98888-1111',
     'ABC1D23',
     'Honda CG 160',
     'Sem observações',
     'available',
     ts,
     ts,
   ])})`,
);
check('motoboy inserido com todos os campos', () => {
  const row = one(`SELECT * FROM motoboys WHERE id = ${sqlLit(motId)}`);
  expect(row, 'motoboy não encontrado');
  expect(row.cpf === '12345678901', 'cpf');
  expect(row.motorcycle_plate === 'ABC1D23', 'placa');
  expect(row.motorcycle_model === 'Honda CG 160', 'modelo');
  expect(row.notes === 'Sem observações', 'notes');
  expect(row.status === 'available', 'status');
});

console.log('\n== 4. VÍNCULO EMPRESA x BAIRRO (addCompanyNeighborhood)');
const linkId = uuid();
exec(
  `INSERT INTO company_neighborhoods (id, company_id, neighborhood_id, created_at)
   VALUES (${sqlList([linkId, compId, nbId, ts])})`,
);
check('vínculo criado', () => {
  const row = one(
    `SELECT cn.*, n.name FROM company_neighborhoods cn
      JOIN neighborhoods n ON n.id = cn.neighborhood_id
     WHERE cn.company_id = ${sqlLit(compId)} AND cn.neighborhood_id = ${sqlLit(nbId)}`,
  );
  expect(row && row.name === 'Centro', 'vínculo não encontrado');
});

console.log('\n== 5. TAXA (upsertFee)');
const feeId = uuid();
exec(
  `INSERT INTO delivery_fees (id, company_id, neighborhood_id, fee_cents, status, created_at, updated_at)
   VALUES (${sqlList([feeId, compId, nbId, 850, 'active', ts, ts])})`,
);
check('taxa criada e consultável', () => {
  const row = one(
    `SELECT df.*, c.name AS company_name, n.name AS neighborhood_name
       FROM delivery_fees df
       JOIN companies c ON c.id = df.company_id
       JOIN neighborhoods n ON n.id = df.neighborhood_id
      WHERE df.company_id = ${sqlLit(compId)} AND df.neighborhood_id = ${sqlLit(nbId)}`,
  );
  expect(row && Number(row.fee_cents) === 850, 'taxa não encontrada');
});

console.log('\n== 6. UPDATE EMPRESA (updateCompany)');
exec(
  `UPDATE companies SET name = ${sqlLit('Empresa Editada')}, phone = ${sqlLit('(81) 91111-2222')},
     status = 'inactive', updated_at = ${sqlLit(nowIso())}
   WHERE id = ${sqlLit(compId)}`,
);
check('empresa atualizada', () => {
  const row = one(`SELECT * FROM companies WHERE id = ${sqlLit(compId)}`);
  expect(row.name === 'Empresa Editada', 'nome não atualizado');
  expect(row.phone === '(81) 91111-2222', 'telefone não atualizado');
  expect(row.status === 'inactive', 'status não atualizado');
});

console.log('\n== 7. TOGGLE STATUS MOTOBOY');
exec(`UPDATE motoboys SET status = 'inactive', updated_at = ${sqlLit(nowIso())} WHERE id = ${sqlLit(motId)}`);
check('motoboy inativado', () => {
  const row = one(`SELECT * FROM motoboys WHERE id = ${sqlLit(motId)}`);
  expect(row.status === 'inactive', 'status não mudou');
});

console.log('\n== 8. LISTAGENS (com subqueries de contagem)');
check('listCompanies com neighborhoods_count', () => {
  const rows = all(
    `SELECT c.*, (SELECT COUNT(*) FROM company_neighborhoods cn WHERE cn.company_id = c.id) AS neighborhoods_count
       FROM companies c ORDER BY c.name`,
  );
  const comp = rows.find((r) => r.id === compId);
  expect(comp && Number(comp.neighborhoods_count) === 1, 'contagem de bairros incorreta');
});
check('listMotoboys com open_deliveries', () => {
  const rows = all(
    `SELECT m.*, (SELECT COUNT(*) FROM deliveries d WHERE d.motoboy_id = m.id AND d.status IN ('pending','dispatched','in_progress')) AS open_deliveries
       FROM motoboys m ORDER BY m.name`,
  );
  const mot = rows.find((r) => r.id === motId);
  expect(mot, 'motoboy não listado');
});
check('listNeighborhoods com companies_count', () => {
  const rows = all(
    `SELECT n.*, (SELECT COUNT(*) FROM company_neighborhoods cn WHERE cn.neighborhood_id = n.id) AS companies_count
       FROM neighborhoods n ORDER BY n.name`,
  );
  const nb = rows.find((r) => r.id === nbId);
  expect(nb && Number(nb.companies_count) === 1, 'contagem de empresas incorreta');
});

console.log('\n== 9. DELETE (cascade)');
exec(`DELETE FROM companies WHERE id = ${sqlLit(compId)}`);
check('empresa excluída remove vínculos e taxas (cascade)', () => {
  const links = one(`SELECT COUNT(*) AS n FROM company_neighborhoods WHERE company_id = ${sqlLit(compId)}`);
  const fees = one(`SELECT COUNT(*) AS n FROM delivery_fees WHERE company_id = ${sqlLit(compId)}`);
  expect(Number(links.n) === 0, 'vínculos remanescentes');
  expect(Number(fees.n) === 0, 'taxas remanescentes');
});

exec(`DELETE FROM motoboys WHERE id = ${sqlLit(motId)}`);
exec(`DELETE FROM neighborhoods WHERE id = ${sqlLit(nbId)}`);
check('motoboy e bairro excluídos', () => {
  expect(one(`SELECT COUNT(*) AS n FROM motoboys WHERE id = ${sqlLit(motId)}`).n === 0, 'motoboy remanescente');
  expect(one(`SELECT COUNT(*) AS n FROM neighborhoods WHERE id = ${sqlLit(nbId)}`).n === 0, 'bairro remanescente');
});

fs.unlinkSync(tmp);
console.log(`\n==== RESULTADO: ${pass} OK, ${fail} FALHAS ====\n`);
process.exit(fail ? 1 : 0);
