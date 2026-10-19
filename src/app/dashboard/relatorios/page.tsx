import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BarChart3,
  Bike,
  Building2,
  CalendarDays,
  CalendarRange,
  FileBarChart,
  Gauge,
} from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { PageHeader } from '@/components/stat-card';

export const metadata: Metadata = { title: 'Relatórios' };
export const dynamic = 'force-dynamic';

const REPORTS = [
  {
    href: '/dashboard/relatorios/diario',
    title: 'Diário',
    description: 'Consolidado do dia corrente.',
    icon: <CalendarDays className="h-5 w-5" />,
  },
  {
    href: '/dashboard/relatorios/semanal',
    title: 'Semanal',
    description: 'Semana de segunda a domingo.',
    icon: <CalendarRange className="h-5 w-5" />,
  },
  {
    href: '/dashboard/relatorios/mensal',
    title: 'Mensal',
    description: 'Consolidado do mês corrente.',
    icon: <Gauge className="h-5 w-5" />,
  },
  {
    href: '/dashboard/relatorios/anual',
    title: 'Anual',
    description: 'Consolidado do ano corrente.',
    icon: <FileBarChart className="h-5 w-5" />,
  },
  {
    href: '/dashboard/relatorios/motoboy',
    title: 'Por Motoboy',
    description: 'Desempenho individual de cada motoboy.',
    icon: <Bike className="h-5 w-5" />,
  },
  {
    href: '/dashboard/relatorios/empresa',
    title: 'Por Empresa',
    description: 'Volume e faturamento por empresa cliente.',
    icon: <Building2 className="h-5 w-5" />,
  },
];

export default async function ReportsIndexPage() {
  await requirePermission('reports.view');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Relatórios"
        description="Escolha o período ou o agrupamento que deseja analisar."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="card card-pad flex items-start gap-3 transition hover:shadow-pop"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
              {r.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-900">{r.title}</p>
              <p className="mt-0.5 text-xs text-ink-500">{r.description}</p>
            </div>
            <BarChart3 className="ml-auto h-4 w-4 shrink-0 text-ink-300" />
          </Link>
        ))}
      </div>
    </div>
  );
}
