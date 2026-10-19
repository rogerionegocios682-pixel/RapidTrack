import React, { useState, useMemo } from 'react';
import {
  Send,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  Bike,
  Store,
  MapPin,
  Lock,
  Download,
  AlertCircle,
  FileCheck,
  ChevronDown,
  Edit2,
  Phone,
  User,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  createOrder,
  updateOrderStatus,
  adjustOrderRate,
  checkOrderDuplication,
  executeShiftClosing,
  createAuditLog,
} from '../../services/db';
import { generateShiftClosingPdf } from '../../services/pdfGenerator';
import type {
  DeliveryOrder,
  DeliveryStore,
  Motoboy,
  NeighborhoodRate,
  OrderStatus,
  ShiftClosing,
} from '../../types';
import {
  formatCurrency,
  formatDate,
  formatTime,
  formatDateTime,
  getTodayOperationalDate,
  getCurrentShift,
  maskPhone,
} from '../../utils/formatters';

interface DispatchViewProps {
  orders: DeliveryOrder[];
  stores: DeliveryStore[];
  motoboys: Motoboy[];
  rates: NeighborhoodRate[];
  isNewModalOpen: boolean;
  onCloseNewModal: () => void;
  onOpenNewModal: () => void;
}

export const DispatchView: React.FC<DispatchViewProps> = ({
  orders,
  stores,
  motoboys,
  rates,
  isNewModalOpen,
  onCloseNewModal,
  onOpenNewModal,
}) => {
  const { userProfile, companySettings, isAdmin, isOperator } = useAuth();

  // Filters state
  const [filterDate, setFilterDate] = useState<string>(getTodayOperationalDate());
  const [filterShift, setFilterShift] = useState<string>('all');
  const [filterStore, setFilterStore] = useState<string>('all');
  const [filterMotoboy, setFilterMotoboy] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Active motoboys only for dispatching
  const activeMotoboys = useMemo(() => motoboys.filter((m) => m.active), [motoboys]);
  const activeStores = useMemo(() => stores.filter((s) => s.active), [stores]);

  // New Order Form state
  const [orderNumber, setOrderNumber] = useState('');
  const [dispatchTime, setDispatchTime] = useState(
    new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
  );
  const [operationalDate, setOperationalDate] = useState(getTodayOperationalDate());
  const [shiftName, setShiftName] = useState(getCurrentShift());
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [address, setAddress] = useState('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [addressRef, setAddressRef] = useState('');
  const [rate, setRate] = useState<number | ''>('');
  const [manualRateWarning, setManualRateWarning] = useState(false);
  const [selectedMotoboyId, setSelectedMotoboyId] = useState('');
  const [notes, setNotes] = useState('');

  // Duplication confirmation modal state
  const [duplicateWarning, setDuplicateWarning] = useState<DeliveryOrder | null>(null);

  // Status Action Modals
  const [cancelModalOrder, setCancelModalOrder] = useState<DeliveryOrder | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  const [notFoundModalOrder, setNotFoundModalOrder] = useState<DeliveryOrder | null>(null);
  const [notFoundNotes, setNotFoundNotes] = useState('');

  const [rateAdjustOrder, setRateAdjustOrder] = useState<DeliveryOrder | null>(null);
  const [newRateValue, setNewRateValue] = useState<string>('');
  const [rateAdjustReason, setRateAdjustReason] = useState<string>('');

  // Shift Closing Modal
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closingShiftSelected, setClosingShiftSelected] = useState<string>(getCurrentShift());
  const [closingJustification, setClosingJustification] = useState('');

  // Feedback states
  const [submitLoading, setSubmitLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Filter neighborhoods based on chosen store
  const availableNeighborhoodsForStore = useMemo(() => {
    if (!selectedStoreId) return [];
    return rates.filter((r) => r.storeId === selectedStoreId && r.active);
  }, [rates, selectedStoreId]);

  // Automatically lookup rate when store or neighborhood changes
  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId);
    setSelectedNeighborhood('');
    setRate('');
    setManualRateWarning(false);
  };

  const handleNeighborhoodChange = (neighborhoodName: string) => {
    setSelectedNeighborhood(neighborhoodName);
    const foundRate = rates.find(
      (r) => r.storeId === selectedStoreId && r.neighborhood === neighborhoodName && r.active
    );

    if (foundRate) {
      setRate(foundRate.rate);
      setManualRateWarning(false);
    } else {
      setRate('');
      setManualRateWarning(true);
    }
  };

  // Reset order form
  const resetForm = () => {
    setOrderNumber('');
    setDispatchTime(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false }));
    setClientName('');
    setClientPhone('');
    setAddress('');
    setSelectedNeighborhood('');
    setAddressRef('');
    setRate('');
    setManualRateWarning(false);
    setSelectedMotoboyId('');
    setNotes('');
    setDuplicateWarning(null);
    setErrorMsg(null);
  };

  // Submit Order Dispatch
  const handleSubmitOrder = async (ignoreDuplicate = false) => {
    setErrorMsg(null);

    if (!orderNumber || !selectedStoreId || !clientName || !address || !selectedNeighborhood || rate === '' || !selectedMotoboyId) {
      setErrorMsg('Preencha todos os campos obrigatórios (Pedido, Loja, Cliente, Endereço, Bairro, Valor e Motoboy).');
      return;
    }

    if (!userProfile?.tenantId) return;

    // Check duplication unless user confirmed
    if (!ignoreDuplicate) {
      const existing = await checkOrderDuplication(
        userProfile.tenantId,
        orderNumber,
        selectedStoreId,
        operationalDate
      );
      if (existing) {
        setDuplicateWarning(existing);
        return;
      }
    }

    setSubmitLoading(true);
    try {
      const storeObj = stores.find((s) => s.id === selectedStoreId);
      const motoboyObj = motoboys.find((m) => m.id === selectedMotoboyId);

      const newId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const orderData: DeliveryOrder = {
        id: newId,
        tenantId: userProfile.tenantId,
        orderNumber: orderNumber.trim(),
        dispatchTime,
        operationalDate,
        shiftName,
        storeId: selectedStoreId,
        storeName: storeObj?.name || 'Loja',
        clientName: clientName.trim(),
        clientPhone: clientPhone.trim(),
        address: address.trim(),
        neighborhood: selectedNeighborhood.trim(),
        addressRef: addressRef.trim(),
        rate: Number(rate),
        originalRate: Number(rate),
        manualRateAdjusted: manualRateWarning,
        motoboyId: selectedMotoboyId,
        motoboyName: motoboyObj?.name || 'Motoboy',
        status: 'pending',
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await createOrder(orderData);

      await createAuditLog({
        tenantId: userProfile.tenantId,
        action: 'Corrida despachada',
        entity: 'order',
        entityId: newId,
        details: `Pedido ${orderData.orderNumber} (${orderData.storeName}) para ${orderData.motoboyName} - Valor ${formatCurrency(orderData.rate)}`,
        userId: userProfile.uid,
        userEmail: userProfile.email,
      });

      setSuccessToast(`Pedido ${orderData.orderNumber} despachado com sucesso!`);
      setTimeout(() => setSuccessToast(null), 4000);

      resetForm();
      onCloseNewModal();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro ao registrar corrida.');
    } finally {
      setSubmitLoading(false);
    }
  };

  // Status Actions
  const handleCompleteOrder = async (order: DeliveryOrder) => {
    if (!userProfile) return;
    try {
      await updateOrderStatus(order.id, 'completed', {
        userName: userProfile.name,
        userId: userProfile.uid,
      });

      await createAuditLog({
        tenantId: userProfile.tenantId,
        action: 'Entrega concluída',
        entity: 'order',
        entityId: order.id,
        details: `Pedido ${order.orderNumber} marcado como concluído por ${userProfile.name}`,
        userId: userProfile.uid,
        userEmail: userProfile.email,
      });

      setSuccessToast(`Entrega do pedido ${order.orderNumber} confirmada!`);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      alert('Erro ao concluir entrega: ' + err.message);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalOrder || !userProfile || !cancellationReason.trim()) return;
    try {
      await updateOrderStatus(cancelModalOrder.id, 'canceled', {
        userName: userProfile.name,
        userId: userProfile.uid,
        reason: cancellationReason.trim(),
      });

      await createAuditLog({
        tenantId: userProfile.tenantId,
        action: 'Corrida cancelada',
        entity: 'order',
        entityId: cancelModalOrder.id,
        details: `Pedido ${cancelModalOrder.orderNumber} cancelado. Motivo: ${cancellationReason.trim()}`,
        userId: userProfile.uid,
        userEmail: userProfile.email,
      });

      setCancelModalOrder(null);
      setCancellationReason('');
      setSuccessToast(`Corrida ${cancelModalOrder.orderNumber} cancelada com sucesso.`);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      alert('Erro ao cancelar: ' + err.message);
    }
  };

  const handleConfirmNotFound = async () => {
    if (!notFoundModalOrder || !userProfile) return;
    try {
      await updateOrderStatus(notFoundModalOrder.id, 'client_not_found', {
        userName: userProfile.name,
        userId: userProfile.uid,
        notes: notFoundNotes.trim() || 'Cliente não atendeu / não encontrado',
      });

      await createAuditLog({
        tenantId: userProfile.tenantId,
        action: 'Ocorrência: Cliente não encontrado',
        entity: 'order',
        entityId: notFoundModalOrder.id,
        details: `Ocorrência registrada no pedido ${notFoundModalOrder.orderNumber}`,
        userId: userProfile.uid,
        userEmail: userProfile.email,
      });

      setNotFoundModalOrder(null);
      setNotFoundNotes('');
      setSuccessToast(`Ocorrência registrada no pedido ${notFoundModalOrder.orderNumber}.`);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      alert('Erro ao atualizar ocorrência: ' + err.message);
    }
  };

  const handleConfirmRateAdjust = async () => {
    if (!rateAdjustOrder || !userProfile || !newRateValue || !rateAdjustReason.trim()) return;
    try {
      const val = parseFloat(newRateValue.replace(',', '.'));
      if (isNaN(val) || val < 0) {
        alert('Informe um valor válido.');
        return;
      }

      await adjustOrderRate(rateAdjustOrder, val, rateAdjustReason.trim(), userProfile.uid, userProfile.name);

      await createAuditLog({
        tenantId: userProfile.tenantId,
        action: 'Tarifa da corrida ajustada manualmente',
        entity: 'order',
        entityId: rateAdjustOrder.id,
        details: `Valor alterado de ${formatCurrency(rateAdjustOrder.rate)} para ${formatCurrency(val)}. Motivo: ${rateAdjustReason.trim()}`,
        userId: userProfile.uid,
        userEmail: userProfile.email,
      });

      setRateAdjustOrder(null);
      setNewRateValue('');
      setRateAdjustReason('');
      setSuccessToast(`Valor do pedido ${rateAdjustOrder.orderNumber} ajustado.`);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: any) {
      alert('Erro ao ajustar valor: ' + err.message);
    }
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Date filter
      if (filterDate && o.operationalDate !== filterDate) return false;
      // Shift filter
      if (filterShift !== 'all' && o.shiftName !== filterShift) return false;
      // Store filter
      if (filterStore !== 'all' && o.storeId !== filterStore) return false;
      // Motoboy filter
      if (filterMotoboy !== 'all' && o.motoboyId !== filterMotoboy) return false;
      // Status filter
      if (filterStatus !== 'all' && o.status !== filterStatus) return false;
      // Search query (order number, client name, motoboy name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = o.orderNumber.toLowerCase().includes(q);
        const matchClient = o.clientName.toLowerCase().includes(q);
        const matchMotoboy = o.motoboyName.toLowerCase().includes(q);
        const matchNeighborhood = o.neighborhood.toLowerCase().includes(q);
        if (!matchNumber && !matchClient && !matchMotoboy && !matchNeighborhood) return false;
      }
      return true;
    });
  }, [orders, filterDate, filterShift, filterStore, filterMotoboy, filterStatus, searchQuery]);

  // Shift closing data preview
  const shiftClosingPreview = useMemo(() => {
    const shiftOrders = orders.filter(
      (o) =>
        o.operationalDate === filterDate &&
        (closingShiftSelected === 'all' || o.shiftName === closingShiftSelected) &&
        !o.shiftClosingId
    );

    const completed = shiftOrders.filter((o) => o.status === 'completed');
    const canceled = shiftOrders.filter((o) => o.status === 'canceled');
    const notFound = shiftOrders.filter((o) => o.status === 'client_not_found');
    const pending = shiftOrders.filter((o) => o.status === 'pending');
    const totalAmount = completed.reduce((acc, curr) => acc + curr.rate, 0);

    // Motoboys summary
    const mbMap: Record<string, { id: string; name: string; count: number; amount: number }> = {};
    completed.forEach((o) => {
      if (!mbMap[o.motoboyId]) {
        mbMap[o.motoboyId] = { id: o.motoboyId, name: o.motoboyName, count: 0, amount: 0 };
      }
      mbMap[o.motoboyId].count += 1;
      mbMap[o.motoboyId].amount += o.rate;
    });

    const motoboysSummary = Object.values(mbMap).sort((a, b) => b.count - a.count);

    return {
      totalOrders: shiftOrders.length,
      completedOrders: completed.length,
      canceledOrders: canceled.length,
      notFoundOrders: notFound.length,
      pendingOrders: pending.length,
      totalAmount,
      motoboysSummary,
      ordersToClose: shiftOrders,
    };
  }, [orders, filterDate, closingShiftSelected]);

  // Execute shift closing
  const handleExecuteShiftClosing = async () => {
    if (!userProfile?.tenantId || !companySettings) return;

    if (shiftClosingPreview.pendingOrders > 0 && !closingJustification.trim()) {
      alert('Atenção: Existem corridas pendentes! Resolva-as ou informe uma justificativa formal autorizada para prosseguir com o fechamento.');
      return;
    }

    setSubmitLoading(true);
    try {
      const now = new Date();
      const codeDate = filterDate.replace(/-/g, '');
      const closingCode = `FECH-${codeDate}-${Math.floor(100 + Math.random() * 900)}`;

      const closingRecord: ShiftClosing = {
        id: `close_${Date.now()}`,
        tenantId: userProfile.tenantId,
        closingCode,
        shiftName: closingShiftSelected,
        operationalDate: filterDate,
        closedAt: now.toISOString(),
        closedBy: userProfile.uid,
        closedByName: userProfile.name,
        totalOrders: shiftClosingPreview.totalOrders,
        completedOrders: shiftClosingPreview.completedOrders,
        canceledOrders: shiftClosingPreview.canceledOrders,
        clientNotFoundOrders: shiftClosingPreview.notFoundOrders,
        pendingOrdersResolved: shiftClosingPreview.pendingOrders,
        totalFinancialAmount: shiftClosingPreview.totalAmount,
        motoboysSummary: shiftClosingPreview.motoboysSummary.map((m) => ({
          motoboyId: m.id,
          motoboyName: m.name,
          completedCount: m.count,
          totalAmount: m.amount,
        })),
        notes: closingJustification.trim() || undefined,
      };

      const orderIds = shiftClosingPreview.ordersToClose.map((o) => o.id);
      await executeShiftClosing(closingRecord, orderIds);

      await createAuditLog({
        tenantId: userProfile.tenantId,
        action: 'Fechamento de turno executado',
        entity: 'shift',
        entityId: closingRecord.id,
        details: `Turno ${closingShiftSelected} da data ${formatDate(filterDate)} fechado com código ${closingCode}. Total ${shiftClosingPreview.completedOrders} entregas concluidas.`,
        userId: userProfile.uid,
        userEmail: userProfile.email,
      });

      // Generate PDF immediately
      generateShiftClosingPdf(
        closingRecord,
        shiftClosingPreview.ordersToClose,
        companySettings,
        userProfile.name
      );

      setIsClosingModalOpen(false);
      setClosingJustification('');
      setSuccessToast(`Turno ${closingCode} fechado com sucesso! PDF gerado para impressão.`);
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao fechar turno: ' + err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Toast */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-2xl animate-bounce">
          <CheckCircle className="h-4 w-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Bar: Action Buttons & Title */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">
            Quadro de Despacho de Corridas
          </h2>
          <p className="text-xs text-slate-500">
            Gerenciamento em tempo real de pedidos, bairros atendidos e entrega dos motoboys.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isOperator && (
            <button
              onClick={() => setIsClosingModalOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-xs hover:bg-slate-50 hover:border-slate-400 transition-all"
            >
              <FileCheck className="h-4 w-4 text-emerald-600" />
              <span>FECHAR TURNO</span>
            </button>
          )}

          {isOperator && (
            <button
              onClick={onOpenNewModal}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Corrida</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por pedido, cliente, motoboy ou bairro..."
              className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-hidden"
            />
          </div>

          {/* Date */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">Data:</span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
            />
          </div>

          {/* Turno */}
          <select
            value={filterShift}
            onChange={(e) => setFilterShift(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
          >
            <option value="all">Todos os Turnos</option>
            {companySettings?.shifts?.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* Loja */}
          <select
            value={filterStore}
            onChange={(e) => setFilterStore(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
          >
            <option value="all">Todas as Lojas</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Motoboy */}
          <select
            value={filterMotoboy}
            onChange={(e) => setFilterMotoboy(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
          >
            <option value="all">Todos os Motoboys</option>
            {motoboys.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          {/* Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
          >
            <option value="all">Todas as Situações</option>
            <option value="pending">Pendentes</option>
            <option value="completed">Concluídas</option>
            <option value="canceled">Canceladas</option>
            <option value="client_not_found">Cliente Não Encontrado</option>
          </select>
        </div>

        {/* Counter Summary */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>
            Exibindo <strong>{filteredOrders.length}</strong> corridas filtradas
          </span>
          <div className="flex items-center gap-4">
            <span className="text-emerald-600 font-semibold">
              ● {filteredOrders.filter((o) => o.status === 'completed').length} Concluídas
            </span>
            <span className="text-blue-600 font-semibold">
              ● {filteredOrders.filter((o) => o.status === 'pending').length} Pendentes
            </span>
            <span className="text-red-600 font-semibold">
              ● {filteredOrders.filter((o) => o.status === 'canceled').length} Canceladas
            </span>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3.5 px-4">Pedido / Hora</th>
                <th className="py-3.5 px-4">Loja Origem</th>
                <th className="py-3.5 px-4">Cliente / Contato</th>
                <th className="py-3.5 px-4">Bairro / Endereço</th>
                <th className="py-3.5 px-4">Motoboy</th>
                <th className="py-3.5 px-4">Valor</th>
                <th className="py-3.5 px-4">Situação</th>
                <th className="py-3.5 px-4 text-right">Ações Operacionais</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((ord) => {
                  const isLocked = Boolean(ord.shiftClosingId);

                  return (
                    <tr key={ord.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Pedido / Hora */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{ord.orderNumber}</div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock className="h-3 w-3" />
                          <span>{ord.dispatchTime}</span>
                          <span className="text-slate-300">|</span>
                          <span>{ord.shiftName}</span>
                        </div>
                        {isLocked && (
                          <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-sm bg-slate-100 px-1 text-[9px] font-semibold text-slate-500 border">
                            <Lock className="h-2.5 w-2.5" /> Turno Fechado
                          </span>
                        )}
                      </td>

                      {/* Loja */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-800">{ord.storeName}</span>
                      </td>

                      {/* Cliente */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{ord.clientName}</div>
                        {ord.clientPhone && (
                          <div className="text-[11px] text-slate-500">{ord.clientPhone}</div>
                        )}
                      </td>

                      {/* Bairro / Endereço */}
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="font-bold text-slate-800">{ord.neighborhood}</div>
                        <div className="truncate text-[11px] text-slate-500" title={ord.address}>
                          {ord.address}
                        </div>
                        {ord.addressRef && (
                          <div className="text-[10px] text-slate-400 italic">Ref: {ord.addressRef}</div>
                        )}
                      </td>

                      {/* Motoboy */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                          <Bike className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                          <span>{ord.motoboyName}</span>
                        </div>
                      </td>

                      {/* Valor */}
                      <td className="py-3 px-4">
                        <div className="font-black text-slate-900">
                          {formatCurrency(ord.rate)}
                        </div>
                        {ord.manualRateAdjusted && (
                          <span className="inline-block text-[9px] font-bold text-orange-600 bg-orange-50 px-1 rounded-sm border border-orange-200">
                            Ajustado
                          </span>
                        )}
                      </td>

                      {/* Situação */}
                      <td className="py-3 px-4">
                        {ord.status === 'completed' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                            <CheckCircle className="h-3 w-3" />
                            Concluída
                          </span>
                        )}
                        {ord.status === 'pending' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                            <Clock className="h-3 w-3" />
                            Pendente
                          </span>
                        )}
                        {ord.status === 'canceled' && (
                          <div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-700 border border-red-200">
                              <XCircle className="h-3 w-3" />
                              Cancelada
                            </span>
                            {ord.cancellationReason && (
                              <p className="text-[10px] text-red-500 mt-0.5 truncate max-w-[120px]" title={ord.cancellationReason}>
                                {ord.cancellationReason}
                              </p>
                            )}
                          </div>
                        )}
                        {ord.status === 'client_not_found' && (
                          <div>
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                              <AlertTriangle className="h-3 w-3" />
                              Não Encontrado
                            </span>
                            {ord.clientNotFoundNotes && (
                              <p className="text-[10px] text-amber-600 mt-0.5 truncate max-w-[120px]" title={ord.clientNotFoundNotes}>
                                {ord.clientNotFoundNotes}
                              </p>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-4 text-right">
                        {!isLocked ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {ord.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleCompleteOrder(ord)}
                                  title="Confirmar Entrega Concluída"
                                  className="rounded-lg bg-emerald-600 p-1.5 text-white shadow-xs hover:bg-emerald-700 transition-all active:scale-90"
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    setCancelModalOrder(ord);
                                    setCancellationReason('');
                                  }}
                                  title="Cancelar Corrida"
                                  className="rounded-lg bg-red-50 p-1.5 text-red-600 border border-red-200 hover:bg-red-100 transition-all"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    setNotFoundModalOrder(ord);
                                    setNotFoundNotes('');
                                  }}
                                  title="Cliente Não Encontrado"
                                  className="rounded-lg bg-amber-50 p-1.5 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-all"
                                >
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}

                            {isAdmin && (
                              <button
                                onClick={() => {
                                  setRateAdjustOrder(ord);
                                  setNewRateValue(String(ord.rate));
                                  setRateAdjustReason('');
                                }}
                                title="Ajustar Tarifa Manualmente"
                                className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200 transition-all"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Travado</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Send className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 text-sm font-semibold text-slate-700">Nenhuma corrida encontrada</p>
                    <p className="text-xs text-slate-400 mt-1">
                      Ajuste os filtros ou clique em "Nova Corrida" para despachar pedidos.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Nova Corrida */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Send className="h-5 w-5 text-orange-500" />
                  Cadastrar e Despachar Corrida
                </h3>
                <p className="text-xs text-slate-500">
                  Preencha os dados do pedido. O valor da entrega é preenchido automaticamente pela tabela do bairro.
                </p>
              </div>
              <button
                onClick={onCloseNewModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-800 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmitOrder();
              }}
              className="space-y-4"
            >
              {/* Row 1: Número do Pedido, Horário, Turno */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Número do Pedido *
                  </label>
                  <input
                    type="text"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    placeholder="Ex: #1042 ou IFD-998"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Horário do Despacho *
                  </label>
                  <input
                    type="time"
                    value={dispatchTime}
                    onChange={(e) => setDispatchTime(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Turno Operacional *
                  </label>
                  <select
                    value={shiftName}
                    onChange={(e) => setShiftName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
                  >
                    {companySettings?.shifts?.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Loja de Origem & Bairro (with automated rate) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Loja / Empresa de Origem *
                  </label>
                  <select
                    value={selectedStoreId}
                    onChange={(e) => handleStoreChange(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
                  >
                    <option value="">Selecione a loja parceira...</option>
                    {activeStores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Bairro de Entrega *
                  </label>
                  <select
                    value={selectedNeighborhood}
                    onChange={(e) => handleNeighborhoodChange(e.target.value)}
                    required
                    disabled={!selectedStoreId}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden disabled:bg-slate-100"
                  >
                    <option value="">Selecione o bairro...</option>
                    {availableNeighborhoodsForStore.map((r) => (
                      <option key={r.id} value={r.neighborhood}>
                        {r.neighborhood} — {formatCurrency(r.rate)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Valor da Corrida (Auto-filled or warning) */}
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-700">Valor da Corrida *</span>
                    <p className="text-[11px] text-slate-500">
                      Calculado automaticamente a partir da tabela do bairro selecionado.
                    </p>
                  </div>
                  <div className="w-36">
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">R$</span>
                      <input
                        type="number"
                        step="0.50"
                        value={rate}
                        onChange={(e) => {
                          setRate(e.target.value === '' ? '' : parseFloat(e.target.value));
                          setManualRateWarning(true);
                        }}
                        placeholder="0,00"
                        required
                        className="w-full rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-sm font-black text-slate-900 focus:border-orange-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {manualRateWarning && (
                  <div className="mt-2 text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    Valor definido ou alterado manualmente. Esta alteração será registrada na auditoria.
                  </div>
                )}
              </div>

              {/* Row 3: Cliente & Telefone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome do Cliente / Destinatário *
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Nome completo do cliente"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Telefone / WhatsApp (opcional)
                  </label>
                  <input
                    type="text"
                    value={clientPhone}
                    onChange={(e) => setClientPhone(maskPhone(e.target.value))}
                    placeholder="(81) 98765-4321"
                    maxLength={15}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Row 4: Endereço & Referência */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Endereço de Entrega *
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Rua, Número, Bloco, Apartamento"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ponto de Referência
                  </label>
                  <input
                    type="text"
                    value={addressRef}
                    onChange={(e) => setAddressRef(e.target.value)}
                    placeholder="Próximo à padaria..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Row 5: Motoboy Responsável */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motoboy Responsável * (Apenas ativos)
                </label>
                <select
                  value={selectedMotoboyId}
                  onChange={(e) => setSelectedMotoboyId(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-hidden"
                >
                  <option value="">Selecione o motoboy para despacho...</option>
                  {activeMotoboys.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.phone})
                    </option>
                  ))}
                </select>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações da Entrega (opcional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instruções de pagamento na entrega, troco, portaria..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onCloseNewModal}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="rounded-xl bg-orange-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 disabled:opacity-50"
                >
                  {submitLoading ? 'Despachando...' : 'Confirmar e Despachar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Alerta de Possível Duplicidade */}
      {duplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border-2 border-amber-300">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-100 p-2 text-amber-700">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Possível Pedido Duplicado
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Já existe um pedido com o número <strong>{orderNumber}</strong> registrado para esta mesma loja hoje ({formatDate(operationalDate)}).
                </p>
                <div className="mt-3 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-700 space-y-1">
                  <p><strong>Cliente:</strong> {duplicateWarning.clientName}</p>
                  <p><strong>Motoboy atual:</strong> {duplicateWarning.motoboyName}</p>
                  <p><strong>Status:</strong> {duplicateWarning.status}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                onClick={() => setDuplicateWarning(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Voltar e Corrigir
              </button>
              <button
                onClick={() => {
                  setDuplicateWarning(null);
                  handleSubmitOrder(true);
                }}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700"
              >
                Confirmar Cadastro Mesmo Assim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Cancelamento de Corrida */}
      {cancelModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-black text-red-600 flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Cancelar Corrida {cancelModalOrder.orderNumber}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Informe obrigatoriamente o motivo do cancelamento para fins de auditoria e relatórios.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motivo do Cancelamento *
              </label>
              <textarea
                rows={3}
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Ex: Pedido cancelado pelo cliente antes da saída, problema na cozinha..."
                required
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-red-500 focus:outline-hidden"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                onClick={() => setCancelModalOrder(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={!cancellationReason.trim()}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Cliente Não Encontrado */}
      {notFoundModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-black text-amber-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Ocorrência: Cliente Não Encontrado
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Registrar tentativa frustrada de entrega para o pedido {notFoundModalOrder.orderNumber}.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Observação / Justificativa da Ocorrência *
              </label>
              <textarea
                rows={3}
                value={notFoundNotes}
                onChange={(e) => setNotFoundNotes(e.target.value)}
                placeholder="Ex: Motoboy aguardou 15 min no portão, cliente não atendeu ligações..."
                required
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-amber-500 focus:outline-hidden"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                onClick={() => setNotFoundModalOrder(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmNotFound}
                className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700"
              >
                Registrar Ocorrência
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Ajustar Valor Manualmente */}
      {rateAdjustOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-500" />
              Ajuste de Valor da Corrida {rateAdjustOrder.orderNumber}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Valor atual: <strong>{formatCurrency(rateAdjustOrder.rate)}</strong>. Toda alteração manual requer justificativa.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Novo Valor (R$) *
                </label>
                <input
                  type="text"
                  value={newRateValue}
                  onChange={(e) => setNewRateValue(e.target.value)}
                  placeholder="Ex: 15,00"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo da Alteração *
                </label>
                <textarea
                  rows={2}
                  value={rateAdjustReason}
                  onChange={(e) => setRateAdjustReason(e.target.value)}
                  placeholder="Ex: Chuva forte, taxa de espera combinada, distância adicional..."
                  required
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                onClick={() => setRateAdjustOrder(null)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirmRateAdjust}
                disabled={!rateAdjustReason.trim() || !newRateValue}
                className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
              >
                Salvar Ajuste Auditado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: FECHAMENTO DE TURNO COM PRÉVIA E PDF */}
      {isClosingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-emerald-600" />
                  Fechamento Oficial de Turno
                </h3>
                <p className="text-xs text-slate-500">
                  Data: {formatDate(filterDate)} | Operador: {userProfile?.name}
                </p>
              </div>
              <button
                onClick={() => setIsClosingModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Shift selector */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Selecione o Turno a Fechar:
              </label>
              <select
                value={closingShiftSelected}
                onChange={(e) => setClosingShiftSelected(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-hidden"
              >
                <option value="all">Todos os Turnos da Data</option>
                {companySettings?.shifts?.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Resumo do Turno */}
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Prévia Operacional do Turno
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg bg-white p-3 border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 font-semibold">Total Corridas</span>
                  <p className="text-lg font-black text-slate-900">{shiftClosingPreview.totalOrders}</p>
                </div>
                <div className="rounded-lg bg-white p-3 border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 font-semibold">Concluídas</span>
                  <p className="text-lg font-black text-emerald-600">{shiftClosingPreview.completedOrders}</p>
                </div>
                <div className="rounded-lg bg-white p-3 border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 font-semibold">Canceladas / Não Enc.</span>
                  <p className="text-lg font-black text-red-600">
                    {shiftClosingPreview.canceledOrders + shiftClosingPreview.notFoundOrders}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3 border border-slate-200 text-center">
                  <span className="text-[10px] text-slate-500 font-semibold">Total Financeiro</span>
                  <p className="text-lg font-black text-slate-900">
                    {formatCurrency(shiftClosingPreview.totalAmount)}
                  </p>
                </div>
              </div>

              {/* Pendências Alert */}
              {shiftClosingPreview.pendingOrders > 0 && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-xs text-orange-900 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-orange-950">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    <span>Atenção: Existem {shiftClosingPreview.pendingOrders} corridas pendentes de desfecho!</span>
                  </div>
                  <p className="text-[11px] text-orange-800 leading-tight">
                    O sistema não permite fechar o turno silenciosamente com pendências. É obrigatório registrar uma justificativa formal autorizada para prosseguir.
                  </p>
                  <div>
                    <label className="block text-[11px] font-bold text-orange-950 mb-1">
                      Justificativa Formal das Pendências *
                    </label>
                    <textarea
                      rows={2}
                      value={closingJustification}
                      onChange={(e) => setClosingJustification(e.target.value)}
                      placeholder="Ex: Motoboy Lucas retornará com comprovantes no turno seguinte..."
                      required
                      className="w-full rounded-lg border border-orange-300 p-2 text-xs bg-white text-slate-900 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}

              {/* Ranking dos Motoboys do Turno */}
              <div className="pt-2">
                <span className="text-xs font-bold text-slate-700">Ranking e Repasse de Motoboys no Turno:</span>
                <div className="mt-2 divide-y divide-slate-200 rounded-lg bg-white border border-slate-200 overflow-hidden text-xs">
                  {shiftClosingPreview.motoboysSummary.length > 0 ? (
                    shiftClosingPreview.motoboysSummary.map((mb, idx) => (
                      <div key={mb.id} className="flex items-center justify-between p-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                            {idx + 1}º
                          </span>
                          <span className="font-bold text-slate-800">{mb.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-slate-500">{mb.count} entregas</span>
                          <span className="font-black text-slate-900">{formatCurrency(mb.amount)}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-slate-400">Nenhum motoboy com entrega concluída neste turno.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-[11px] text-slate-500">
                Ao fechar, as corridas serão travadas e o PDF será gerado imediatamente.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsClosingModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleExecuteShiftClosing}
                  disabled={
                    submitLoading ||
                    shiftClosingPreview.totalOrders === 0 ||
                    (shiftClosingPreview.pendingOrders > 0 && !closingJustification.trim())
                  }
                  className="rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Download className="h-4 w-4" />
                  {submitLoading ? 'Fechando Turno...' : 'Fechar Turno e Gerar PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
