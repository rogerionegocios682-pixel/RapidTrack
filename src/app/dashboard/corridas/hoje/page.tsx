import type { Metadata } from 'next';
import Link from 'next/link';
import { Bike, CalendarDays, Plus, Receipt } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { listDeliveries } from '@/lib/repo/deliveries';
import { getDashboardStats } from '@/lib/repo/deliveries';
import { PageHeader, StatCard } from '@/components/stat-card';
import { DeliveryStatusBadge, EmptyState } from '@/components/ui';
import { DeliveryRowActions } from '../row-actions';
import { formatMoney, formatTime, localDateKey, formatDayKey } from '@/lib/format';

export const metadata: Metadata = { title: 'Corridas do Dia' };
export const dynamic = 'force-dynamic';

export default async function TodayDeliveriesPage() {
  const user = await requirePermission('deliveries.view');
  const dateKey = localDateKey();

  const [rows, stats] = await Promise.all([
    listDeliveries({ dateKey, status: 'all', limit: 500 }, user),
    getDashboardStats(user),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Corridas do Dia"
        description={`Movimentação de ${formatDayKey(dateKey)} — atualização em tempo real.`}
        action={
          <Link href="/dashboard/corridas/nova" className="btn-primary">
            <Plus className="h-4 w-4" /> NOVA CORRIDA
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total do dia"
          value={stats.total}
          icon={<CalendarDays className="h-4 w-4" />}
          tone="brand"
        />
        <StatCard
          label="Em aberto"
          value={stats.dispatched + stats.inProgress + stats.pending}
          icon={<Bike className="h-4 w-4" />}
          tone="warning"
        />
        <StatCard
          label="Entregues"
          value={stats.delivered}
          icon={<CalendarDays className="h-4 w-4" />}
          tone="success"
        />
        <StatCard
          label="Taxas do dia"
          value={formatMoney(stats.feesToday)}
          icon={<Receipt className="h-4 w-4" />}
          tone="muted"
        />
      </div>

      <section className="card overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-8 w-8" />}
            title="Nenhuma corrida hoje"
            message="Ainda não há corridas registradas para o dia de hoje."
            action={
              <Link href="/dashboard/corridas/nova" className="btn-primary">
                <Plus className="h-4 w-4" /> NOVA CORRIDA
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Empresa</th>
                  <th>Bairro</th>
                  <th>Motoboy</th>
                  <th>Taxa</th>
                  <th>Status</th>
                  <th>Hora</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td className="font-semibold text-ink-900">#{d.order_number}</td>
                    <td className="max-w-[200px] truncate" title={d.customer_name}>
                      {d.customer_name}
                    </td>
                    <td className="max-w-[180px] truncate" title={d.company_name}>
                      {d.company_name}
                    </td>
                    <td className="max-w-[160px] truncate" title={d.neighborhood_name}>
                      {d.neighborhood_name}
                    </td>
                    <td className="max-w-[160px] truncate">
                      <span className="inline-flex items-center gap-1.5">
                        <Bike className="h-3.5 w-3.5 text-ink-400" />
                        {d.motoboy_name}
                      </span>
                    </td>
                    <td className="whitespace-nowrap font-medium">
                      {formatMoney(d.fee_cents)}
                    </td>
                    <td>
                      <DeliveryStatusBadge status={d.status} />
                    </td>
                    <td className="whitespace-nowrap text-xs text-ink-500">
                      {formatTime(d.created_at)}
                    </td>
                    <td>
                      <DeliveryRowActions
                        delivery={{
                          id: d.id,
                          order_number: d.order_number,
                          status: d.status,
                          company_id: d.company_id,
                          customer_name: d.customer_name,
                          neighborhood_id: d.neighborhood_id,
                          motoboy_id: d.motoboy_id,
                          fee_cents: d.fee_cents,
                          notes: d.notes,
                        }}
                        user={{ role: user.role, motoboy_id: user.motoboy_id }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
