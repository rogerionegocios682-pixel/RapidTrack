import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  Ban,
  Bike,
  Building2,
  CheckCircle2,
  Clock,
  Package,
  Plus,
  Receipt,
  Send,
  UserX,
  Zap,
} from 'lucide-react';
import { requireUser } from '@/lib/auth';
import {
  getDashboardCharts,
  getDashboardStats,
  getRecentDeliveries,
} from '@/lib/repo/deliveries';
import { StatCard } from '@/components/stat-card';
import {
  DeliveriesByCompanyChart,
  DeliveriesByMotoboyChart,
  FeesByNeighborhoodChart,
  StatusPieChart,
} from '@/components/charts';
import { DeliveryStatusBadge, EmptyState } from '@/components/ui';
import { MotoboyPodium } from '@/components/motoboy-podium';
import { formatMoney, formatTime, formatDate, localDateKey } from '@/lib/utils';

export const metadata: Metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requireUser();

  // Todos os números abaixo vêm do banco — nada é fixo.
  const [stats, charts, recent] = await Promise.all([
    getDashboardStats(user),
    getDashboardCharts(user),
    getRecentDeliveries(user, 8),
  ]);

  const isMotoboy = user.role === 'motoboy';
  const hoje = formatDate(`${localDateKey()}T12:00:00Z`);

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">
            Olá, {user.name.split(' ')[0]}!
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            {isMotoboy
              ? 'Aqui está o resumo das suas corridas de hoje.'
              : `Visão geral da operação em ${hoje}. Atualização em tempo real.`}
          </p>
        </div>
        {!isMotoboy && (
          <Link href="/dashboard/corridas/nova" className="btn-primary">
            <Plus className="h-4 w-4" /> NOVA CORRIDA
          </Link>
        )}
      </div>

      {/* ===================== CORRIDAS DE HOJE ===================== */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-600">
            Corridas de hoje
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Total de corridas"
            value={stats.total}
            icon={<Package className="h-4 w-4" />}
            tone="brand"
            href="/dashboard/corridas/hoje"
          />
          <StatCard
            label="Despachadas"
            value={stats.dispatched}
            icon={<Send className="h-4 w-4" />}
            tone="default"
          />
          <StatCard
            label="Em andamento"
            value={stats.inProgress}
            icon={<Zap className="h-4 w-4" />}
            tone="warning"
          />
          <StatCard
            label="Entregues"
            value={stats.delivered}
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="success"
          />
          <StatCard
            label="Canceladas"
            value={stats.cancelled}
            icon={<Ban className="h-4 w-4" />}
            tone="danger"
          />
          <StatCard
            label="Cliente não encontrado"
            value={stats.customerNotFound}
            icon={<UserX className="h-4 w-4" />}
            tone="warning"
          />
        </div>
      </section>

      {/* ===================== TAXAS ===================== */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <Receipt className="h-4 w-4 text-accent-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-600">
            Taxas do dia
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total de taxas do dia"
            value={formatMoney(stats.feesToday)}
            hint={`${stats.total} corrida(s) registrada(s)`}
            icon={<Receipt className="h-4 w-4" />}
            tone="warning"
          />
          <StatCard
            label="Taxas das concluídas"
            value={formatMoney(stats.feesDelivered)}
            hint={`${stats.delivered} corrida(s) entregue(s)`}
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="success"
          />
          <StatCard
            label="Aguardando despacho"
            value={stats.pending}
            hint="Corridas criadas, ainda não despachadas"
            icon={<Clock className="h-4 w-4" />}
            tone="muted"
          />
          <StatCard
            label="Ticket médio"
            value={formatMoney(stats.total > 0 ? Math.round(stats.feesToday / stats.total) : 0)}
            hint="Média por corrida do dia"
            icon={<Receipt className="h-4 w-4" />}
            tone="default"
          />
        </div>
      </section>

      {/* ===================== MOTOBOYS + EMPRESAS ===================== */}
      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Bike className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-600">
              Motoboys
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label="Ativos"
              value={stats.motoboysActive}
              icon={<Bike className="h-4 w-4" />}
              href={isMotoboy ? undefined : '/dashboard/cadastro/motoboys'}
            />
            <StatCard
              label="Em corrida"
              value={stats.motoboysOnDelivery}
              tone="warning"
              icon={<Zap className="h-4 w-4" />}
            />
            <StatCard
              label="Disponíveis"
              value={stats.motoboysAvailable}
              tone="success"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-600">
              Empresas
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Cadastradas"
              value={stats.companiesTotal}
              icon={<Building2 className="h-4 w-4" />}
              href="/dashboard/cadastro/empresas"
            />
            <StatCard
              label="Ativas"
              value={stats.companiesActive}
              tone="success"
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
          </div>
        </section>
      </div>

      {/* ===================== GRÁFICOS ===================== */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-ink-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-600">
            Análise visual do dia
          </h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <DeliveriesByCompanyChart data={charts.byCompany} />
          <DeliveriesByMotoboyChart data={charts.byMotoboy} />
          <StatusPieChart data={charts.byStatus} />
          <FeesByNeighborhoodChart data={charts.byNeighborhood} />
        </div>
      </section>

      {/* ===================== PÓDIO DOS MOTOBOYS ===================== */}
      <section className="card">
        <header className="flex items-center justify-between border-b border-ink-100 p-4 sm:p-5">
          <div>
            <h2 className="card-title">Destaques do dia</h2>
            <p className="card-sub mt-0.5">
              Ranking por entregas concluídas hoje
            </p>
          </div>
        </header>
        <MotoboyPodium data={charts.byMotoboy} />
      </section>

      {/* ===================== ATIVIDADE RECENTE ===================== */}
      <section className="card">
        <header className="flex items-center justify-between border-b border-ink-100 p-4 sm:p-5">
          <div>
            <h2 className="card-title">Atividade recente</h2>
            <p className="card-sub mt-0.5">Últimas movimentações das corridas</p>
          </div>
          <Link href="/dashboard/corridas" className="btn-secondary btn-sm">
            Ver todas
          </Link>
        </header>

        {recent.length === 0 ? (
          <EmptyState
            icon={<Package className="h-10 w-10" />}
            title="Nenhuma corrida registrada ainda"
            message={
              isMotoboy
                ? 'Quando você receber corridas, elas aparecerão aqui.'
                : 'Cadastre a primeira corrida para começar a acompanhar a operação.'
            }
            action={
              !isMotoboy ? (
                <Link href="/dashboard/corridas/nova" className="btn-primary">
                  <Plus className="h-4 w-4" /> NOVA CORRIDA
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {recent.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-3 p-4 transition hover:bg-brand-50/40 sm:p-4"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <Package className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">
                    #{d.order_number} · {d.customer_name}
                  </p>
                  <p className="truncate text-xs text-ink-500">
                    {d.company_name} · {d.neighborhood_name} · {d.motoboy_name}
                  </p>
                </div>
                <span className="text-sm font-semibold text-ink-800">
                  {formatMoney(d.fee_cents)}
                </span>
                <DeliveryStatusBadge status={d.status} />
                <span className="w-full text-xs text-ink-400 sm:w-auto">
                  {formatTime(d.updated_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
