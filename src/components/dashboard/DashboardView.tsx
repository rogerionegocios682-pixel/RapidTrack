import React, { useMemo } from 'react';
import {
  Send,
  Store,
  FileText,
  Building2,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  DollarSign,
  Award,
  Bike,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react';
import type { DeliveryOrder, DeliveryStore, Motoboy } from '../../types';
import { formatCurrency, formatDate } from '../../utils/formatters';
import type { ActivePage } from '../layout/Sidebar';

interface DashboardViewProps {
  orders: DeliveryOrder[];
  stores: DeliveryStore[];
  motoboys: Motoboy[];
  onNavigate: (page: ActivePage) => void;
  onOpenNewDispatch: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  orders,
  stores,
  motoboys,
  onNavigate,
  onOpenNewDispatch,
}) => {
  // Calculations based on rules
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const metrics = useMemo(() => {
    // Week bounds
    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let ordersToday = 0;
    let ordersWeek = 0;
    let ordersMonth = 0;
    let ordersPending = 0;
    let ordersCanceledPeriod = 0;
    let totalFinancialMonth = 0;

    orders.forEach((ord) => {
      const ordDate = new Date(ord.operationalDate + 'T00:00:00');

      // Today
      if (ord.operationalDate === todayStr) {
        ordersToday += 1;
      }

      // Week
      if (ordDate >= startOfWeek) {
        ordersWeek += 1;
      }

      // Month
      if (ordDate >= startOfMonth) {
        ordersMonth += 1;
        if (ord.status === 'completed') {
          totalFinancialMonth += ord.rate;
        }
      }

      // Pending
      if (ord.status === 'pending') {
        ordersPending += 1;
      }

      // Canceled
      if (ord.status === 'canceled') {
        ordersCanceledPeriod += 1;
      }
    });

    return {
      ordersToday,
      ordersWeek,
      ordersMonth,
      ordersPending,
      ordersCanceledPeriod,
      totalFinancialMonth,
    };
  }, [orders, todayStr]);

  // Top 3 Motoboys of the Day
  const top3Motoboys = useMemo(() => {
    const todayCompletedOrders = orders.filter(
      (o) => o.operationalDate === todayStr && o.status === 'completed'
    );

    const map: Record<string, { name: string; count: number; total: number; lastTime: string }> = {};

    todayCompletedOrders.forEach((o) => {
      if (!map[o.motoboyId]) {
        map[o.motoboyId] = {
          name: o.motoboyName,
          count: 0,
          total: 0,
          lastTime: o.completionTime || o.createdAt,
        };
      }
      map[o.motoboyId].count += 1;
      map[o.motoboyId].total += o.rate;
      if (o.completionTime && o.completionTime > map[o.motoboyId].lastTime) {
        map[o.motoboyId].lastTime = o.completionTime;
      }
    });

    const sorted = Object.entries(map).map(([id, d]) => ({
      motoboyId: id,
      name: d.name,
      count: d.count,
      total: d.total,
      lastTime: d.lastTime,
    }));

    // Secondary sorting criterion: date/time of last completed delivery
    sorted.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.lastTime.localeCompare(a.lastTime);
    });

    return sorted.slice(0, 3);
  }, [orders, todayStr]);

  // Daily evolution (last 7 days)
  const last7DaysData = useMemo(() => {
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayLabel = d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' });
      
      const dayOrders = orders.filter((o) => o.operationalDate === str);
      const completed = dayOrders.filter((o) => o.status === 'completed').length;
      const canceled = dayOrders.filter((o) => o.status === 'canceled').length;
      
      result.push({ date: str, label: dayLabel, total: dayOrders.length, completed, canceled });
    }
    return result;
  }, [orders]);

  // Distribution by Store
  const storeDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach((o) => {
      map[o.storeName] = (map[o.storeName] || 0) + 1;
    });
    const sorted = Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    return sorted.slice(0, 5);
  }, [orders]);

  // Distribution by Status
  const statusCounts = useMemo(() => {
    const counts = { completed: 0, pending: 0, canceled: 0, client_not_found: 0 };
    orders.forEach((o) => {
      if (counts[o.status] !== undefined) {
        counts[o.status] += 1;
      }
    });
    return counts;
  }, [orders]);

  return (
    <div className="space-y-6 pb-12">
      {/* Welcome & Fast Shortcuts Banner */}
      <div className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-[#0B192C] to-[#1E3E62] p-6 text-white shadow-xl sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-orange-500/20 px-2.5 py-0.5 text-[11px] font-bold text-orange-400 border border-orange-500/30">
              PAINEL OPERACIONAL
            </span>
            <span className="text-xs text-slate-300">Data Operacional: {formatDate(todayStr)}</span>
          </div>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
            Centro de Controle de Entregas
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            Acompanhe a produtividade dos motoboys, volumetria por loja e desfechos em tempo real.
          </p>
        </div>

        {/* Shortcuts Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onOpenNewDispatch}
            className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/30 hover:bg-orange-600 transition-all active:scale-95"
          >
            <Send className="h-4 w-4" />
            <span>Despachar Pedidos</span>
          </button>

          <button
            onClick={() => onNavigate('cadastros-motoboys')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
          >
            <Store className="h-3.5 w-3.5" />
            <span>Cadastros</span>
          </button>

          <button
            onClick={() => onNavigate('relatorios-lojas')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Relatórios</span>
          </button>

          <button
            onClick={() => onNavigate('empresa')}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Empresa</span>
          </button>
        </div>
      </div>

      {/* 6 Metric Indicators Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {/* 1. Hoje */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Corridas Hoje</span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">{metrics.ordersToday}</p>
          <p className="mt-1 text-[11px] text-slate-400">Total registrado hoje</p>
        </div>

        {/* 2. Semana */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Na Semana</span>
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">{metrics.ordersWeek}</p>
          <p className="mt-1 text-[11px] text-slate-400">Últimos 7 dias</p>
        </div>

        {/* 3. Mês */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">No Mês</span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <Store className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-slate-900">{metrics.ordersMonth}</p>
          <p className="mt-1 text-[11px] text-slate-400">Mês corrente</p>
        </div>

        {/* 4. Pendentes */}
        <div className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-950">Pendentes</span>
            <div className="rounded-lg bg-orange-500/20 p-2 text-orange-600">
              <Clock className="h-4 w-4 animate-spin" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-orange-600">{metrics.ordersPending}</p>
          <p className="mt-1 text-[11px] text-orange-700 font-medium">Aguardando entrega</p>
        </div>

        {/* 5. Canceladas */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Canceladas</span>
            <div className="rounded-lg bg-red-50 p-2 text-red-600">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-red-600">{metrics.ordersCanceledPeriod}</p>
          <p className="mt-1 text-[11px] text-slate-400">Com justificativa</p>
        </div>

        {/* 6. Total Financeiro Concluído */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-950">Faturamento Mês</span>
            <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-xl font-black text-emerald-700 truncate">
            {formatCurrency(metrics.totalFinancialMonth)}
          </p>
          <p className="mt-1 text-[11px] text-emerald-800 font-medium">Entregas concluídas</p>
        </div>
      </div>

      {/* Podium / Ranking do Dia */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="h-5 w-5 text-orange-500" />
              Pódio dos Motoboys — Destaques de Hoje ({formatDate(todayStr)})
            </h3>
            <p className="text-xs text-slate-500">
              Classificação calculada automaticamente por entregas concluídas no dia. Desempate por horário da última entrega.
            </p>
          </div>
          <button
            onClick={() => onNavigate('relatorios-ranking')}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 self-start sm:self-auto"
          >
            Ver ranking completo →
          </button>
        </div>

        {top3Motoboys.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
            {top3Motoboys.map((mb, index) => {
              const isFirst = index === 0;
              const isSecond = index === 1;
              const isThird = index === 2;

              let badgeBg = 'bg-amber-100 text-amber-800 border-amber-300';
              let badgeLabel = '1º LUGAR — OURO';
              let ringColor = 'border-amber-400';

              if (isSecond) {
                badgeBg = 'bg-slate-200 text-slate-800 border-slate-300';
                badgeLabel = '2º LUGAR — PRATA';
                ringColor = 'border-slate-300';
              } else if (isThird) {
                badgeBg = 'bg-amber-700/10 text-amber-900 border-amber-700/20';
                badgeLabel = '3º LUGAR — BRONZE';
                ringColor = 'border-amber-600/40';
              }

              return (
                <div
                  key={mb.motoboyId}
                  className={`relative flex flex-col justify-between rounded-xl border p-5 transition-all ${
                    isFirst
                      ? 'border-amber-300 bg-amber-50/40 shadow-md ring-2 ring-amber-400/30'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-black tracking-wide ${badgeBg}`}>
                      {badgeLabel}
                    </span>
                    <Bike className="h-5 w-5 text-slate-400" />
                  </div>

                  <div>
                    <h4 className="text-base font-extrabold text-slate-900 leading-tight">
                      {mb.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">Motoboy Oficial</p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-200/60 pt-3">
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500">Concluídas</span>
                      <p className="text-lg font-black text-emerald-600">{mb.count} entregas</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold text-slate-500">Valor Acumulado</span>
                      <p className="text-lg font-black text-slate-900">{formatCurrency(mb.total)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-10 text-center">
            <Bike className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm font-semibold text-slate-700">Nenhuma entrega concluída hoje ainda</p>
            <p className="text-xs text-slate-400 mt-1">
              Despache pedidos e confirme as entregas para visualizar o pódio do dia.
            </p>
          </div>
        )}
      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Evolução Diária (Últimos 7 dias) */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Evolução Diária das Corridas</h3>
              <p className="text-xs text-slate-500">Volume total e entregas concluídas nos últimos 7 dias</p>
            </div>
            <TrendingUp className="h-4 w-4 text-orange-500" />
          </div>

          <div className="h-48 flex items-end justify-between gap-2 pt-6 pb-2 border-b border-slate-100">
            {last7DaysData.map((d) => {
              const maxVal = Math.max(...last7DaysData.map((x) => x.total), 5);
              const heightPct = Math.round((d.total / maxVal) * 100);
              const completedPct = d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0;

              return (
                <div key={d.date} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="text-[10px] font-bold text-slate-700 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {d.total}
                  </div>
                  <div className="w-full max-w-[36px] bg-slate-100 rounded-t-lg overflow-hidden flex flex-col justify-end" style={{ height: `${Math.max(heightPct, 8)}%` }}>
                    <div
                      className="bg-emerald-500 w-full transition-all"
                      style={{ height: `${completedPct}%` }}
                      title={`Concluídas: ${d.completed} de ${d.total}`}
                    />
                  </div>
                  <span className="mt-2 text-[10px] font-medium text-slate-500 truncate w-full text-center">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-center gap-6 text-xs text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-emerald-500" />
              <span>Concluídas</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-slate-200" />
              <span>Pendentes / Outros</span>
            </div>
          </div>
        </div>

        {/* Chart 2: Distribuição por Situação Operacional */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Distribuição por Situação Operacional</h3>
              <p className="text-xs text-slate-500">Status de todas as corridas registradas no sistema</p>
            </div>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>

          <div className="space-y-3.5 pt-2">
            {/* Concluídas */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-emerald-700 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Concluídas com Sucesso
                </span>
                <span className="text-slate-900 font-bold">{statusCounts.completed}</span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${orders.length > 0 ? (statusCounts.completed / orders.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Pendentes */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-blue-700 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Em Andamento / Pendentes
                </span>
                <span className="text-slate-900 font-bold">{statusCounts.pending}</span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${orders.length > 0 ? (statusCounts.pending / orders.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Canceladas */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-red-700 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  Corridas Canceladas
                </span>
                <span className="text-slate-900 font-bold">{statusCounts.canceled}</span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-red-500 rounded-full"
                  style={{
                    width: `${orders.length > 0 ? (statusCounts.canceled / orders.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Cliente Não Encontrado */}
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="text-amber-700 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Cliente Não Encontrado (Ocorrências)
                </span>
                <span className="text-slate-900 font-bold">{statusCounts.client_not_found}</span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{
                    width: `${orders.length > 0 ? (statusCounts.client_not_found / orders.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
