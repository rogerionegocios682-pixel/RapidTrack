import { requirePermission } from '@/lib/auth';
import { listActiveCompanies } from '@/lib/repo/companies';
import { listActiveMotoboys } from '@/lib/repo/motoboys';
import { listNeighborhoods } from '@/lib/repo/neighborhoods';
import {
  getReportSummary,
  getDailySeries,
  getCompanyReport,
  getMotoboyReport,
  resolvePeriod,
  type PeriodKind,
} from '@/lib/repo/reports';
import { SelectFilter, ClearFilters } from '@/components/page-tools';
import { Section } from '@/components/stat-card';
import { formatMoney } from '@/lib/format';
import { DELIVERY_STATUS_LABEL, type DeliveryStatus } from '@/lib/types';
import { ReportEvolution, ReportHeader, ReportSummaryCards } from './_shared';
import { getStatusBreakdown } from '@/lib/repo/reports';

/**
 * Relatório consolidado de um período (Diário/Semanal/Mensal/Anual).
 * ---------------------------------------------------------------------------
 * Reúne resumo, evolução diária e o detalhamento por empresa e por motoboy,
 * reaproveitando o mesmo corpo em todas as telas de período. Os filtros
 * opcionais (empresa, motoboy, bairro) vêm da URL.
 */
export async function PeriodReport({
  kind,
  title,
  description,
  searchParams,
}: {
  kind: PeriodKind;
  title: string;
  description: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermission('reports.view');

  const read = (key: string) => {
    const v = searchParams[key];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };

  const period = resolvePeriod(kind);
  const filters = {
    from: period.from,
    to: period.to,
    companyId: read('empresa') || undefined,
    motoboyId: read('motoboy') || undefined,
    neighborhoodId: read('bairro') || undefined,
  };

  const [summary, series, byCompany, byMotoboy, byStatus, companies, motoboys, neighborhoods] =
    await Promise.all([
      getReportSummary(filters, user),
      getDailySeries(filters, user),
      getCompanyReport(filters, user),
      getMotoboyReport(filters, user),
      getStatusBreakdown(filters, user),
      listActiveCompanies(),
      listActiveMotoboys(),
      listNeighborhoods({ status: 'active' }),
    ]);

  return (
    <div className="space-y-5" id="imprimir">
      <ReportHeader title={title} description={description} from={period.from} to={period.to} />

      {/* Filtros */}
      <div className="card card-pad no-print">
        <div className="flex flex-wrap items-center gap-3">
          <SelectFilter
            paramName="empresa"
            label="Empresa"
            allLabel="Todas as empresas"
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
          />
          <SelectFilter
            paramName="motoboy"
            label="Motoboy"
            allLabel="Todos os motoboys"
            options={motoboys.map((m) => ({ value: m.id, label: m.name }))}
          />
          <SelectFilter
            paramName="bairro"
            label="Bairro"
            allLabel="Todos os bairros"
            options={neighborhoods.map((n) => ({ value: n.id, label: `${n.name} (${n.city})` }))}
          />
          <ClearFilters />
        </div>
      </div>

      <ReportSummaryCards summary={summary} />

      {series.length > 0 && <ReportEvolution data={series} />}

      {/* Detalhamento por status */}
      <Section title="Distribuição por status" description="Corridas e taxas por situação">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Corridas</th>
                <th>Taxas</th>
              </tr>
            </thead>
            <tbody>
              {byStatus.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-ink-400">
                    Sem dados no período.
                  </td>
                </tr>
              ) : (
                byStatus.map((s) => (
                  <tr key={s.status}>
                    <td className="font-medium text-ink-800">
                      {DELIVERY_STATUS_LABEL[s.status as DeliveryStatus]}
                    </td>
                    <td>{s.total}</td>
                    <td className="font-medium">{formatMoney(s.fees)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Detalhamento por empresa */}
      <Section title="Por empresa" description="Corridas e taxas agrupadas por empresa cliente">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Total</th>
                <th>Entregues</th>
                <th>Canceladas</th>
                <th>Não encontrado</th>
                <th>Taxas totais</th>
                <th>Taxas entregues</th>
              </tr>
            </thead>
            <tbody>
              {byCompany.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-ink-400">
                    Sem dados no período.
                  </td>
                </tr>
              ) : (
                byCompany.map((c) => (
                  <tr key={c.company_id}>
                    <td className="font-medium text-ink-900">{c.company_name}</td>
                    <td>{c.total}</td>
                    <td>{c.delivered}</td>
                    <td>{c.cancelled}</td>
                    <td>{c.customer_not_found}</td>
                    <td className="font-medium">{formatMoney(c.fees_total)}</td>
                    <td>{formatMoney(c.fees_delivered)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Detalhamento por motoboy */}
      <Section title="Por motoboy" description="Desempenho de cada motoboy no período">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Motoboy</th>
                <th>Total</th>
                <th>Entregues</th>
                <th>Canceladas</th>
                <th>Não encontrado</th>
                <th>Taxas totais</th>
                <th>Taxas entregues</th>
              </tr>
            </thead>
            <tbody>
              {byMotoboy.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-ink-400">
                    Sem dados no período.
                  </td>
                </tr>
              ) : (
                byMotoboy.map((m) => (
                  <tr key={m.motoboy_id}>
                    <td className="font-medium text-ink-900">{m.motoboy_name}</td>
                    <td>{m.total}</td>
                    <td>{m.delivered}</td>
                    <td>{m.cancelled}</td>
                    <td>{m.customer_not_found}</td>
                    <td className="font-medium">{formatMoney(m.fees_total)}</td>
                    <td>{formatMoney(m.fees_delivered)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
