import type { Metadata } from 'next';
import { PeriodReport } from '../_period-report';

export const metadata: Metadata = { title: 'Relatório Diário' };
export const dynamic = 'force-dynamic';

export default function DailyReportPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  return (
    <PeriodReport
      kind="daily"
      title="Relatório Diário"
      description="Consolidado do dia"
      searchParams={searchParams}
    />
  );
}
