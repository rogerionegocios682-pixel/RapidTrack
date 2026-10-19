/**
 * Repositório de Corridas (deliveries).
 * ---------------------------------------------------------------------------
 * Regras de negócio implementadas:
 *  - O número do pedido é único por empresa (bloqueia duplicidade acidental).
 *  - Bairro precisa estar vinculado à empresa escolhida.
 *  - Toda mudança de status grava histórico (de -> para, quem, quando).
 *  - O status do motoboy é sincronizado automaticamente com suas corridas.
 *  - Motoboy só enxerga e altera as próprias corridas (ver `motoboyScope`).
 */
import { query, queryOne, write, runSql, sqlList, sqlLit, sqlSet } from '@/db';
import { auditRow } from '@/lib/audit';
import { newId, nowIso, clean, dayRangeIso, localDateKey } from '@/lib/utils';
import { motoboyScope } from '@/lib/auth';
import {
  DELIVERY_STATUS_LABEL,
  type Delivery,
  type DeliveryRow,
  type DeliveryStatus,
  type SessionUser,
} from '@/lib/types';

/** Transições permitidas — impede saltos inválidos de status. */
const ALLOWED_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  pending: ['dispatched', 'cancelled'],
  dispatched: ['in_progress', 'delivered', 'cancelled', 'customer_not_found'],
  in_progress: ['delivered', 'cancelled', 'customer_not_found'],
  delivered: [], // estado final
  cancelled: [], // estado final
  customer_not_found: [], // estado final
};

export const FINAL_STATUSES: DeliveryStatus[] = [
  'delivered',
  'cancelled',
  'customer_not_found',
];

export function canTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface DeliveryInput {
  order_number: string;
  company_id: string;
  customer_name: string;
  neighborhood_id: string;
  motoboy_id: string;
  fee_cents: number;
  notes?: string;
  status?: DeliveryStatus;
}

export interface DeliveryListOptions {
  search?: string;
  dateKey?: string; // YYYY-MM-DD (fuso SP)
  from?: string; // ISO
  to?: string; // ISO
  companyId?: string;
  motoboyId?: string;
  neighborhoodId?: string;
  status?: DeliveryStatus | 'all' | 'open';
  limit?: number;
  offset?: number;
}

const BASE_SELECT = `
  SELECT d.*,
         c.name  AS company_name,
         n.name  AS neighborhood_name,
         n.city  AS neighborhood_city,
         m.name  AS motoboy_name,
         u.name  AS operator_name
    FROM deliveries d
    JOIN companies c      ON c.id = d.company_id
    JOIN neighborhoods n  ON n.id = d.neighborhood_id
    JOIN motoboys m       ON m.id = d.motoboy_id
    LEFT JOIN users u     ON u.id = d.created_by`;

function buildFilters(
  opts: DeliveryListOptions,
  scope: { sql: string; params: string[] },
): { where: string; params: (string | number)[] } {
  const where: string[] = [];
  const params: (string | number)[] = [...scope.params];

  if (opts.search) {
    const like = `%${opts.search}%`;
    where.push(
      '(d.order_number LIKE ? OR d.customer_name LIKE ? OR c.name LIKE ? OR m.name LIKE ?)',
    );
    params.push(like, like, like, like);
  }

  if (opts.dateKey) {
    const { start, end } = dayRangeIso(opts.dateKey);
    where.push('d.created_at >= ? AND d.created_at < ?');
    params.push(start, end);
  }

  if (opts.from) {
    where.push('d.created_at >= ?');
    params.push(opts.from);
  }
  if (opts.to) {
    where.push('d.created_at < ?');
    params.push(opts.to);
  }
  if (opts.companyId) {
    where.push('d.company_id = ?');
    params.push(opts.companyId);
  }
  if (opts.motoboyId) {
    where.push('d.motoboy_id = ?');
    params.push(opts.motoboyId);
  }
  if (opts.neighborhoodId) {
    where.push('d.neighborhood_id = ?');
    params.push(opts.neighborhoodId);
  }
  if (opts.status && opts.status !== 'all') {
    if (opts.status === 'open') {
      where.push(`d.status IN ('pending','dispatched','in_progress')`);
    } else {
      where.push('d.status = ?');
      params.push(opts.status);
    }
  }

  const sql = scope.sql.replace(/^ AND /, '');
  if (sql) where.push(sql);

  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

export async function listDeliveries(
  opts: DeliveryListOptions,
  user: SessionUser,
): Promise<DeliveryRow[]> {
  const scope = motoboyScope(user);
  const { where, params } = buildFilters(opts, scope);
  const limit = opts.limit ?? 500;
  const offset = opts.offset ?? 0;

  return query<DeliveryRow>(
    `${BASE_SELECT}
     ${where}
     ORDER BY d.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
}

export async function countDeliveries(
  opts: DeliveryListOptions,
  user: SessionUser,
): Promise<number> {
  const scope = motoboyScope(user);
  const { where, params } = buildFilters(opts, scope);
  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n
       FROM deliveries d
       JOIN companies c     ON c.id = d.company_id
       JOIN motoboys m      ON m.id = d.motoboy_id
     ${where}`,
    params,
  );
  return Number(row?.n ?? 0);
}

/** Busca uma corrida respeitando o escopo do motoboy. */
export async function getDelivery(
  id: string,
  user: SessionUser,
): Promise<DeliveryRow | null> {
  const scope = motoboyScope(user);
  const sql = scope.sql.replace(/^ AND /, '');
  return queryOne<DeliveryRow>(
    `${BASE_SELECT} WHERE d.id = ? ${sql ? `AND ${sql}` : ''}`,
    [id, ...scope.params],
  );
}

/** Bairros atendidos pela empresa (validação do vínculo). */
async function assertCompanyNeighborhood(
  companyId: string,
  neighborhoodId: string,
): Promise<void> {
  const link = await queryOne<{ id: string }>(
    'SELECT id FROM company_neighborhoods WHERE company_id = ? AND neighborhood_id = ?',
    [companyId, neighborhoodId],
  );
  if (!link) {
    throw new Error(
      'O bairro selecionado não é atendido por esta empresa. Vincule o bairro à empresa antes.',
    );
  }
}

/** Cria a corrida e já registra o despacho (status inicial: Despachada). */
export async function createDelivery(
  input: DeliveryInput,
  user: SessionUser,
): Promise<Delivery> {
  const orderNumber = clean(input.order_number, 50);
  if (!orderNumber) throw new Error('Informe o número do pedido.');
  if (!input.company_id) throw new Error('Selecione a empresa.');
  if (!input.neighborhood_id) throw new Error('Selecione o bairro.');
  if (!input.motoboy_id) throw new Error('Selecione o motoboy.');
  if (!clean(input.customer_name, 150)) throw new Error('Informe o nome do cliente.');
  if (!Number.isFinite(input.fee_cents) || input.fee_cents < 0)
    throw new Error('Informe um valor de taxa válido.');

  await assertCompanyNeighborhood(input.company_id, input.neighborhood_id);

  const motoboy = await queryOne<{ id: string; status: string; name: string }>(
    'SELECT id, status, name FROM motoboys WHERE id = ?',
    [input.motoboy_id],
  );
  if (!motoboy) throw new Error('Motoboy não encontrado.');
  if (motoboy.status === 'inactive') throw new Error('Este motoboy está inativo.');

  const id = newId();
  const ts = nowIso();
  const status: DeliveryStatus = input.status ?? 'dispatched';

  // Bloqueia duplicidade de nº de pedido na mesma empresa (o índice único do
  // banco é a garantia final; aqui evitamos a mensagem crua do Postgres).
  const dup = await queryOne<{ id: string }>(
    `SELECT id FROM deliveries
      WHERE company_id = ? AND LOWER(order_number) = LOWER(?)
      LIMIT 1`,
    [input.company_id, orderNumber],
  );
  if (dup) {
    throw new Error(
      `Já existe uma corrida com o pedido nº ${orderNumber} para esta empresa.`,
    );
  }

  await write((db) => {
    runSql(
      db,
      `INSERT INTO deliveries
         (id, order_number, company_id, customer_name, neighborhood_id, motoboy_id,
          fee_cents, status, notes, dispatched_at, delivered_at, cancelled_at,
          created_by, updated_by, created_at, updated_at)
       VALUES (${sqlList([
         id,
         orderNumber,
         input.company_id,
         clean(input.customer_name, 150),
         input.neighborhood_id,
         input.motoboy_id,
         input.fee_cents,
         status,
         clean(input.notes, 500) || null,
         status === 'pending' ? null : ts,
         null,
         null,
         user.id,
         user.id,
         ts,
         ts,
       ])})`,
    );

    // Histórico inicial.
    runSql(
      db,
      `INSERT INTO delivery_status_history (id, delivery_id, old_status, new_status, changed_by, created_at)
       VALUES (${sqlList([newId(), id, null, status, user.id, ts])})`,
    );

    syncMotoboyStatus(db, input.motoboy_id);

    auditRow(db, {
      user,
      action: 'create',
      entity: 'delivery',
      entityId: id,
      description: `Criou a corrida nº ${orderNumber} (${clean(input.customer_name, 150)})`,
      metadata: { status, fee_cents: input.fee_cents, motoboy: motoboy.name },
    });
  });

  return (await queryOne<Delivery>('SELECT * FROM deliveries WHERE id = ?', [id]))!;
}

export async function updateDelivery(
  id: string,
  input: DeliveryInput,
  user: SessionUser,
): Promise<Delivery> {
  const existing = await queryOne<Delivery>('SELECT * FROM deliveries WHERE id = ?', [id]);
  if (!existing) throw new Error('Corrida não encontrada.');
  if (FINAL_STATUSES.includes(existing.status)) {
    throw new Error('Corridas finalizadas não podem ser editadas.');
  }

  await assertCompanyNeighborhood(input.company_id, input.neighborhood_id);

  const orderNumber = clean(input.order_number, 50);
  const ts = nowIso();

  const dup = await queryOne<{ id: string }>(
    `SELECT id FROM deliveries
      WHERE company_id = ? AND LOWER(order_number) = LOWER(?) AND id <> ?
      LIMIT 1`,
    [input.company_id, orderNumber, id],
  );
  if (dup) {
    throw new Error(`Já existe outra corrida com o pedido nº ${orderNumber} nesta empresa.`);
  }

  await write((db) => {
    runSql(
      db,
      `UPDATE deliveries SET ${sqlSet({
        order_number: orderNumber,
        company_id: input.company_id,
        customer_name: clean(input.customer_name, 150),
        neighborhood_id: input.neighborhood_id,
        motoboy_id: input.motoboy_id,
        fee_cents: input.fee_cents,
        notes: clean(input.notes, 500) || null,
        updated_by: user.id,
        updated_at: ts,
      })} WHERE id = ${sqlLit(id)}`,
    );

    // Se o motoboy mudou, atualiza o status de ambos.
    const previousMotoboy = existing.motoboy_id;
    syncMotoboyStatus(db, input.motoboy_id);
    if (previousMotoboy !== input.motoboy_id) syncMotoboyStatus(db, previousMotoboy);

    auditRow(db, {
      user,
      action: 'update',
      entity: 'delivery',
      entityId: id,
      description: `Editou a corrida nº ${orderNumber}`,
    });
  });

  return (await queryOne<Delivery>('SELECT * FROM deliveries WHERE id = ?', [id]))!;
}

/** Altera o status, registra histórico e sincroniza o motoboy. */
export async function changeDeliveryStatus(
  id: string,
  newStatus: DeliveryStatus,
  user: SessionUser,
  reason?: string,
): Promise<Delivery> {
  const existing = await queryOne<Delivery>('SELECT * FROM deliveries WHERE id = ?', [id]);
  if (!existing) throw new Error('Corrida não encontrada.');

  // Motoboy só pode mexer nas próprias corridas.
  if (user.role === 'motoboy' && existing.motoboy_id !== user.motoboy_id) {
    throw new Error('Você só pode alterar as corridas atribuídas a você.');
  }
  if (!canTransition(existing.status, newStatus)) {
    throw new Error(
      `Transição inválida: "${DELIVERY_STATUS_LABEL[existing.status]}" → "${DELIVERY_STATUS_LABEL[newStatus]}".`,
    );
  }

  const ts = nowIso();

  await write((db) => {
    const deliveredAt = newStatus === 'delivered' ? ts : existing.delivered_at;
    const cancelledAt =
      newStatus === 'cancelled' || newStatus === 'customer_not_found'
        ? ts
        : existing.cancelled_at;

    // O CASE WHEN usa o motivo três vezes; avaliamos a condição uma única vez
    // e escolhemos o fragmento correspondente (evita repetir o literal).
    const reasonRaw = reason ?? '';
    const notesExpr =
      reasonRaw === '' || reasonRaw === null
        ? 'notes'
        : sqlLit(clean(reason, 500) || null);

    runSql(
      db,
      `UPDATE deliveries SET ${sqlSet({
        status: newStatus,
        delivered_at: deliveredAt,
        cancelled_at: cancelledAt,
        updated_by: user.id,
        updated_at: ts,
      })}, notes = ${notesExpr} WHERE id = ${sqlLit(id)}`,
    );

    runSql(
      db,
      `INSERT INTO delivery_status_history (id, delivery_id, old_status, new_status, changed_by, created_at)
       VALUES (${sqlList([newId(), id, existing.status, newStatus, user.id, ts])})`,
    );

    syncMotoboyStatus(db, existing.motoboy_id);

    auditRow(db, {
      user,
      action: 'status_change',
      entity: 'delivery',
      entityId: id,
      description: `Corrida nº ${existing.order_number}: "${DELIVERY_STATUS_LABEL[existing.status]}" → "${DELIVERY_STATUS_LABEL[newStatus]}"`,
      metadata: { de: existing.status, para: newStatus, motivo: reason ?? null },
    });
  });

  return (await queryOne<Delivery>('SELECT * FROM deliveries WHERE id = ?', [id]))!;
}

export async function deleteDelivery(id: string, user: SessionUser): Promise<void> {
  const existing = await queryOne<Delivery>('SELECT * FROM deliveries WHERE id = ?', [id]);
  if (!existing) throw new Error('Corrida não encontrada.');

  await write((db) => {
    runSql(db, `DELETE FROM deliveries WHERE id = ${sqlLit(id)}`);
    syncMotoboyStatus(db, existing.motoboy_id);
    auditRow(db, {
      user,
      action: 'delete',
      entity: 'delivery',
      entityId: id,
      description: `Excluiu a corrida nº ${existing.order_number}`,
    });
  });
}

export async function getDeliveryHistory(deliveryId: string) {
  return query<{
    id: string;
    old_status: DeliveryStatus | null;
    new_status: DeliveryStatus;
    created_at: string;
    user_name: string;
  }>(
    `SELECT h.id, h.old_status, h.new_status, h.created_at, u.name AS user_name
       FROM delivery_status_history h
       LEFT JOIN users u ON u.id = h.changed_by
      WHERE h.delivery_id = ?
      ORDER BY h.created_at ASC`,
    [deliveryId],
  );
}

/**
 * Mantém `motoboys.status` coerente com as corridas em aberto.
 * - Com corrida despachada/em andamento -> 'on_delivery'
 * - Sem corrida em aberto e não inativo -> 'available'
 */
function syncMotoboyStatus(db: import('@/db').Tx, motoboyId: string): void {
  // Atualização única e atômica: deriva o status de uma subconsulta sobre as
  // corridas em aberto. Não precisa de leitura prévia, então funciona igual
  // sob Postgres (onde o callback de `write` não lê resultados).
  // - status 'inactive' nunca é alterado
  // - corrida 'dispatched'/'in_progress' -> 'on_delivery'
  // - caso contrário -> 'available'
  runSql(
    db,
    `UPDATE motoboys SET
       status = CASE
         WHEN (SELECT COUNT(*) FROM deliveries d
                WHERE d.motoboy_id = ${sqlLit(motoboyId)}
                  AND d.status IN ('dispatched','in_progress')) > 0
           THEN 'on_delivery'
         ELSE 'available'
       END,
       updated_at = ${sqlLit(nowIso())}
     WHERE id = ${sqlLit(motoboyId)} AND status <> 'inactive'`,
  );
}

/* ---------------------------------------------------------------------------
 * Indicadores do Dashboard (sempre calculados do banco)
 * -------------------------------------------------------------------------*/

export interface DashboardStats {
  dateKey: string;
  total: number;
  dispatched: number;
  inProgress: number;
  delivered: number;
  cancelled: number;
  customerNotFound: number;
  pending: number;
  feesToday: number;
  feesDelivered: number;
  motoboysActive: number;
  motoboysOnDelivery: number;
  motoboysAvailable: number;
  companiesTotal: number;
  companiesActive: number;
}

export async function getDashboardStats(user: SessionUser): Promise<DashboardStats> {
  const dateKey = localDateKey();
  const { start, end } = dayRangeIso(dateKey);
  const scope = motoboyScope(user);
  const scopeCond = scope.sql.replace(/^ AND /, '');
  const scopeAnd = scopeCond ? ` AND ${scopeCond}` : '';

  const row = await queryOne<Record<string, number>>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN d.status = 'pending'      THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN d.status = 'dispatched'   THEN 1 ELSE 0 END) AS dispatched,
       SUM(CASE WHEN d.status = 'in_progress'  THEN 1 ELSE 0 END) AS in_progress,
       SUM(CASE WHEN d.status = 'delivered'    THEN 1 ELSE 0 END) AS delivered,
       SUM(CASE WHEN d.status = 'cancelled'    THEN 1 ELSE 0 END) AS cancelled,
       SUM(CASE WHEN d.status = 'customer_not_found' THEN 1 ELSE 0 END) AS customer_not_found,
       COALESCE(SUM(d.fee_cents), 0) AS fees_today,
       COALESCE(SUM(CASE WHEN d.status = 'delivered' THEN d.fee_cents ELSE 0 END), 0) AS fees_delivered
     FROM deliveries d
     WHERE d.created_at >= ? AND d.created_at < ?${scopeAnd}`,
    [start, end, ...scope.params],
  );

  const motoboys = await queryOne<Record<string, number>>(
    `SELECT
       (SELECT COUNT(*) FROM motoboys WHERE status = 'available')   AS available,
       (SELECT COUNT(*) FROM motoboys WHERE status = 'on_delivery') AS on_delivery,
       (SELECT COUNT(*) FROM motoboys WHERE status <> 'inactive')   AS total_active`,
  );

  const companies = await queryOne<Record<string, number>>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active
     FROM companies`,
  );

  return {
    dateKey,
    total: Number(row?.total ?? 0),
    pending: Number(row?.pending ?? 0),
    dispatched: Number(row?.dispatched ?? 0),
    inProgress: Number(row?.in_progress ?? 0),
    delivered: Number(row?.delivered ?? 0),
    cancelled: Number(row?.cancelled ?? 0),
    customerNotFound: Number(row?.customer_not_found ?? 0),
    feesToday: Number(row?.fees_today ?? 0),
    feesDelivered: Number(row?.fees_delivered ?? 0),
    motoboysActive: Number(motoboys?.total_active ?? 0),
    motoboysOnDelivery: Number(motoboys?.on_delivery ?? 0),
    motoboysAvailable: Number(motoboys?.available ?? 0),
    companiesTotal: Number(companies?.total ?? 0),
    companiesActive: Number(companies?.active ?? 0),
  };
}

/** Dados para os gráficos do dashboard (sempre do banco). */
export async function getDashboardCharts(user: SessionUser) {
  const dateKey = localDateKey();
  const { start, end } = dayRangeIso(dateKey);
  const scope = motoboyScope(user);
  const scopeCond = scope.sql.replace(/^ AND /, '');
  const scopeAnd = scopeCond ? ` AND ${scopeCond}` : '';

  const byCompany = await query<{ name: string; total: number; fees: number }>(
    `SELECT c.name, COUNT(*) AS total, COALESCE(SUM(d.fee_cents),0) AS fees
       FROM deliveries d JOIN companies c ON c.id = d.company_id
      WHERE d.created_at >= ? AND d.created_at < ?${scopeAnd}
      GROUP BY c.id ORDER BY total DESC LIMIT 8`,
    [start, end, ...scope.params],
  );

  const byMotoboy = await query<{ name: string; total: number; delivered: number }>(
    `SELECT m.name, COUNT(*) AS total,
            SUM(CASE WHEN d.status='delivered' THEN 1 ELSE 0 END) AS delivered
       FROM deliveries d JOIN motoboys m ON m.id = d.motoboy_id
      WHERE d.created_at >= ? AND d.created_at < ?${scopeAnd}
      GROUP BY m.id ORDER BY total DESC LIMIT 8`,
    [start, end, ...scope.params],
  );

  const byStatus = await query<{ status: DeliveryStatus; total: number }>(
    `SELECT d.status, COUNT(*) AS total
       FROM deliveries d
      WHERE d.created_at >= ? AND d.created_at < ?${scopeAnd}
      GROUP BY d.status`,
    [start, end, ...scope.params],
  );

  const byNeighborhood = await query<{ name: string; total: number; fees: number }>(
    `SELECT n.name, COUNT(*) AS total, COALESCE(SUM(d.fee_cents),0) AS fees
       FROM deliveries d JOIN neighborhoods n ON n.id = d.neighborhood_id
      WHERE d.created_at >= ? AND d.created_at < ?${scopeAnd}
      GROUP BY n.id ORDER BY total DESC LIMIT 8`,
    [start, end, ...scope.params],
  );

  return { byCompany, byMotoboy, byStatus, byNeighborhood };
}

/** Últimas corridas para o painel de atividade do dashboard. */
export async function getRecentDeliveries(
  user: SessionUser,
  limit = 8,
): Promise<DeliveryRow[]> {
  const scope = motoboyScope(user);
  const scopeCond = scope.sql.replace(/^ AND /, '');
  return query<DeliveryRow>(
    `${BASE_SELECT}
     ${scopeCond ? `WHERE ${scopeCond}` : ''}
     ORDER BY d.updated_at DESC LIMIT ?`,
    [...scope.params, limit],
  );
}
