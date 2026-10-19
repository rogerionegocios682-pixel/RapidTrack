import type { Metadata } from 'next';
import { PeriodReport } from '../_period-report';

export const metadata: Metadata = { title: 'Relatório Semanal' };
export const dynamic = 'force-dynamic';

export default function WeeklyReportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <PeriodReport
      kind="weekly"
      title="Relatório Semanal"
      description="Consolidado da semana (segunda a domingo)"
      searchParams={searchParams}
    />
  );
}
