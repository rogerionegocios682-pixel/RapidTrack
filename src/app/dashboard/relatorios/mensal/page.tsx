import type { Metadata } from 'next';
import { PeriodReport } from '../_period-report';

export const metadata: Metadata = { title: 'Relatório Mensal' };
export const dynamic = 'force-dynamic';

export default function MonthlyReportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <PeriodReport
      kind="monthly"
      title="Relatório Mensal"
      description="Consolidado do mês corrente"
      searchParams={searchParams}
    />
  );
}
