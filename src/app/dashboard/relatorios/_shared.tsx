import Link from 'next/link';
import { Printer } from 'lucide-react';
import { PageHeader, StatCard } from '@/components/stat-card';
import { DailySeriesChart } from '@/components/charts';
import { formatMoney, formatDayKey } from '@/lib/format';
import type { ReportSummary } from '@/lib/repo/reports';

/**
 * Componentes compartilhados das telas de Relatórios.
 * Mantêm o mesmo cabeçalho, cartões de resumo e gráfico em todos os períodos,
 * para que cada página cuide apenas dos filtros e da tabela específica.
 */

export function ReportHeader({
  title,
  description,
  from,
  to,
}: {
  title: string;
  description: string;
  from: string;
  to: string;
}) {
  return (
    <PageHeader
      title={title}
      description={`${description} · Período de ${formatDayKey(from)} a ${formatDayKey(to)}.`}
      action={
        <Link href="#imprimir" className="btn-secondary no-print" prefetch={false}>
          <Printer className="h-4 w-4" /> IMPRIMIR
        </Link>
      }
    />
  );
}

/** Cartões de resumo do período (mesmos indicadores em todos os relatórios). */
export function ReportSummaryCards({ summary }: { summary: ReportSummary }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      <StatCard label="Total de corridas" value={summary.total} tone="brand" />
      <StatCard label="Entregues" value={summary.delivered} tone="success" />
      <StatCard label="Canceladas" value={summary.cancelled} tone="danger" />
      <StatCard label="Não encontrado" value={summary.customerNotFound} tone="warning" />
      <StatCard
        label="Taxas totais"
        value={formatMoney(summary.feesTotal)}
        hint={`Entregues: ${formatMoney(summary.feesDelivered)}`}
        tone="warning"
      />
      <StatCard label="Ticket médio" value={formatMoney(summary.averageTicket)} tone="default" />
    </div>
  );
}

/** Gráfico de evolução diária do período. */
export function ReportEvolution({
  data,
}: {
  data: { day: string; total: number; delivered: number; fees: number }[];
}) {
  return (
    <div className="no-print">
      <DailySeriesChart data={data} />
    </div>
  );
}
