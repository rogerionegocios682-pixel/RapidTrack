import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { getCompanyReport, resolvePeriod, getReportSummary } from '@/lib/repo/reports';
import { listActiveCompanies } from '@/lib/repo/companies';
import { Section } from '@/components/stat-card';
import { SelectFilter, ClearFilters } from '@/components/page-tools';
import { EmptyState } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { ReportHeader, ReportSummaryCards } from '../_shared';

export const metadata: Metadata = { title: 'Relatório por Empresa' };
export const dynamic = 'force-dynamic';

export default async function CompanyReportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermission('reports.view');

  const read = (key: string) => {
    const v = searchParams[key];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };

  // Padrão: mês corrente.
  const period = resolvePeriod('monthly');
  const filters = {
    from: period.from,
    to: period.to,
    companyId: read('empresa') || undefined,
  };

  const [rows, summary, companies] = await Promise.all([
    getCompanyReport(filters, user),
    getReportSummary(filters, user),
    listActiveCompanies(),
  ]);

  return (
    <div className="space-y-5" id="imprimir">
      <ReportHeader
        title="Relatório por Empresa"
        description="Volume e faturamento por empresa cliente no mês corrente"
        from={period.from}
        to={period.to}
      />

      <div className="card card-pad no-print">
        <div className="flex flex-wrap items-center gap-3">
          <SelectFilter
            paramName="empresa"
            label="Empresa"
            allLabel="Todas as empresas"
            options={companies.map((c) => ({ value: c.id, label: c.name }))}
          />
          <ClearFilters />
        </div>
      </div>

      <ReportSummaryCards summary={summary} />

      {rows.length === 0 ? (
        <Section>
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title="Sem corridas no período"
            message="Nenhuma empresa teve corridas registradas no mês corrente."
          />
        </Section>
      ) : (
        <div className="space-y-4">
          {rows.map((c) => (
            <Section
              key={c.company_id}
              title={c.company_name}
              description={`${c.total} corrida(s) · ${formatMoney(c.fees_total)} em taxas`}
              action={
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="badge bg-emerald-50 text-emerald-700 ring-emerald-200">
                    {c.delivered} entregues
                  </span>
                  <span className="badge bg-brand-50 text-brand-700 ring-brand-200">
                    {c.in_progress} em andamento
                  </span>
                  <span className="badge bg-ink-100 text-ink-600 ring-ink-200">
                    {c.pending} aguardando
                  </span>
                  <span className="badge bg-rose-50 text-rose-700 ring-rose-200">
                    {c.cancelled} canceladas
                  </span>
                </div>
              }
            >
              {c.motoboys.length > 0 && (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Motoboy</th>
                        <th>Corridas</th>
                        <th>Taxas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.motoboys.map((m) => (
                        <tr key={m.motoboy_id}>
                          <td className="font-medium text-ink-800">{m.motoboy_name}</td>
                          <td>{m.total}</td>
                          <td className="font-medium">{formatMoney(m.fees)}</td>
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
