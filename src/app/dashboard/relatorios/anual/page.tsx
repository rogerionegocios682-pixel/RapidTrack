import type { Metadata } from 'next';
import { PeriodReport } from '../_period-report';

export const metadata: Metadata = { title: 'Relatório Anual' };
export const dynamic = 'force-dynamic';

export default function YearlyReportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <PeriodReport
      kind="yearly"
      title="Relatório Anual"
      description="Consolidado do ano corrente"
      searchParams={searchParams}
    />
  );
}
