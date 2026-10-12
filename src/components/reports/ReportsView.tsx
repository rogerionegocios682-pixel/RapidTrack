import React, { useState, useMemo } from 'react';
import {
  FileText,
  Download,
  Filter,
  Calendar,
  Store,
  Bike,
  Award,
  History,
  DollarSign,
  Printer,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  generateMotoboyReportPdf,
  generateStoreReportPdf,
  generateShiftClosingPdf,
} from '../../services/pdfGenerator';
import type {
  DeliveryOrder,
  DeliveryStore,
  Motoboy,
  ShiftClosing,
} from '../../types';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  maskCpfRedacted,
  getTodayOperationalDate,
} from '../../utils/formatters';

interface ReportsViewProps {
  initialSubTab?: 'lojas' | 'motoboys' | 'mensal' | 'ranking' | 'fechamentos';
  orders: DeliveryOrder[];
  stores: DeliveryStore[];
  motoboys: Motoboy[];
  shiftClosings: ShiftClosing[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  initialSubTab = 'lojas',
  orders,
  stores,
  motoboys,
  shiftClosings,
}) => {
  const { companySettings, userProfile } = useAuth();
  const [subTab, setSubTab] = useState<'lojas' | 'motoboys' | 'mensal' | 'ranking' | 'fechamentos'>(initialSubTab);

  // Period Filters
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  type PeriodType = 'today' | 'week' | 'month' | 'month_select' | 'custom';
  const [periodType, setPeriodType] = useState<PeriodType>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>(`${currentYear}-${currentMonth}`);
  const [startDate, setStartDate] = useState<string>(`${currentYear}-${currentMonth}-01`);
  const [endDate, setEndDate] = useState<string>(getTodayOperationalDate());

  // Entity Filters
  const [selectedMotoboyId, setSelectedMotoboyId] = useState<string>(motoboys[0]?.id || '');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');

  // Compute Active Period Date Bounds
  const activeDateRange = useMemo(() => {
    if (periodType === 'today') {
      const today = getTodayOperationalDate();
      return { start: today, end: today, label: `Hoje (${formatDate(today)})` };
    }
    if (periodType === 'week') {
      const d = new Date();
      d.setDate(now.getDate() - 7);
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const end = getTodayOperationalDate();
      return { start, end, label: `Últimos 7 dias (${formatDate(start)} a ${formatDate(end)})` };
    }
    if (periodType === 'month') {
      const start = `${currentYear}-${currentMonth}-01`;
      const end = getTodayOperationalDate();
      return { start, end, label: `Mês Corrente (${currentMonth}/${currentYear})` };
    }
    if (periodType === 'month_select') {
      const [y, m] = selectedMonth.split('-');
      const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
      const start = `${y}-${m}-01`;
      const end = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
      return { start, end, label: `Mês ${m}/${y} (${formatDate(start)} a ${formatDate(end)})` };
    }
    return {
      start: startDate,
      end: endDate,
      label: `Personalizado (${formatDate(startDate)} a ${formatDate(endDate)})`,
    };
  }, [periodType, selectedMonth, startDate, endDate, currentYear, currentMonth]);

  // Orders matching period
  const periodOrders = useMemo(() => {
    return orders.filter((o) => {
      return o.operationalDate >= activeDateRange.start && o.operationalDate <= activeDateRange.end;
    });
  }, [orders, activeDateRange]);

  // Export to CSV
  const exportToCsv = (filename: string, rows: any[][], headers: string[]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Relatório por Loja
  const storeReportData = useMemo(() => {
    return stores.map((st) => {
      const storeOrders = periodOrders.filter((o) => o.storeId === st.id);
      const completed = storeOrders.filter((o) => o.status === 'completed');
      const canceled = storeOrders.filter((o) => o.status === 'canceled');
      const notFound = storeOrders.filter((o) => o.status === 'client_not_found');
      const pending = storeOrders.filter((o) => o.status === 'pending');
      const financial = completed.reduce((acc, curr) => acc + curr.rate, 0);

      // Neighborhood breakdown
      const neighMap: Record<string, number> = {};
      completed.forEach((o) => {
        neighMap[o.neighborhood] = (neighMap[o.neighborhood] || 0) + 1;
      });

      return {
        store: st,
        total: storeOrders.length,
        completed: completed.length,
        canceled: canceled.length,
        notFound: notFound.length,
        pending: pending.length,
        financial,
        neighborhoods: neighMap,
      };
    });
  }, [stores, periodOrders]);

  // 2. Relatório por Motoboy Individual
  const motoboyReportData = useMemo(() => {
    const targetMb = motoboys.find((m) => m.id === selectedMotoboyId);
    if (!targetMb) return null;

    const mbOrders = periodOrders.filter((o) => o.motoboyId === targetMb.id);
    const completed = mbOrders.filter((o) => o.status === 'completed');
    const canceled = mbOrders.filter((o) => o.status === 'canceled');
    const notFound = mbOrders.filter((o) => o.status === 'client_not_found');
    const financial = completed.reduce((acc, curr) => acc + curr.rate, 0);

    // Grouping by Store
    const byStore: Record<string, { count: number; amount: number }> = {};
    completed.forEach((o) => {
      if (!byStore[o.storeName]) byStore[o.storeName] = { count: 0, amount: 0 };
      byStore[o.storeName].count += 1;
      byStore[o.storeName].amount += o.rate;
    });

    // Grouping by Neighborhood
    const byNeighborhood: Record<string, { count: number; amount: number }> = {};
    completed.forEach((o) => {
      if (!byNeighborhood[o.neighborhood]) byNeighborhood[o.neighborhood] = { count: 0, amount: 0 };
      byNeighborhood[o.neighborhood].count += 1;
      byNeighborhood[o.neighborhood].amount += o.rate;
    });

    return {
      motoboy: targetMb,
      totalReceived: mbOrders.length,
      completedCount: completed.length,
      canceledCount: canceled.length,
      notFoundCount: notFound.length,
      totalFinancial: financial,
      byStore,
      byNeighborhood,
      orders: mbOrders,
    };
  }, [motoboys, selectedMotoboyId, periodOrders]);

  // 3. Ranking de Motoboys
  const rankingData = useMemo(() => {
    const map: Record<string, { motoboy: Motoboy; count: number; total: number; lastTime: string }> = {};

    motoboys.forEach((m) => {
      map[m.id] = { motoboy: m, count: 0, total: 0, lastTime: '' };
    });

    const completed = periodOrders.filter((o) => o.status === 'completed');
    completed.forEach((o) => {
      if (map[o.motoboyId]) {
        map[o.motoboyId].count += 1;
        map[o.motoboyId].total += o.rate;
        if (o.completionTime && o.completionTime > map[o.motoboyId].lastTime) {
          map[o.motoboyId].lastTime = o.completionTime;
        }
      }
    });

    const list = Object.values(map);
    list.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.lastTime.localeCompare(a.lastTime);
    });

    return list;
  }, [motoboys, periodOrders]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header and SubTab bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">
            Central de Relatórios Gerenciais
          </h2>
          <p className="text-xs text-slate-500">
            Exportação oficial em PDF, demonstrativos por motoboy e relatórios por empresa parceira.
          </p>
        </div>

        {/* SubTabs */}
        <div className="flex flex-wrap rounded-xl bg-slate-200/80 p-1 text-xs font-bold text-slate-600">
          <button
            onClick={() => setSubTab('lojas')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition-all ${
              subTab === 'lojas' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <Store className="h-3.5 w-3.5 text-orange-500" />
            <span>Por Empresa</span>
          </button>

          <button
            onClick={() => setSubTab('motoboys')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition-all ${
              subTab === 'motoboys' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <Bike className="h-3.5 w-3.5 text-orange-500" />
            <span>Por Motoboy</span>
          </button>

          <button
            onClick={() => setSubTab('mensal')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition-all ${
              subTab === 'mensal' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <Calendar className="h-3.5 w-3.5 text-orange-500" />
            <span>Consolidado</span>
          </button>

          <button
            onClick={() => setSubTab('ranking')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition-all ${
              subTab === 'ranking' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <Award className="h-3.5 w-3.5 text-orange-500" />
            <span>Ranking</span>
          </button>

          <button
            onClick={() => setSubTab('fechamentos')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 transition-all ${
              subTab === 'fechamentos' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <History className="h-3.5 w-3.5 text-orange-500" />
            <span>Fechamentos ({shiftClosings.length})</span>
          </button>
        </div>
      </div>

      {/* Global Filter Bar for Period */}
      {subTab !== 'fechamentos' && (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-orange-500" />
              Período:
            </span>

            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as PeriodType)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-orange-500 focus:outline-hidden"
            >
              <option value="today">Hoje</option>
              <option value="week">Últimos 7 dias</option>
              <option value="month">Mês Corrente</option>
              <option value="month_select">Qualquer Mês do Ano</option>
              <option value="custom">Período Personalizado</option>
            </select>

            {periodType === 'month_select' && (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
              />
            )}

            {periodType === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
                />
                <span className="text-xs text-slate-400">até</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
                />
              </div>
            )}

            <span className="ml-auto text-xs font-medium text-slate-500">
              Intervalo ativo: <strong>{activeDateRange.label}</strong>
            </span>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUBTAB 1: RELATÓRIO POR EMPRESA DE ENTREGA */}
      {/* ======================================================== */}
      {subTab === 'lojas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Desempenho por Empresa / Loja de Origem
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const headers = ['Loja', 'Total', 'Concluidas', 'Canceladas', 'NaoEncontrado', 'Faturamento'];
                  const rows = storeReportData.map((d) => [
                    d.store.name,
                    d.total,
                    d.completed,
                    d.canceled,
                    d.notFound,
                    d.financial.toFixed(2),
                  ]);
                  exportToCsv(`Relatorio_Lojas_${activeDateRange.start}`, rows, headers);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Exportar CSV</span>
              </button>

              <button
                onClick={() => {
                  if (companySettings && userProfile) {
                    generateStoreReportPdf(stores, periodOrders, activeDateRange.label, companySettings, userProfile.name);
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-orange-500/25 hover:bg-orange-600"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Gerar PDF Oficial</span>
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">Empresa / Loja</th>
                  <th className="py-3 px-4 text-center">Total Corridas</th>
                  <th className="py-3 px-4 text-center">Concluídas</th>
                  <th className="py-3 px-4 text-center">Canceladas</th>
                  <th className="py-3 px-4 text-center">Não Encontrado</th>
                  <th className="py-3 px-4 text-right">Total Financeiro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {storeReportData.map((item) => (
                  <tr key={item.store.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.store.name}</div>
                      <span className="text-[10px] text-slate-400 font-mono">{item.store.code}</span>
                    </td>
                    <td className="py-3 px-4 text-center font-bold">{item.total}</td>
                    <td className="py-3 px-4 text-center font-bold text-emerald-600">{item.completed}</td>
                    <td className="py-3 px-4 text-center text-red-600">{item.canceled}</td>
                    <td className="py-3 px-4 text-center text-amber-600">{item.notFound}</td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">
                      {formatCurrency(item.financial)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50/90 font-black text-slate-900">
                <tr>
                  <td className="py-3 px-4">TOTAL CONSOLIDADO</td>
                  <td className="py-3 px-4 text-center">
                    {storeReportData.reduce((acc, c) => acc + c.total, 0)}
                  </td>
                  <td className="py-3 px-4 text-center text-emerald-600">
                    {storeReportData.reduce((acc, c) => acc + c.completed, 0)}
                  </td>
                  <td className="py-3 px-4 text-center text-red-600">
                    {storeReportData.reduce((acc, c) => acc + c.canceled, 0)}
                  </td>
                  <td className="py-3 px-4 text-center text-amber-600">
                    {storeReportData.reduce((acc, c) => acc + c.notFound, 0)}
                  </td>
                  <td className="py-3 px-4 text-right text-orange-600 text-sm">
                    {formatCurrency(storeReportData.reduce((acc, c) => acc + c.financial, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUBTAB 2: RELATÓRIO INDIVIDUAL POR MOTOBOY */}
      {/* ======================================================== */}
      {subTab === 'motoboys' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">Selecione o Motoboy:</span>
              <select
                value={selectedMotoboyId}
                onChange={(e) => setSelectedMotoboyId(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-hidden"
              >
                {motoboys.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({maskCpfRedacted(m.cpf)})
                  </option>
                ))}
              </select>
            </div>

            {motoboyReportData && companySettings && userProfile && (
              <button
                onClick={() => {
                  generateMotoboyReportPdf(
                    motoboyReportData.motoboy,
                    motoboyReportData.orders,
                    activeDateRange.label,
                    companySettings,
                    userProfile.name
                  );
                }}
                className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-orange-500/25 hover:bg-orange-600"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Gerar Extrato em PDF</span>
              </button>
            )}
          </div>

          {motoboyReportData ? (
            <div className="space-y-4">
              {/* Courier Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-center shadow-xs">
                  <span className="text-[11px] text-slate-500 font-semibold">Total Atribuídas</span>
                  <p className="text-xl font-black text-slate-900">{motoboyReportData.totalReceived}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 text-center shadow-xs">
                  <span className="text-[11px] text-emerald-800 font-semibold">Concluídas</span>
                  <p className="text-xl font-black text-emerald-600">{motoboyReportData.completedCount}</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50/40 p-3.5 text-center shadow-xs">
                  <span className="text-[11px] text-red-800 font-semibold">Canceladas / Não Enc.</span>
                  <p className="text-xl font-black text-red-600">
                    {motoboyReportData.canceledCount + motoboyReportData.notFoundCount}
                  </p>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3.5 text-center shadow-xs">
                  <span className="text-[11px] text-orange-950 font-semibold">Repasse / Total</span>
                  <p className="text-xl font-black text-orange-600">
                    {formatCurrency(motoboyReportData.totalFinancial)}
                  </p>
                </div>
              </div>

              {/* By Store breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Entregas por Loja de Origem
                  </h4>
                  <div className="divide-y divide-slate-100 text-xs">
                    {Object.entries(motoboyReportData.byStore).map(([sName, d]) => (
                      <div key={sName} className="flex justify-between py-2">
                        <span className="font-medium text-slate-700">{sName}</span>
                        <div className="flex gap-4">
                          <span className="text-slate-500">{d.count} entregas</span>
                          <span className="font-bold text-slate-900">{formatCurrency(d.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                    Entregas por Bairro
                  </h4>
                  <div className="divide-y divide-slate-100 text-xs">
                    {Object.entries(motoboyReportData.byNeighborhood).map(([bName, d]) => (
                      <div key={bName} className="flex justify-between py-2">
                        <span className="font-medium text-slate-700">{bName}</span>
                        <div className="flex gap-4">
                          <span className="text-slate-500">{d.count} entregas</span>
                          <span className="font-bold text-slate-900">{formatCurrency(d.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">Nenhum motoboy selecionado.</div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SUBTAB 3: CONSOLIDADO MENSAL */}
      {/* ======================================================== */}
      {subTab === 'mensal' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Resumo Geral do Período ({activeDateRange.label})
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Consolidação de volume e faturamento de todas as empresas e entregadores.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-center">
                <span className="text-xs font-semibold text-slate-500">Corridas Totais</span>
                <p className="mt-1 text-2xl font-black text-slate-900">{periodOrders.length}</p>
              </div>

              <div className="rounded-xl bg-emerald-50/40 p-4 border border-emerald-200 text-center">
                <span className="text-xs font-semibold text-emerald-800">Concluídas</span>
                <p className="mt-1 text-2xl font-black text-emerald-600">
                  {periodOrders.filter((o) => o.status === 'completed').length}
                </p>
              </div>

              <div className="rounded-xl bg-red-50/40 p-4 border border-red-200 text-center">
                <span className="text-xs font-semibold text-red-800">Canceladas / Não Enc.</span>
                <p className="mt-1 text-2xl font-black text-red-600">
                  {periodOrders.filter((o) => o.status === 'canceled' || o.status === 'client_not_found').length}
                </p>
              </div>

              <div className="rounded-xl bg-orange-50/40 p-4 border border-orange-200 text-center">
                <span className="text-xs font-semibold text-orange-950">Faturamento Concluído</span>
                <p className="mt-1 text-xl font-black text-orange-600 truncate">
                  {formatCurrency(
                    periodOrders
                      .filter((o) => o.status === 'completed')
                      .reduce((acc, curr) => acc + curr.rate, 0)
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUBTAB 4: RANKING DE MOTOBOYS */}
      {/* ======================================================== */}
      {subTab === 'ranking' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Ranking de Desempenho dos Motoboys ({activeDateRange.label})
            </h3>
            <span className="text-xs text-slate-500">
              Critério: Entregas Concluídas (desempate por última entrega)
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">Posição</th>
                  <th className="py-3 px-4">Motoboy</th>
                  <th className="py-3 px-4">CPF (Mascarado)</th>
                  <th className="py-3 px-4 text-center">Entregas Concluídas</th>
                  <th className="py-3 px-4 text-right">Valor Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {rankingData.map((item, idx) => {
                  let badge = 'bg-slate-100 text-slate-600';
                  if (idx === 0) badge = 'bg-amber-100 text-amber-800 font-black border border-amber-300';
                  if (idx === 1) badge = 'bg-slate-200 text-slate-800 font-black border border-slate-300';
                  if (idx === 2) badge = 'bg-amber-800/10 text-amber-900 font-black border border-amber-700/20';

                  return (
                    <tr key={item.motoboy.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${badge}`}>
                          {idx + 1}º
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{item.motoboy.name}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {maskCpfRedacted(item.motoboy.cpf)}
                      </td>
                      <td className="py-3 px-4 text-center font-black text-emerald-600 text-sm">
                        {item.count}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUBTAB 5: HISTÓRICO DE FECHAMENTOS DE TURNO */}
      {/* ======================================================== */}
      {subTab === 'fechamentos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Histórico de Turnos Fechados e Auditados
            </h3>
            <span className="text-xs text-slate-500">
              Registros imutáveis com comprovante oficial em PDF
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">Código / Turno</th>
                  <th className="py-3 px-4">Data Operacional</th>
                  <th className="py-3 px-4">Fechado por</th>
                  <th className="py-3 px-4 text-center">Corridas</th>
                  <th className="py-3 px-4 text-center">Concluídas</th>
                  <th className="py-3 px-4 text-right">Total Financeiro</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {shiftClosings.length > 0 ? (
                  shiftClosings.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{c.closingCode}</div>
                        <span className="text-[10px] text-slate-400">{c.shiftName}</span>
                      </td>
                      <td className="py-3 px-4">{formatDate(c.operationalDate)}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{c.closedByName}</div>
                        <span className="text-[10px] text-slate-400">{formatDateTime(c.closedAt)}</span>
                      </td>
                      <td className="py-3 px-4 text-center">{c.totalOrders}</td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-600">
                        {c.completedOrders}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {formatCurrency(c.totalFinancialAmount)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            if (companySettings) {
                              // Filter orders of this closing
                              const relatedOrders = orders.filter((o) => o.shiftClosingId === c.id);
                              generateShiftClosingPdf(c, relatedOrders, companySettings, c.closedByName);
                            }
                          }}
                          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 ml-auto"
                        >
                          <Printer className="h-3 w-3 text-orange-500" />
                          <span>PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Nenhum fechamento de turno registrado até o momento.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
