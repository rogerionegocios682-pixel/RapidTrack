import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth';
import { getMotoboyReport, resolvePeriod, getReportSummary } from '@/lib/repo/reports';
import { listActiveMotoboys } from '@/lib/repo/motoboys';
import { Section } from '@/components/stat-card';
import { SelectFilter, ClearFilters } from '@/components/page-tools';
import { EmptyState } from '@/components/ui';
import { MotoboyFeesChart } from '@/components/charts';
import { formatMoney } from '@/lib/format';
import { Bike } from 'lucide-react';
import { ReportHeader, ReportSummaryCards } from '../_shared';

export const metadata: Metadata = { title: 'Relatório por Motoboy' };
export const dynamic = 'force-dynamic';

export default async function MotoboyReportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermission('reports.view');

  const read = (key: string) => {
    const v = searchParams[key];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };

  // Padrão: mês corrente (dá uma visão representativa por motoboy).
  const period = resolvePeriod('monthly');
  const filters = {
    from: period.from,
    to: period.to,
    motoboyId: read('motoboy') || undefined,
    companyId: read('empresa') || undefined,
  };

  const [rows, summary, motoboys] = await Promise.all([
    getMotoboyReport(filters, user),
    getReportSummary(filters, user),
    listActiveMotoboys(),
  ]);

  const chartData = rows.map((r) => ({
    name: r.motoboy_name,
    fees: r.fees_total,
    total: r.total,
  }));

  return (
    <div className="space-y-5" id="imprimir">
      <ReportHeader
        title="Relatório por Motoboy"
        description="Desempenho individual no mês corrente"
        from={period.from}
        to={period.to}
      />

      <div className="card card-pad no-print">
        <div className="flex flex-wrap items-center gap-3">
          <SelectFilter
            paramName="motoboy"
            label="Motoboy"
            allLabel="Todos os motoboys"
            options={motoboys.map((m) => ({ value: m.id, label: m.name }))}
          />
          <ClearFilters />
        </div>
      </div>

      <ReportSummaryCards summary={summary} />

      {chartData.length > 0 && (
        <div className="no-print">
          <MotoboyFeesChart data={chartData} />
        </div>
      )}

      {rows.length === 0 ? (
        <Section>
          <EmptyState
            icon={<Bike className="h-8 w-8" />}
            title="Sem corridas no período"
            message="Nenhum motoboy teve corridas registradas no mês corrente."
          />
        </Section>
      ) : (
        <div className="space-y-4">
          {rows.map((m) => (
            <Section
              key={m.motoboy_id}
              title={m.motoboy_name}
              description={`${m.total} corrida(s) · ${formatMoney(m.fees_total)} em taxas`}
              action={
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200">
                    {m.delivered} entregues
                  </span>
                  <span className="badge bg-rose-50 text-rose-700 ring-rose-200">
                    {m.cancelled} canceladas
                  </span>
                  <span className="badge bg-orange-50 text-orange-700 ring-orange-200">
                    {m.customer_not_found} não encontrado
                  </span>
                </div>
              }
            >
              {m.companies.length > 0 && (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Empresa</th>
                        <th>Corridas</th>
                        <th>Taxas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.companies.map((c) => (
                        <tr key={c.company_id}>
                          <td className="font-medium text-ink-800">{c.company_name}</td>
                          <td>{c.total}</td>
                          <td className="font-medium">{formatMoney(c.fees)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          ))}
        </div>
      )}
    </div>
  );
}
