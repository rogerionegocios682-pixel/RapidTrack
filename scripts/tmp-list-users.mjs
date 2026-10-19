/**
 * Lista usuários do banco local (sql.js) — utilitário de QA.
 *
 * Uso: node scripts/tmp-list-users.mjs
 *
 * Exibe os campos relevantes para inspeção rápida do cadastro:
 * identidade, contato, vínculo com motoboy, permissões (override JSON) e último login.
 *
 * Formatação: datas e telefone seguem o mesmo padrão do app
 * (`src/lib/format.ts`) — datas em pt-BR (America/Sao_Paulo), telefone
 * com DDD. Reimplementado aqui para manter o script autocontido (sem TS).
 */
import initSqlJs from 'sql.js';
import { readFileSync } from 'node:fs';

const DB_PATH = process.env.DB_PATH || 'data/delivery_os.db';

const SQL = await initSqlJs();
const db = new SQL.Database(readFileSync(DB_PATH));

const res = db.exec(`
  SELECT
    u.id,
    u.name,
    u.email,
    u.phone,
    u.role,
    u.status,
    u.motoboy_id,
    m.name AS motoboy_name,
    u.permissions,
    u.last_login_at
  FROM users u
  LEFT JOIN motoboys m ON m.id = u.motoboy_id
  ORDER BY u.created_at
`);

if (res.length === 0) {
  console.log('(nenhum usuário cadastrado)');
  process.exit(0);
}

const { columns, values } = res[0];
const rows = values.map((row) =>
  Object.fromEntries(columns.map((col, i) => [col, row[i]])),
);

/* --- Formatação (espelha src/lib/format.ts) ------------------------------ */

const TZ = 'America/Sao_Paulo';

const formatDate = (iso) => {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
};

const formatTime = (iso) => {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
};

const formatDateTime = (iso) => (iso ? `${formatDate(iso)} ${formatTime(iso)}` : '—');

const formatPhone = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 11);
  if (!digits) return '—';
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
};

const formatPerms = (raw) => {
  if (!raw) return 'padrão do perfil';
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? `${parsed.length} personalizada(s)` : 'padrão do perfil';
  } catch {
    return 'padrão do perfil';
  }
};

/* --- Saída --------------------------------------------------------------- */

console.log(`${rows.length} usuário(s) em ${DB_PATH}\n`);
for (const u of rows) {
  console.log(`- ${u.name} <${u.email}>`);
  console.log(`    id          : ${u.id}`);
  console.log(`    perfil      : ${u.role} (${u.status})`);
  console.log(`    telefone    : ${formatPhone(u.phone)}`);
  console.log(`    motoboy     : ${u.motoboy_name ?? '—'}`);
  console.log(`    permissões  : ${formatPerms(u.permissions)}`);
  console.log(`    último login: ${formatDateTime(u.last_login_at)}`);
}
