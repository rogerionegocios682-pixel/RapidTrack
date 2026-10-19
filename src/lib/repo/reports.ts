/**
 * Relatórios — todos os números são calculados diretamente das corridas
 * registradas no banco (nunca de valores fixos).
 */
import { query, queryOne } from '@/db';
import { motoboyScope } from '@/lib/auth';
import { dayRangeIso, localDateKey, addDays } from '@/lib/utils';
import type { DeliveryStatus, SessionUser } from '@/lib/types';

export interface ReportFilters {
  from: string; // YYYY-MM-DD (inclusive)
  to: string; // YYYY-MM-DD (inclusive)
  companyId?: string;
  motoboyId?: string;
  neighborhoodId?: string;
}

export interface ReportSummary {
  total: number;
  delivered: number;
  cancelled: number;
  customerNotFound: number;
  pending: number;
  dispatched: number;
  inProgress: number;
  feesTotal: number;
  feesDelivered: number;
  feesCancelled: number;
  averageTicket: number;
}

function dateFilter(filters: ReportFilters): { cond: string; params: string[] } {
  // Converte o intervalo de dias locais para o intervalo UTC correspondente.
  const start = dayRangeIso(filters.from).start;
  const end = dayRangeIso(filters.to).end;
  return { cond: 'd.created_at >= ? AND d.created_at < ?', params: [start, end] };
}

function buildWhere(filters: ReportFilters, user: SessionUser) {
  const params: string[] = [];
  const conds: string[] = [];

  const d = dateFilter(filters);
  conds.push(d.cond);
  params.push(...d.params);

  if (filters.companyId) {
    conds.push('d.company_id = ?');
    params.push(filters.companyId);
  }
  if (filters.motoboyId) {
    conds.push('d.motoboy_id = ?');
    params.push(filters.motoboyId);
  }
  if (filters.neighborhoodId) {
    conds.push('d.neighborhood_id = ?');
    params.push(filters.neighborhoodId);
  }

  const scope = motoboyScope(user);
  const scopeCond = scope.sql.replace(/^ AND /, '');
  if (scopeCond) {
    conds.push(scopeCond);
    params.push(...scope.params);
  }

  return { where: `WHERE ${conds.join(' AND ')}`, params };
}

/** Resumo consolidado do período. */
export async function getReportSummary(
  filters: ReportFilters,
  user: SessionUser,
): Promise<ReportSummary> {
  const { where, params } = buildWhere(filters, user);

  const row = await queryOne<Record<string, number>>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN d.status='delivered'          THEN 1 ELSE 0 END) AS delivered,
       SUM(CASE WHEN d.status='cancelled'          THEN 1 ELSE 0 END) AS cancelled,
       SUM(CASE WHEN d.status='customer_not_found' THEN 1 ELSE 0 END) AS customer_not_found,
       SUM(CASE WHEN d.status='pending'            THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN d.status='dispatched'         THEN 1 ELSE 0 END) AS dispatched,
       SUM(CASE WHEN d.status='in_progress'        THEN 1 ELSE 0 END) AS in_progress,
       COALESCE(SUM(d.fee_cents), 0) AS fees_total,
       COALESCE(SUM(CASE WHEN d.status='delivered' THEN d.fee_cents ELSE 0 END), 0) AS fees_delivered,
       COALESCE(SUM(CASE WHEN d.status IN ('cancelled','customer_not_found') THEN d.fee_cents ELSE 0 END), 0) AS fees_cancelled
     FROM deliveries d ${where}`,
    params,
  );

  const total = Number(row?.total ?? 0);
  const feesTotal = Number(row?.fees_total ?? 0);

  return {
    total,
    delivered: Number(row?.delivered ?? 0),
    cancelled: Number(row?.cancelled ?? 0),
    customerNotFound: Number(row?.customer_not_found ?? 0),
    pending: Number(row?.pending ?? 0),
    dispatched: Number(row?.dispatched ?? 0),
    inProgress: Number(row?.in_progress ?? 0),
    feesTotal,
    feesDelivered: Number(row?.fees_delivered ?? 0),
    feesCancelled: Number(row?.fees_cancelled ?? 0),
    averageTicket: total > 0 ? Math.round(feesTotal / total) : 0,
  };
}

export interface MotoboyReportRow {
  motoboy_id: string;
  motoboy_name: string;
  total: number;
  delivered: number;
  cancelled: number;
  customer_not_found: number;
  fees_total: number;
  fees_delivered: number;
  companies: { company_id: string; company_name: string; total: number; fees: number }[];
}

/** Relatório por motoboy (um ou todos), com detalhamento por empresa. */
export async function getMotoboyReport(
  filters: ReportFilters,
  user: SessionUser,
): Promise<MotoboyReportRow[]> {
  const { where, params } = buildWhere(filters, user);

  const totals = await query<Record<string, string | number>>(
    `SELECT d.motoboy_id, m.name AS motoboy_name,
            COUNT(*) AS total,
            SUM(CASE WHEN d.status='delivered' THEN 1 ELSE 0 END) AS delivered,
            SUM(CASE WHEN d.status='cancelled' THEN 1 ELSE 0 END) AS cancelled,
            SUM(CASE WHEN d.status='customer_not_found' THEN 1 ELSE 0 END) AS customer_not_found,
            COALESCE(SUM(d.fee_cents),0) AS fees_total,
            COALESCE(SUM(CASE WHEN d.status='delivered' THEN d.fee_cents ELSE 0 END),0) AS fees_delivered
       FROM deliveries d JOIN motoboys m ON m.id = d.motoboy_id
       ${where}
      GROUP BY d.motoboy_id
      ORDER BY m.name COLLATE NOCASE ASC`,
    params,
  );

  const byCompany = await query<Record<string, string | number>>(
    `SELECT d.motoboy_id, c.id AS company_id, c.name AS company_name,
            COUNT(*) AS total, COALESCE(SUM(d.fee_cents),0) AS fees
       FROM deliveries d
       JOIN companies c ON c.id = d.company_id
       ${where}
      GROUP BY d.motoboy_id, c.id
      ORDER BY c.name COLLATE NOCASE ASC`,
    params,
  );

  return totals.map((t) => {
    const motoboyId = String(t.motoboy_id);
    return {
      motoboy_id: motoboyId,
      motoboy_name: String(t.motoboy_name),
      total: Number(t.total),
      delivered: Number(t.delivered),
      cancelled: Number(t.cancelled),
      customer_not_found: Number(t.customer_not_found),
      fees_total: Number(t.fees_total),
      fees_delivered: Number(t.fees_delivered),
      companies: byCompany
        .filter((c) => String(c.motoboy_id) === motoboyId)
        .map((c) => ({
          company_id: String(c.company_id),
          company_name: String(c.company_name),
          total: Number(c.total),
          fees: Number(c.fees),
        })),
    };
  });
}

export interface CompanyReportRow {
  company_id: string;
  company_name: string;
  total: number;
  delivered: number;
  cancelled: number;
  customer_not_found: number;
  pending: number;
  in_progress: number;
  fees_total: number;
  fees_delivered: number;
  motoboys: { motoboy_id: string; motoboy_name: string; total: number; fees: number }[];
}

/** Relatório por empresa, com detalhamento por motoboy. */
export async function getCompanyReport(
  filters: ReportFilters,
  user: SessionUser,
): Promise<CompanyReportRow[]> {
  const { where, params } = buildWhere(filters, user);

  const totals = await query<Record<string, string | number>>(
    `SELECT d.company_id, c.name AS company_name,
            COUNT(*) AS total,
            SUM(CASE WHEN d.status='delivered' THEN 1 ELSE 0 END) AS delivered,
            SUM(CASE WHEN d.status='cancelled' THEN 1 ELSE 0 END) AS cancelled,
            SUM(CASE WHEN d.status='customer_not_found' THEN 1 ELSE 0 END) AS customer_not_found,
            SUM(CASE WHEN d.status='pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN d.status='in_progress' THEN 1 ELSE 0 END) AS in_progress,
            COALESCE(SUM(d.fee_cents),0) AS fees_total,
            COALESCE(SUM(CASE WHEN d.status='delivered' THEN d.fee_cents ELSE 0 END),0) AS fees_delivered
       FROM deliveries d JOIN companies c ON c.id = d.company_id
       ${where}
      GROUP BY d.company_id
      ORDER BY c.name COLLATE NOCASE ASC`,
    params,
  );

  const byMotoboy = await query<Record<string, string | number>>(
    `SELECT d.company_id, d.motoboy_id, m.name AS motoboy_name,
            COUNT(*) AS total, COALESCE(SUM(d.fee_cents),0) AS fees
       FROM deliveries d JOIN motoboys m ON m.id = d.motoboy_id
       ${where}
      GROUP BY d.company_id, d.motoboy_id
      ORDER BY m.name COLLATE NOCASE ASC`,
    params,
  );

  return totals.map((t) => {
    const companyId = String(t.company_id);
    return {
      company_id: companyId,
      company_name: String(t.company_name),
      total: Number(t.total),
      delivered: Number(t.delivered),
      cancelled: Number(t.cancelled),
      customer_not_found: Number(t.customer_not_found),
      pending: Number(t.pending),
      in_progress: Number(t.in_progress),
      fees_total: Number(t.fees_total),
      fees_delivered: Number(t.fees_delivered),
      motoboys: byMotoboy
        .filter((m) => String(m.company_id) === companyId)
        .map((m) => ({
          motoboy_id: String(m.motoboy_id),
          motoboy_name: String(m.motoboy_name),
          total: Number(m.total),
          fees: Number(m.fees),
        })),
    };
  });
}

/** Série diária de corridas/taxas — usada em gráficos de relatório. */
export async function getDailySeries(filters: ReportFilters, user: SessionUser) {
  const { where, params } = buildWhere(filters, user);
  const rows = await query<{ day: string; total: number; delivered: number; fees: number }>(
    `SELECT substr(d.created_at, 1, 10) AS day,
            COUNT(*) AS total,
            SUM(CASE WHEN d.status='delivered' THEN 1 ELSE 0 END) AS delivered,
            COALESCE(SUM(d.fee_cents),0) AS fees
       FROM deliveries d ${where}
      GROUP BY day ORDER BY day ASC`,
    params,
  );
  return rows.map((r) => ({
    day: r.day,
    total: Number(r.total),
    delivered: Number(r.delivered),
    fees: Number(r.fees),
  }));
}

/* ---------------------------------------------------------------------------
 * Períodos pré-definidos (Diário / Semanal / Mensal / Anual)
 * -------------------------------------------------------------------------*/

export type PeriodKind = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface Period {
  from: string;
  to: string;
}

/** Calcula o intervalo (YYYY-MM-DD, fuso SP) para cada tipo de relatório. */
export function resolvePeriod(kind: PeriodKind, refDateKey?: string): Period {
  const key = refDateKey ?? localDateKey();
  const [y, m, d] = key.split('-').map(Number);
  const ref = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

  switch (kind) {
    case 'daily':
      return { from: key, to: key };
    case 'weekly': {
      // Semana de segunda a domingo.
      const dow = ref.getUTCDay(); // 0=domingo
      const offsetToMonday = dow === 0 ? -6 : 1 - dow;
      const monday = addDays(ref, offsetToMonday);
      const sunday = addDays(monday, 6);
      return { from: isoDayKey(monday), to: isoDayKey(sunday) };
    }
    case 'monthly': {
      const first = new Date(Date.UTC(y, m - 1, 1, 12));
      const last = new Date(Date.UTC(y, m, 0, 12));
      return { from: isoDayKey(first), to: isoDayKey(last) };
    }
    case 'yearly':
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    default:
      return { from: key, to: key };
  }
}

function isoDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Detalhamento linha a linha para impressão/exportação. */
export async function getReportDetailRows(
  filters: ReportFilters,
  user: SessionUser,
  limit = 5000,
) {
  const { where, params } = buildWhere(filters, user);
  return query<Record<string, string | number>>(
    `SELECT d.order_number, d.customer_name, d.status, d.fee_cents,
            d.created_at, d.delivered_at,
            c.name AS company_name, n.name AS neighborhood_name, m.name AS motoboy_name,
            u.name AS operator_name
       FROM deliveries d
       JOIN companies c     ON c.id = d.company_id
       JOIN neighborhoods n ON n.id = d.neighborhood_id
       JOIN motoboys m      ON m.id = d.motoboy_id
       LEFT JOIN users u    ON u.id = d.created_by
       ${where}
      ORDER BY d.created_at ASC
      LIMIT ?`,
    [...params, limit],
  );
}

export interface StatusBreakdown {
  status: DeliveryStatus;
  total: number;
  fees: number;
}

export async function getStatusBreakdown(
  filters: ReportFilters,
  user: SessionUser,
): Promise<StatusBreakdown[]> {
  const { where, params } = buildWhere(filters, user);
  const rows = await query<{ status: DeliveryStatus; total: number; fees: number }>(
    `SELECT d.status, COUNT(*) AS total, COALESCE(SUM(d.fee_cents),0) AS fees
       FROM deliveries d ${where}
      GROUP BY d.status`,
    params,
  );
  return rows.map((r) => ({
    status: r.status,
    total: Number(r.total),
    fees: Number(r.fees),
  }));
}
