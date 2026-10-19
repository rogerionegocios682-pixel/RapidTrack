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
  TrendingUp,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Layers,
  BarChart3,
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

  const todayDate = getTodayOperationalDate();

  // Direct Initial and Final date filters
  const [startDate, setStartDate] = useState<string>(`${currentYear}-${currentMonth}-01`);
  const [endDate, setEndDate] = useState<string>(todayDate);

  // Quick preset helper
  const applyPreset = (preset: 'today' | 'week' | 'month' | 'last_month' | 'year' | 'all') => {
    const today = getTodayOperationalDate();
    if (preset === 'today') {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setStartDate(start);
      setEndDate(today);
    } else if (preset === 'month') {
      setStartDate(`${currentYear}-${currentMonth}-01`);
      setEndDate(today);
    } else if (preset === 'last_month') {
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const py = prevDate.getFullYear();
      const pm = String(prevDate.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(py, prevDate.getMonth() + 1, 0).getDate();
      setStartDate(`${py}-${pm}-01`);
      setEndDate(`${py}-${pm}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'year') {
      setStartDate(`${currentYear}-01-01`);
      setEndDate(today);
    } else if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    }
  };

  // Entity Filters
  const [selectedMotoboyId, setSelectedMotoboyId] = useState<string>('all');
  const [selectedStoreId, setSelectedStoreId] = useState<string>('all');

  // Compute Active Period Date Bounds & Label
  const activeDateRange = useMemo(() => {
    if (!startDate && !endDate) {
      return { start: '', end: '', label: 'Todo o Histórico (Sem filtro de data)' };
    }
    if (startDate && !endDate) {
      return { start: startDate, end: '9999-12-31', label: `A partir de ${formatDate(startDate)}` };
    }
    if (!startDate && endDate) {
      return { start: '0000-01-01', end: endDate, label: `Até ${formatDate(endDate)}` };
    }
    if (startDate === endDate) {
      return { start: startDate, end: endDate, label: `Data única: ${formatDate(startDate)}` };
    }
    return {
      start: startDate,
      end: endDate,
      label: `${formatDate(startDate)} até ${formatDate(endDate)}`,
    };
  }, [startDate, endDate]);

  // Orders matching active period
  const periodOrders = useMemo(() => {
    return orders.filter((o) => {
      if (startDate && o.operationalDate < startDate) return false;
      if (endDate && o.operationalDate > endDate) return false;
      return true;
    });
  }, [orders, startDate, endDate]);

  // Shift closings matching active period
  const filteredShiftClosings = useMemo(() => {
    return shiftClosings.filter((c) => {
      if (startDate && c.operationalDate < startDate) return false;
      if (endDate && c.operationalDate > endDate) return false;
      return true;
    });
  }, [shiftClosings, startDate, endDate]);

  // Robust CSV Exporter with BOM for Excel UTF-8 support and Brazilian semicolons
  const exportToCsv = (filename: string, rows: (string | number)[][], headers: string[]) => {
    const escapeCell = (cell: string | number) => {
      const str = String(cell ?? '');
      if (str.includes(';') || str.includes('\n') || str.includes('\r') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent =
      '\uFEFF' +
      [
        headers.map(escapeCell).join(';'),
        ...rows.map((row) => row.map(escapeCell).join(';')),
      ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    link.setAttribute('download', cleanFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Standardized order row for CSV exports
  const formatOrderCsvRow = (o: DeliveryOrder) => [
    formatDate(o.operationalDate),
    o.orderNumber,
    o.dispatchTime,
    o.shiftName,
    o.storeName,
    stores.find((s) => s.id === o.storeId)?.code || '',
    o.clientName,
    o.clientPhone || '',
    o.neighborhood,
    o.address,
    o.motoboyName,
    o.rate.toFixed(2).replace('.', ','),
    o.status === 'completed'
      ? 'Concluída'
      : o.status === 'canceled'
      ? 'Cancelada'
      : o.status === 'client_not_found'
      ? 'Não Encontrado'
      : 'Pendente',
    o.completionTime ? formatDateTime(o.completionTime) : '',
    o.completedByName || '',
    o.cancellationTime ? formatDateTime(o.cancellationTime) : '',
    o.cancellationReason || '',
    o.shiftClosingId || '',
  ];

  const standardOrderCsvHeaders = [
    'Data_Operacional',
    'Pedido',
    'Horário_Despacho',
    'Turno',
    'Loja_Origem',
    'Código_Loja',
    'Cliente',
    'Telefone_Cliente',
    'Bairro_Destino',
    'Endereço_Completo',
    'Motoboy',
    'Taxa_Valor_R$',
    'Situação',
    'Concluído_Em',
    'Confirmado_Por',
    'Cancelado_Em',
    'Motivo_Cancelamento',
    'ID_Fechamento',
  ];

  // ========================================================
  // DATA PROCESSING: 1. STORES
  // ========================================================
  const storeReportData = useMemo(() => {
    return stores.map((st) => {
      const storeOrders = periodOrders.filter((o) => o.storeId === st.id);
      const completed = storeOrders.filter((o) => o.status === 'completed');
      const canceled = storeOrders.filter((o) => o.status === 'canceled');
      const notFound = storeOrders.filter((o) => o.status === 'client_not_found');
      const pending = storeOrders.filter((o) => o.status === 'pending');
      const financial = completed.reduce((acc, curr) => acc + curr.rate, 0);

      // Neighborhood breakdown
      const neighMap: Record<string, { count: number; financial: number }> = {};
      completed.forEach((o) => {
        if (!neighMap[o.neighborhood]) {
          neighMap[o.neighborhood] = { count: 0, financial: 0 };
        }
        neighMap[o.neighborhood].count += 1;
        neighMap[o.neighborhood].financial += o.rate;
      });

      return {
        store: st,
        orders: storeOrders,
        total: storeOrders.length,
        completed: completed.length,
        canceled: canceled.length,
        notFound: notFound.length,
        pending: pending.length,
        financial,
        avgTicket: completed.length > 0 ? financial / completed.length : 0,
        neighborhoods: neighMap,
      };
    });
  }, [stores, periodOrders]);

  const activeStoreData = useMemo(() => {
    if (selectedStoreId === 'all') return null;
    return storeReportData.find((d) => d.store.id === selectedStoreId) || null;
  }, [storeReportData, selectedStoreId]);

  // ========================================================
  // DATA PROCESSING: 2. MOTOBOYS
  // ========================================================
  const allMotoboysReportData = useMemo(() => {
    return motoboys.map((mb) => {
      const mbOrders = periodOrders.filter((o) => o.motoboyId === mb.id);
      const completed = mbOrders.filter((o) => o.status === 'completed');
      const canceled = mbOrders.filter((o) => o.status === 'canceled');
      const notFound = mbOrders.filter((o) => o.status === 'client_not_found');
      const financial = completed.reduce((acc, curr) => acc + curr.rate, 0);

      // By Store
      const byStore: Record<string, { count: number; amount: number }> = {};
      completed.forEach((o) => {
        if (!byStore[o.storeName]) byStore[o.storeName] = { count: 0, amount: 0 };
        byStore[o.storeName].count += 1;
        byStore[o.storeName].amount += o.rate;
      });

      // By Neighborhood
      const byNeighborhood: Record<string, { count: number; amount: number }> = {};
      completed.forEach((o) => {
        if (!byNeighborhood[o.neighborhood]) byNeighborhood[o.neighborhood] = { count: 0, amount: 0 };
        byNeighborhood[o.neighborhood].count += 1;
        byNeighborhood[o.neighborhood].amount += o.rate;
      });

      return {
        motoboy: mb,
        orders: mbOrders,
        totalReceived: mbOrders.length,
        completedCount: completed.length,
        canceledCount: canceled.length,
        notFoundCount: notFound.length,
        totalFinancial: financial,
        avgTicket: completed.length > 0 ? financial / completed.length : 0,
        successRate: mbOrders.length > 0 ? (completed.length / mbOrders.length) * 100 : 0,
        byStore,
        byNeighborhood,
      };
    });
  }, [motoboys, periodOrders]);

  const activeMotoboyData = useMemo(() => {
    if (selectedMotoboyId === 'all') return null;
    return allMotoboysReportData.find((d) => d.motoboy.id === selectedMotoboyId) || null;
  }, [allMotoboysReportData, selectedMotoboyId]);

  // ========================================================
  // DATA PROCESSING: 3. CONSOLIDADO DIÁRIO (MENSAL)
  // ========================================================
  const dailyConsolidatedData = useMemo(() => {
    const map: Record<string, {
      date: string;
      total: number;
      completed: number;
      canceled: number;
      notFound: number;
      financial: number;
      couriersSet: Set<string>;
    }> = {};

    periodOrders.forEach((o) => {
      const d = o.operationalDate;
      if (!map[d]) {
        map[d] = {
          date: d,
          total: 0,
          completed: 0,
          canceled: 0,
          notFound: 0,
          financial: 0,
          couriersSet: new Set(),
        };
      }
      map[d].total += 1;
      if (o.status === 'completed') {
        map[d].completed += 1;
        map[d].financial += o.rate;
        map[d].couriersSet.add(o.motoboyName);
      } else if (o.status === 'canceled') {
        map[d].canceled += 1;
      } else if (o.status === 'client_not_found') {
        map[d].notFound += 1;
      }
    });

    const list = Object.values(map);
    list.sort((a, b) => b.date.localeCompare(a.date));
    return list;
  }, [periodOrders]);

  // Group by Shift
  const shiftConsolidatedData = useMemo(() => {
    const map: Record<string, { shiftName: string; count: number; completed: number; financial: number }> = {};
    periodOrders.forEach((o) => {
      const s = o.shiftName || 'Padrão';
      if (!map[s]) map[s] = { shiftName: s, count: 0, completed: 0, financial: 0 };
      map[s].count += 1;
      if (o.status === 'completed') {
        map[s].completed += 1;
        map[s].financial += o.rate;
      }
    });
    return Object.values(map);
  }, [periodOrders]);

  // ========================================================
  // DATA PROCESSING: 4. RANKING
  // ========================================================
  const rankingData = useMemo(() => {
    const map: Record<string, {
      motoboy: Motoboy;
      count: number;
      total: number;
      canceled: number;
      lastTime: string;
    }> = {};

    motoboys.forEach((m) => {
      map[m.id] = { motoboy: m, count: 0, total: 0, canceled: 0, lastTime: '' };
    });

    periodOrders.forEach((o) => {
      if (map[o.motoboyId]) {
        if (o.status === 'completed') {
          map[o.motoboyId].count += 1;
          map[o.motoboyId].total += o.rate;
          if (o.completionTime && o.completionTime > map[o.motoboyId].lastTime) {
            map[o.motoboyId].lastTime = o.completionTime;
          }
        } else if (o.status === 'canceled' || o.status === 'client_not_found') {
          map[o.motoboyId].canceled += 1;
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
            Exportação oficial em CSV e PDF para análise externa, conferência de repasses e fechamento financeiro.
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

      {/* Global Filter Bar for Initial & Final Date */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
          {/* Direct Date Pickers: Data Inicial & Data Final */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
              <Calendar className="h-4 w-4 text-orange-500" />
              <span>Filtrar por Período:</span>
            </div>

            {/* Data Inicial */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="report-start-date" className="text-xs font-bold text-slate-600">
                Data Inicial:
              </label>
              <input
                id="report-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-orange-500 focus:bg-white focus:outline-hidden transition-colors shadow-2xs"
              />
            </div>

            {/* Data Final */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="report-end-date" className="text-xs font-bold text-slate-600">
                Data Final:
              </label>
              <input
                id="report-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-1.5 text-xs font-semibold text-slate-800 focus:border-orange-500 focus:bg-white focus:outline-hidden transition-colors shadow-2xs"
              />
            </div>
          </div>

          {/* Quick Preset Shortcuts */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Atalhos:
            </span>
            <button
              type="button"
              onClick={() => applyPreset('today')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                startDate === todayDate && endDate === todayDate
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => applyPreset('week')}
              className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all"
            >
              7 Dias
            </button>
            <button
              type="button"
              onClick={() => applyPreset('month')}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                startDate === `${currentYear}-${currentMonth}-01` && endDate === todayDate
                  ? 'bg-orange-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Este Mês
            </button>
            <button
              type="button"
              onClick={() => applyPreset('last_month')}
              className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all"
            >
              Mês Anterior
            </button>
            <button
              type="button"
              onClick={() => applyPreset('year')}
              className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all"
            >
              Ano {currentYear}
            </button>
            {(startDate || endDate) && (
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* Active Period & Metrics Summary Bar */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              Período ativo: <strong className="text-slate-900">{activeDateRange.label}</strong>
            </span>
          </div>
          <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full">
            {periodOrders.length} corrida(s) no período
            {subTab === 'fechamentos' && ` • ${filteredShiftClosings.length} fechamento(s)`}
          </span>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SUBTAB 1: RELATÓRIO POR EMPRESA DE ENTREGA */}
      {/* ======================================================== */}
      {subTab === 'lojas' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700">Filtrar Empresa / Loja:</span>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-hidden"
              >
                <option value="all">Todas as Empresas (Visão Consolidada)</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Export Consolidated Stores CSV */}
              <button
                onClick={() => {
                  const headers = [
                    'Empresa_Loja',
                    'Código',
                    'Total_Corridas',
                    'Concluídas',
                    'Canceladas',
                    'Não_Encontrado',
                    'Pendentes',
                    'Faturamento_Total_R$',
                    'Ticket_Médio_R$',
                  ];
                  const rows = storeReportData.map((d) => [
                    d.store.name,
                    d.store.code,
                    d.total,
                    d.completed,
                    d.canceled,
                    d.notFound,
                    d.pending,
                    d.financial.toFixed(2).replace('.', ','),
                    d.avgTicket.toFixed(2).replace('.', ','),
                  ]);
                  // Consolidated Row
                  const totOrders = storeReportData.reduce((acc, c) => acc + c.total, 0);
                  const totComp = storeReportData.reduce((acc, c) => acc + c.completed, 0);
                  const totFin = storeReportData.reduce((acc, c) => acc + c.financial, 0);
                  rows.push([
                    'TOTAL GERAL CONSOLIDADO',
                    '-',
                    totOrders,
                    totComp,
                    storeReportData.reduce((acc, c) => acc + c.canceled, 0),
                    storeReportData.reduce((acc, c) => acc + c.notFound, 0),
                    storeReportData.reduce((acc, c) => acc + c.pending, 0),
                    totFin.toFixed(2).replace('.', ','),
                    (totComp > 0 ? totFin / totComp : 0).toFixed(2).replace('.', ','),
                  ]);
                  exportToCsv(`Relatorio_Empresas_Resumo_${activeDateRange.start}_a_${activeDateRange.end}`, rows, headers);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
                title="Exportar tabela comparativa de empresas para CSV"
              >
                <Download className="h-3.5 w-3.5 text-orange-500" />
                <span>Exportar Resumo (CSV)</span>
              </button>

              {/* Export Detailed Orders CSV */}
              <button
                onClick={() => {
                  const targetOrders = selectedStoreId === 'all'
                    ? periodOrders
                    : periodOrders.filter((o) => o.storeId === selectedStoreId);
                  const rows = targetOrders.map(formatOrderCsvRow);
                  const storeSuffix = selectedStoreId === 'all' ? 'Todas' : (activeStoreData?.store.code || 'Loja');
                  exportToCsv(
                    `Corridas_Empresas_${storeSuffix}_${activeDateRange.start}_a_${activeDateRange.end}`,
                    rows,
                    standardOrderCsvHeaders
                  );
                }}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
                title="Exportar todas as corridas detalhadas em formato CSV"
              >
                <FileText className="h-3.5 w-3.5 text-blue-500" />
                <span>Exportar Corridas Detalhadas (CSV)</span>
              </button>

              {/* Official PDF */}
              <button
                onClick={() => {
                  if (companySettings && userProfile) {
                    const targetStores = selectedStoreId === 'all'
                      ? stores
                      : stores.filter((s) => s.id === selectedStoreId);
                    const targetOrders = selectedStoreId === 'all'
                      ? periodOrders
                      : periodOrders.filter((o) => o.storeId === selectedStoreId);
                    generateStoreReportPdf(targetStores, targetOrders, activeDateRange.label, companySettings, userProfile.name);
                  }
                }}
                className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-orange-500/25 hover:bg-orange-600 transition-colors"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Gerar PDF Oficial</span>
              </button>
            </div>
          </div>

          {/* If single store selected, show specific cards */}
          {activeStoreData && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-center shadow-xs">
                <span className="text-[11px] text-slate-500 font-semibold">Total Corridas</span>
                <p className="text-xl font-black text-slate-900">{activeStoreData.total}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 text-center shadow-xs">
                <span className="text-[11px] text-emerald-800 font-semibold">Concluídas</span>
                <p className="text-xl font-black text-emerald-600">{activeStoreData.completed}</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50/40 p-3.5 text-center shadow-xs">
                <span className="text-[11px] text-red-800 font-semibold">Canceladas</span>
                <p className="text-xl font-black text-red-600">{activeStoreData.canceled}</p>
              </div>
              <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3.5 text-center shadow-xs">
                <span className="text-[11px] text-orange-950 font-semibold">Faturamento Total</span>
                <p className="text-xl font-black text-orange-600">
                  {formatCurrency(activeStoreData.financial)}
                </p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 text-center shadow-xs">
                <span className="text-[11px] text-blue-800 font-semibold">Ticket Médio</span>
                <p className="text-xl font-black text-blue-600">
                  {formatCurrency(activeStoreData.avgTicket)}
                </p>
              </div>
            </div>
          )}

          {/* Table of Stores */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
            <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Desempenho por Empresa / Loja de Origem
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {selectedStoreId === 'all' ? `${stores.length} empresas analisadas` : `Visualizando: ${activeStoreData?.store.name}`}
              </span>
            </div>
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">Empresa / Loja</th>
                  <th className="py-3 px-4 text-center">Total Corridas</th>
                  <th className="py-3 px-4 text-center">Concluídas</th>
                  <th className="py-3 px-4 text-center">Canceladas</th>
                  <th className="py-3 px-4 text-center">Não Encontrado</th>
                  <th className="py-3 px-4 text-right">Faturamento Total</th>
                  <th className="py-3 px-4 text-right">Ação CSV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {(selectedStoreId === 'all' ? storeReportData : storeReportData.filter((s) => s.store.id === selectedStoreId)).map((item) => (
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
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          const storeOrders = item.orders;
                          const rows = storeOrders.map(formatOrderCsvRow);
                          exportToCsv(
                            `Corridas_${item.store.code}_${activeDateRange.start}_a_${activeDateRange.end}`,
                            rows,
                            standardOrderCsvHeaders
                          );
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                        title={`Exportar CSV das corridas de ${item.store.name}`}
                      >
                        <Download className="h-3 w-3 text-orange-500" />
                        <span>CSV</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50/90 font-black text-slate-900">
                <tr>
                  <td className="py-3 px-4">TOTAL CONSOLIDADO</td>
                  <td className="py-3 px-4 text-center">
                    {(selectedStoreId === 'all' ? storeReportData : storeReportData.filter((s) => s.store.id === selectedStoreId))
                      .reduce((acc, c) => acc + c.total, 0)}
                  </td>
                  <td className="py-3 px-4 text-center text-emerald-600">
                    {(selectedStoreId === 'all' ? storeReportData : storeReportData.filter((s) => s.store.id === selectedStoreId))
                      .reduce((acc, c) => acc + c.completed, 0)}
                  </td>
                  <td className="py-3 px-4 text-center text-red-600">
                    {(selectedStoreId === 'all' ? storeReportData : storeReportData.filter((s) => s.store.id === selectedStoreId))
                      .reduce((acc, c) => acc + c.canceled, 0)}
                  </td>
                  <td className="py-3 px-4 text-center text-amber-600">
                    {(selectedStoreId === 'all' ? storeReportData : storeReportData.filter((s) => s.store.id === selectedStoreId))
                      .reduce((acc, c) => acc + c.notFound, 0)}
                  </td>
                  <td className="py-3 px-4 text-right text-orange-600 text-sm">
                    {formatCurrency(
                      (selectedStoreId === 'all' ? storeReportData : storeReportData.filter((s) => s.store.id === selectedStoreId))
                        .reduce((acc, c) => acc + c.financial, 0)
                    )}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SUBTAB 2: RELATÓRIO INDIVIDUAL OU GERAL POR MOTOBOY */}
      {/* ======================================================== */}
      {subTab === 'motoboys' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-700">Selecione o Motoboy:</span>
              <select
                value={selectedMotoboyId}
                onChange={(e) => setSelectedMotoboyId(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-hidden"
              >
                <option value="all">Todos os Motoboys (Visão Geral Consolidada)</option>
                {motoboys.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({maskCpfRedacted(m.cpf)})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* If "all" selected: Export Summary of All Couriers CSV */}
              {selectedMotoboyId === 'all' ? (
                <>
                  <button
                    onClick={() => {
                      const headers = [
                        'Motoboy',
                        'CPF',
                        'Telefone',
                        'Status',
                        'Total_Corridas',
                        'Concluídas',
                        'Canceladas',
                        'Não_Encontrado',
                        'Taxa_Sucesso_%',
                        'Repasse_Total_R$',
                        'Ticket_Médio_R$',
                      ];
                      const rows = allMotoboysReportData.map((d) => [
                        d.motoboy.name,
                        maskCpfRedacted(d.motoboy.cpf),
                        d.motoboy.phone,
                        d.motoboy.active ? 'Ativo' : 'Inativo',
                        d.totalReceived,
                        d.completedCount,
                        d.canceledCount,
                        d.notFoundCount,
                        d.successRate.toFixed(1).replace('.', ',') + '%',
                        d.totalFinancial.toFixed(2).replace('.', ','),
                        d.avgTicket.toFixed(2).replace('.', ','),
                      ]);
                      exportToCsv(
                        `Resumo_Todos_Motoboys_${activeDateRange.start}_a_${activeDateRange.end}`,
                        rows,
                        headers
                      );
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5 text-orange-500" />
                    <span>Exportar Todos os Motoboys (CSV)</span>
                  </button>

                  <button
                    onClick={() => {
                      const rows = periodOrders.map(formatOrderCsvRow);
                      exportToCsv(
                        `Extrato_Todas_Corridas_Motoboys_${activeDateRange.start}_a_${activeDateRange.end}`,
                        rows,
                        standardOrderCsvHeaders
                      );
                    }}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5 text-blue-500" />
                    <span>Exportar Base Bruta de Corridas (CSV)</span>
                  </button>
                </>
              ) : (
                /* Specific Motoboy Selected */
                activeMotoboyData && (
                  <>
                    <button
                      onClick={() => {
                        const rows = activeMotoboyData.orders.map(formatOrderCsvRow);
                        exportToCsv(
                          `Extrato_Motoboy_${activeMotoboyData.motoboy.name.replace(/\s+/g, '_')}_${activeDateRange.start}_a_${activeDateRange.end}`,
                          rows,
                          standardOrderCsvHeaders
                        );
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
                    >
                      <Download className="h-3.5 w-3.5 text-orange-500" />
                      <span>Exportar Extrato (CSV)</span>
                    </button>

                    <button
                      onClick={() => {
                        // Export breakdown by Store & Neighborhood
                        const headers = ['Tipo_Agrupamento', 'Nome_Origem_Destino', 'Total_Entregas', 'Valor_Total_R$'];
                        const rows: (string | number)[][] = [];
                        Object.entries(activeMotoboyData.byStore).forEach(([sName, d]) => {
                          rows.push(['Empresa / Loja Origem', sName, d.count, d.amount.toFixed(2).replace('.', ',')]);
                        });
                        Object.entries(activeMotoboyData.byNeighborhood).forEach(([bName, d]) => {
                          rows.push(['Bairro Destino', bName, d.count, d.amount.toFixed(2).replace('.', ',')]);
                        });
                        exportToCsv(
                          `Agrupamento_Motoboy_${activeMotoboyData.motoboy.name.replace(/\s+/g, '_')}_${activeDateRange.start}_a_${activeDateRange.end}`,
                          rows,
                          headers
                        );
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
                    >
                      <Layers className="h-3.5 w-3.5 text-blue-500" />
                      <span>Exportar Lojas/Bairros (CSV)</span>
                    </button>

                    {companySettings && userProfile && (
                      <button
                        onClick={() => {
                          generateMotoboyReportPdf(
                            activeMotoboyData.motoboy,
                            activeMotoboyData.orders,
                            activeDateRange.label,
                            companySettings,
                            userProfile.name
                          );
                        }}
                        className="flex items-center gap-1.5 rounded-xl bg-orange-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-orange-500/25 hover:bg-orange-600 transition-colors"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Gerar Extrato em PDF</span>
                      </button>
                    )}
                  </>
                )
              )}
            </div>
          </div>

          {/* VIEW A: SPECIFIC MOTOBOY */}
          {activeMotoboyData ? (
            <div className="space-y-4">
              {/* Courier Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 text-center shadow-xs">
                  <span className="text-[11px] text-slate-500 font-semibold">Total Atribuídas</span>
                  <p className="text-xl font-black text-slate-900">{activeMotoboyData.totalReceived}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 text-center shadow-xs">
                  <span className="text-[11px] text-emerald-800 font-semibold">Concluídas</span>
                  <p className="text-xl font-black text-emerald-600">{activeMotoboyData.completedCount}</p>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50/40 p-3.5 text-center shadow-xs">
                  <span className="text-[11px] text-red-800 font-semibold">Canceladas / Não Enc.</span>
                  <p className="text-xl font-black text-red-600">
                    {activeMotoboyData.canceledCount + activeMotoboyData.notFoundCount}
                  </p>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-50/50 p-3.5 text-center shadow-xs">
                  <span className="text-[11px] text-orange-950 font-semibold">Repasse / Total</span>
                  <p className="text-xl font-black text-orange-600">
                    {formatCurrency(activeMotoboyData.totalFinancial)}
                  </p>
                </div>
              </div>

              {/* By Store breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Entregas por Loja de Origem
                    </h4>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {Object.keys(activeMotoboyData.byStore).length} lojas atendidas
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 text-xs">
                    {Object.entries(activeMotoboyData.byStore).map(([sName, d]) => (
                      <div key={sName} className="flex justify-between py-2">
                        <span className="font-medium text-slate-700">{sName}</span>
                        <div className="flex gap-4">
                          <span className="text-slate-500">{d.count} entregas</span>
                          <span className="font-bold text-slate-900">{formatCurrency(d.amount)}</span>
                        </div>
                      </div>
                    ))}
                    {Object.keys(activeMotoboyData.byStore).length === 0 && (
                      <div className="py-6 text-center text-slate-400">Nenhuma entrega no período.</div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Entregas por Bairro
                    </h4>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {Object.keys(activeMotoboyData.byNeighborhood).length} bairros atendidos
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 text-xs">
                    {Object.entries(activeMotoboyData.byNeighborhood).map(([bName, d]) => (
                      <div key={bName} className="flex justify-between py-2">
                        <span className="font-medium text-slate-700">{bName}</span>
                        <div className="flex gap-4">
                          <span className="text-slate-500">{d.count} entregas</span>
                          <span className="font-bold text-slate-900">{formatCurrency(d.amount)}</span>
                        </div>
                      </div>
                    ))}
                    {Object.keys(activeMotoboyData.byNeighborhood).length === 0 && (
                      <div className="py-6 text-center text-slate-400">Nenhuma entrega no período.</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Order List for this courier */}
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
                <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Histórico de Corridas do Motoboy no Período
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {activeMotoboyData.orders.length} corridas registradas
                  </span>
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3">Data / Hora</th>
                      <th className="py-2.5 px-3">Pedido</th>
                      <th className="py-2.5 px-3">Loja</th>
                      <th className="py-2.5 px-3">Cliente / Bairro</th>
                      <th className="py-2.5 px-3 text-right">Taxa (R$)</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {activeMotoboyData.orders.slice(0, 50).map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-800">{formatDate(o.operationalDate)}</div>
                          <span className="text-[10px] text-slate-400">{o.dispatchTime}</span>
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">{o.orderNumber}</td>
                        <td className="py-2 px-3">{o.storeName}</td>
                        <td className="py-2 px-3">
                          <div className="font-semibold text-slate-800">{o.clientName}</div>
                          <span className="text-[10px] text-slate-400">{o.neighborhood}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-black text-slate-900">
                          {formatCurrency(o.rate)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`inline-block rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              o.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : o.status === 'canceled'
                                ? 'bg-red-100 text-red-800'
                                : o.status === 'client_not_found'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {o.status === 'completed'
                              ? 'Concluída'
                              : o.status === 'canceled'
                              ? 'Cancelada'
                              : o.status === 'client_not_found'
                              ? 'Não Enc.'
                              : 'Pendente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* VIEW B: ALL COURIERS CONSOLIDATED TABLE */
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
              <div className="border-b border-slate-100 bg-slate-50/50 px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Consolidação Geral de Entregadores ({allMotoboysReportData.length} cadastrados)
                </span>
                <span className="text-[11px] text-slate-500 font-medium">
                  Clique em &apos;CSV&apos; em qualquer linha para exportar o extrato individual
                </span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Motoboy</th>
                    <th className="py-3 px-4">CPF (Mascarado)</th>
                    <th className="py-3 px-4 text-center">Atribuídas</th>
                    <th className="py-3 px-4 text-center">Concluídas</th>
                    <th className="py-3 px-4 text-center">Canceladas</th>
                    <th className="py-3 px-4 text-right">Repasse Total</th>
                    <th className="py-3 px-4 text-right">Ação CSV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {allMotoboysReportData.map((d) => (
                    <tr key={d.motoboy.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{d.motoboy.name}</div>
                        <span className="text-[10px] text-slate-400 font-mono">{d.motoboy.phone}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {maskCpfRedacted(d.motoboy.cpf)}
                      </td>
                      <td className="py-3 px-4 text-center font-bold">{d.totalReceived}</td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-600">{d.completedCount}</td>
                      <td className="py-3 px-4 text-center text-red-600">{d.canceledCount + d.notFoundCount}</td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {formatCurrency(d.totalFinancial)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            const rows = d.orders.map(formatOrderCsvRow);
                            exportToCsv(
                              `Extrato_Motoboy_${d.motoboy.name.replace(/\s+/g, '_')}_${activeDateRange.start}_a_${activeDateRange.end}`,
                              rows,
                              standardOrderCsvHeaders
                            );
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                          title={`Exportar extrato CSV de ${d.motoboy.name}`}
                        >
                          <Download className="h-3 w-3 text-orange-500" />
                          <span>CSV</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 bg-slate-50/90 font-black text-slate-900">
                  <tr>
                    <td className="py-3 px-4">TOTAL CONSOLIDADO</td>
                    <td></td>
                    <td className="py-3 px-4 text-center">
                      {allMotoboysReportData.reduce((acc, c) => acc + c.totalReceived, 0)}
                    </td>
                    <td className="py-3 px-4 text-center text-emerald-600">
                      {allMotoboysReportData.reduce((acc, c) => acc + c.completedCount, 0)}
                    </td>
                    <td className="py-3 px-4 text-center text-red-600">
                      {allMotoboysReportData.reduce((acc, c) => acc + (c.canceledCount + c.notFoundCount), 0)}
                    </td>
                    <td className="py-3 px-4 text-right text-orange-600 text-sm">
                      {formatCurrency(allMotoboysReportData.reduce((acc, c) => acc + c.totalFinancial, 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* SUBTAB 3: CONSOLIDADO MENSAL / PERÍODO */}
      {/* ======================================================== */}
      {subTab === 'mensal' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-2 border-b border-slate-100 gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Resumo Geral do Período ({activeDateRange.label})
                </h3>
                <p className="text-xs text-slate-500">
                  Consolidação diária de volume e repasse financeiro de todas as empresas e entregadores.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Export Daily Summary CSV */}
                <button
                  onClick={() => {
                    const headers = [
                      'Data_Operacional',
                      'Total_Corridas',
                      'Concluídas',
                      'Canceladas',
                      'Não_Encontrado',
                      'Repasse_Total_R$',
                      'Entregadores_Ativos',
                    ];
                    const rows = dailyConsolidatedData.map((d) => [
                      formatDate(d.date),
                      d.total,
                      d.completed,
                      d.canceled,
                      d.notFound,
                      d.financial.toFixed(2).replace('.', ','),
                      d.couriersSet.size,
                    ]);
                    exportToCsv(
                      `Consolidado_Diario_${activeDateRange.start}_a_${activeDateRange.end}`,
                      rows,
                      headers
                    );
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
                >
                  <BarChart3 className="h-3.5 w-3.5 text-orange-500" />
                  <span>Exportar Resumo Diário (CSV)</span>
                </button>

                {/* Export All Orders CSV */}
                <button
                  onClick={() => {
                    const rows = periodOrders.map(formatOrderCsvRow);
                    exportToCsv(
                      `Consolidado_Todas_Corridas_${activeDateRange.start}_a_${activeDateRange.end}`,
                      rows,
                      standardOrderCsvHeaders
                    );
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5 text-blue-500" />
                  <span>Exportar Corridas do Período (CSV)</span>
                </button>

                {/* Export Shifts Breakdown CSV */}
                <button
                  onClick={() => {
                    const headers = ['Turno', 'Total_Corridas', 'Concluídas', 'Faturamento_Total_R$'];
                    const rows = shiftConsolidatedData.map((s) => [
                      s.shiftName,
                      s.count,
                      s.completed,
                      s.financial.toFixed(2).replace('.', ','),
                    ]);
                    exportToCsv(
                      `Consolidado_Turnos_${activeDateRange.start}_a_${activeDateRange.end}`,
                      rows,
                      headers
                    );
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
                >
                  <Clock className="h-3.5 w-3.5 text-emerald-500" />
                  <span>Exportar por Turno (CSV)</span>
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
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

            {/* Daily Evolution Table */}
            <div className="mt-6">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-orange-500" />
                Evolução Diária do Período ({dailyConsolidatedData.length} dias operados)
              </h4>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Data</th>
                      <th className="py-2.5 px-3 text-center">Total</th>
                      <th className="py-2.5 px-3 text-center">Concluídas</th>
                      <th className="py-2.5 px-3 text-center">Canceladas / Não Enc.</th>
                      <th className="py-2.5 px-3 text-center">Entregadores Ativos</th>
                      <th className="py-2.5 px-3 text-right">Repasse Total</th>
                      <th className="py-2.5 px-3 text-right">Ação CSV</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {dailyConsolidatedData.map((d) => (
                      <tr key={d.date} className="hover:bg-slate-50/60">
                        <td className="py-2 px-3 font-bold text-slate-900">{formatDate(d.date)}</td>
                        <td className="py-2 px-3 text-center font-semibold">{d.total}</td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-600">{d.completed}</td>
                        <td className="py-2 px-3 text-center text-red-600">{d.canceled + d.notFound}</td>
                        <td className="py-2 px-3 text-center font-semibold text-slate-600">{d.couriersSet.size}</td>
                        <td className="py-2 px-3 text-right font-black text-slate-900">
                          {formatCurrency(d.financial)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => {
                              const dayOrders = periodOrders.filter((o) => o.operationalDate === d.date);
                              const rows = dayOrders.map(formatOrderCsvRow);
                              exportToCsv(`Corridas_Dia_${d.date}`, rows, standardOrderCsvHeaders);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100 shadow-2xs"
                            title={`Exportar CSV do dia ${formatDate(d.date)}`}
                          >
                            <Download className="h-3 w-3 text-orange-500" />
                            <span>CSV</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                    {dailyConsolidatedData.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          Nenhuma corrida registrada neste período.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {dailyConsolidatedData.length > 0 && (
                    <tfoot className="border-t-2 border-slate-200 bg-slate-50/90 font-black text-slate-900">
                      <tr>
                        <td className="py-2.5 px-3">TOTAL DO PERÍODO</td>
                        <td className="py-2.5 px-3 text-center">
                          {dailyConsolidatedData.reduce((acc, c) => acc + c.total, 0)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-emerald-600">
                          {dailyConsolidatedData.reduce((acc, c) => acc + c.completed, 0)}
                        </td>
                        <td className="py-2.5 px-3 text-center text-red-600">
                          {dailyConsolidatedData.reduce((acc, c) => acc + (c.canceled + c.notFound), 0)}
                        </td>
                        <td></td>
                        <td className="py-2.5 px-3 text-right text-orange-600 text-sm">
                          {formatCurrency(dailyConsolidatedData.reduce((acc, c) => acc + c.financial, 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Ranking de Desempenho dos Motoboys ({activeDateRange.label})
              </h3>
              <span className="text-xs text-slate-500">
                Critério: Entregas Concluídas (desempate por última entrega concluída)
              </span>
            </div>

            <button
              onClick={() => {
                const headers = [
                  'Posição',
                  'Motoboy',
                  'CPF',
                  'Telefone',
                  'Status_Cadastro',
                  'Entregas_Concluídas',
                  'Canceladas',
                  'Total_Faturado_R$',
                  'Ticket_Médio_R$',
                  'Última_Entrega_Concluída',
                ];
                const rows = rankingData.map((item, idx) => [
                  idx + 1,
                  item.motoboy.name,
                  maskCpfRedacted(item.motoboy.cpf),
                  item.motoboy.phone,
                  item.motoboy.active ? 'Ativo' : 'Inativo',
                  item.count,
                  item.canceled,
                  item.total.toFixed(2).replace('.', ','),
                  (item.count > 0 ? item.total / item.count : 0).toFixed(2).replace('.', ','),
                  item.lastTime ? formatDateTime(item.lastTime) : 'Nenhuma',
                ]);
                exportToCsv(`Ranking_Motoboys_${activeDateRange.start}_a_${activeDateRange.end}`, rows, headers);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors self-start sm:self-auto"
            >
              <Download className="h-3.5 w-3.5 text-orange-500" />
              <span>Exportar Ranking Completo (CSV)</span>
            </button>
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
                  <th className="py-3 px-4 text-right">Ação CSV</th>
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
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            const mbOrders = periodOrders.filter((o) => o.motoboyId === item.motoboy.id);
                            const rows = mbOrders.map(formatOrderCsvRow);
                            exportToCsv(
                              `Corridas_${item.motoboy.name.replace(/\s+/g, '_')}_${activeDateRange.start}_a_${activeDateRange.end}`,
                              rows,
                              standardOrderCsvHeaders
                            );
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                          title={`Exportar corridas deste motoboy em CSV`}
                        >
                          <Download className="h-3 w-3 text-orange-500" />
                          <span>CSV</span>
                        </button>
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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Histórico de Turnos Fechados e Auditados
              </h3>
              <span className="text-xs text-slate-500">
                Registros imutáveis com comprovante oficial em PDF e exportação para CSV
              </span>
            </div>

            <button
              onClick={() => {
                const headers = [
                  'Código_Fechamento',
                  'Turno',
                  'Data_Operacional',
                  'Fechado_Por',
                  'Data_Hora_Fechamento',
                  'Total_Corridas',
                  'Entregas_Concluídas',
                  'Canceladas',
                  'Não_Encontradas',
                  'Pendências_Resolvidas',
                  'Total_Financeiro_R$',
                  'Observações',
                ];
                const rows = filteredShiftClosings.map((c) => [
                  c.closingCode,
                  c.shiftName,
                  formatDate(c.operationalDate),
                  c.closedByName,
                  formatDateTime(c.closedAt),
                  c.totalOrders,
                  c.completedOrders,
                  c.canceledOrders,
                  c.clientNotFoundOrders,
                  c.pendingOrdersResolved,
                  c.totalFinancialAmount.toFixed(2).replace('.', ','),
                  c.notes || '',
                ]);
                exportToCsv(`Historico_Fechamentos_${activeDateRange.start}_a_${activeDateRange.end}`, rows, headers);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors self-start sm:self-auto"
            >
              <Download className="h-3.5 w-3.5 text-orange-500" />
              <span>Exportar Lista de Fechamentos (CSV)</span>
            </button>
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
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredShiftClosings.length > 0 ? (
                  filteredShiftClosings.map((c) => {
                    const relatedOrders = orders.filter((o) => o.shiftClosingId === c.id);
                    return (
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
                          <div className="flex items-center gap-1.5 justify-end">
                            {/* CSV Download for this Shift */}
                            <button
                              onClick={() => {
                                const rows = relatedOrders.map(formatOrderCsvRow);
                                exportToCsv(
                                  `Fechamento_${c.closingCode}_${c.operationalDate}`,
                                  rows,
                                  standardOrderCsvHeaders
                                );
                              }}
                              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                              title={`Exportar corridas deste fechamento em CSV`}
                            >
                              <Download className="h-3 w-3 text-orange-500" />
                              <span>CSV</span>
                            </button>

                            {/* Official PDF */}
                            <button
                              onClick={() => {
                                if (companySettings) {
                                  generateShiftClosingPdf(c, relatedOrders, companySettings, c.closedByName);
                                }
                              }}
                              className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                              title="Visualizar e imprimir PDF oficial do fechamento"
                            >
                              <Printer className="h-3 w-3 text-blue-500" />
                              <span>PDF</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      Nenhum fechamento de turno registrado no período selecionado ({activeDateRange.label}).
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
