import React, { useState, useMemo, useEffect } from 'react';
import {
  Bike,
  Store,
  MapPin,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  AlertCircle,
  Phone,
  ShieldCheck,
  TrendingUp,
  Check,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  createMotoboy,
  updateMotoboy,
  deleteMotoboy,
  createStore,
  updateStore,
  deleteStore,
  createRate,
  updateRate,
  deleteRate,
  createAuditLog,
} from '../../services/db';
import type { Motoboy, DeliveryStore, NeighborhoodRate } from '../../types';
import {
  formatCurrency,
  formatDate,
  maskCpf,
  maskPhone,
  maskCnpj,
  validateCpf,
  validateCnpj,
} from '../../utils/formatters';

interface RegistrationsViewProps {
  initialTab?: 'motoboys' | 'lojas' | 'tarifas';
  tenantId?: string;
  motoboys: Motoboy[];
  stores: DeliveryStore[];
  rates: NeighborhoodRate[];
}

export const RegistrationsView: React.FC<RegistrationsViewProps> = ({
  initialTab = 'motoboys',
  tenantId: propTenantId,
  motoboys,
  stores,
  rates,
}) => {
  const { userProfile, tenant, isAdmin, isOperator } = useAuth();
  const canManage = isAdmin || isOperator || !userProfile || userProfile.role !== 'viewer';
  const [activeTab, setActiveTab] = useState<'motoboys' | 'lojas' | 'tarifas'>(initialTab);

  // Sync tab with initialTab prop changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Local synced state for instant UI updates & persistence feedback
  const [localMotoboys, setLocalMotoboys] = useState<Motoboy[]>(motoboys);
  const [localStores, setLocalStores] = useState<DeliveryStore[]>(stores);
  const [localRates, setLocalRates] = useState<NeighborhoodRate[]>(rates);

  useEffect(() => {
    setLocalMotoboys(motoboys);
  }, [motoboys]);

  useEffect(() => {
    setLocalStores(stores);
  }, [stores]);

  useEffect(() => {
    setLocalRates(rates);
  }, [rates]);

  // Search & filter queries
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStoreForRates, setFilterStoreForRates] = useState<string>('all');

  // Modal states
  const [isMotoboyModalOpen, setIsMotoboyModalOpen] = useState(false);
  const [editingMotoboy, setEditingMotoboy] = useState<Motoboy | null>(null);
  const [mbName, setMbName] = useState('');
  const [mbCpf, setMbCpf] = useState('');
  const [mbPhone, setMbPhone] = useState('');
  const [mbNotes, setMbNotes] = useState('');
  const [mbActive, setMbActive] = useState(true);

  // Store modal
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<DeliveryStore | null>(null);
  const [stName, setStName] = useState('');
  const [stCode, setStCode] = useState('');
  const [stCnpj, setStCnpj] = useState('');
  const [stPhone, setStPhone] = useState('');
  const [stNotes, setStNotes] = useState('');
  const [stActive, setStActive] = useState(true);

  // Rate modal
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<NeighborhoodRate | null>(null);
  const [rtStoreId, setRtStoreId] = useState('');
  const [rtNeighborhood, setRtNeighborhood] = useState('');
  const [rtRate, setRtRate] = useState<string>('');
  const [rtNotes, setRtNotes] = useState('');
  const [rtActive, setRtActive] = useState(true);

  // Error/Success state
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Helper to get active tenantId with multi-level resilient fallback
  const getActiveTenantId = (): string => {
    if (propTenantId) return propTenantId;
    if (userProfile?.tenantId) return userProfile.tenantId;
    if (tenant?.id) return tenant.id;
    try {
      const stored = localStorage.getItem('delivery_os_user_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.tenantId) return parsed.tenantId;
      }
    } catch {}
    if (localStorage.getItem('delivery_os_master_session') === 'true') {
      return 'tenant_master_herculano';
    }
    return 'tenant_usr_179190';
  };

  // Filtered lists
  const filteredMotoboys = useMemo(() => {
    return localMotoboys.filter((m) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return m.name.toLowerCase().includes(q) || m.cpf.includes(q) || m.phone.includes(q);
    });
  }, [localMotoboys, searchQuery]);

  const filteredStores = useMemo(() => {
    return localStores.filter((s) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q);
    });
  }, [localStores, searchQuery]);

  const filteredRates = useMemo(() => {
    return localRates.filter((r) => {
      if (filterStoreForRates !== 'all' && r.storeId !== filterStoreForRates) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return r.neighborhood.toLowerCase().includes(q) || r.storeName.toLowerCase().includes(q);
    });
  }, [localRates, filterStoreForRates, searchQuery]);

  // Motoboy submit
  const handleSaveMotoboy = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!mbName.trim() || !mbCpf.trim() || !mbPhone.trim()) {
      setErrorMsg('Preencha os campos obrigatórios (Nome, CPF e Telefone).');
      return;
    }

    const cleanCpfDigits = mbCpf.replace(/\D/g, '');
    if (!validateCpf(mbCpf)) {
      setErrorMsg(
        cleanCpfDigits.length !== 11
          ? `O CPF informado deve conter 11 dígitos (você informou ${cleanCpfDigits.length}).`
          : 'CPF inválido. Verifique os dígitos informados.'
      );
      return;
    }

    const tenantId = getActiveTenantId();
    setLoading(true);
    try {
      if (editingMotoboy) {
        const updatedMb: Motoboy = {
          ...editingMotoboy,
          tenantId: editingMotoboy.tenantId || tenantId,
          name: mbName.trim(),
          phone: mbPhone.trim(),
          cpf: mbCpf.trim() || editingMotoboy.cpf,
          notes: mbNotes.trim(),
          active: mbActive,
        };

        await updateMotoboy(editingMotoboy.id, updatedMb);

        setLocalMotoboys((prev) =>
          prev.map((m) => (m.id === editingMotoboy.id ? updatedMb : m))
        );

        createAuditLog({
          tenantId,
          action: 'Motoboy atualizado',
          entity: 'motoboy',
          entityId: editingMotoboy.id,
          details: `Dados do motoboy ${mbName} alterados por ${userProfile?.name || 'Administrador'}`,
          userId: userProfile?.uid || 'user',
          userEmail: userProfile?.email || '',
        }).catch(console.error);

        setSuccessToast(`Motoboy "${mbName}" atualizado com sucesso!`);
      } else {
        const id = `mb_${Date.now()}`;
        const newMb: Motoboy = {
          id,
          tenantId,
          name: mbName.trim(),
          cpf: mbCpf.trim(),
          phone: mbPhone.trim(),
          active: mbActive,
          notes: mbNotes.trim(),
          createdAt: new Date().toISOString(),
        };

        await createMotoboy(newMb);

        setLocalMotoboys((prev) => [newMb, ...prev]);

        createAuditLog({
          tenantId,
          action: 'Novo motoboy cadastrado',
          entity: 'motoboy',
          entityId: id,
          details: `Motoboy ${mbName} cadastrado com CPF ${mbCpf}`,
          userId: userProfile?.uid || 'user',
          userEmail: userProfile?.email || '',
        }).catch(console.error);

        setSuccessToast(`Motoboy "${mbName}" cadastrado com sucesso!`);
      }

      setIsMotoboyModalOpen(false);
      setEditingMotoboy(null);
      setMbName('');
      setMbCpf('');
      setMbPhone('');
      setMbNotes('');
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro ao salvar motoboy.');
    } finally {
      setLoading(false);
    }
  };

  // Store submit
  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!stName.trim() || !stCode.trim()) {
      setErrorMsg('Preencha o Nome e o Identificador interno da empresa de entrega.');
      return;
    }

    if (stCnpj && !validateCnpj(stCnpj)) {
      setErrorMsg('CNPJ informado deve conter 14 dígitos.');
      return;
    }

    const tenantId = getActiveTenantId();
    setLoading(true);
    try {
      if (editingStore) {
        const updatedStore: DeliveryStore = {
          ...editingStore,
          tenantId: editingStore.tenantId || tenantId,
          name: stName.trim(),
          code: stCode.trim().toUpperCase(),
          cnpj: stCnpj.trim() || undefined,
          phone: stPhone.trim() || undefined,
          notes: stNotes.trim() || undefined,
          active: stActive,
        };

        await updateStore(editingStore.id, updatedStore);

        setLocalStores((prev) =>
          prev.map((s) => (s.id === editingStore.id ? updatedStore : s))
        );

        createAuditLog({
          tenantId,
          action: 'Empresa de entrega atualizada',
          entity: 'store',
          entityId: editingStore.id,
          details: `Dados da loja ${stName} alterados por ${userProfile?.name || 'Administrador'}`,
          userId: userProfile?.uid || 'user',
          userEmail: userProfile?.email || '',
        }).catch(console.error);

        setSuccessToast(`Empresa "${stName}" atualizada com sucesso!`);
      } else {
        const id = `store_${Date.now()}`;
        const newStore: DeliveryStore = {
          id,
          tenantId,
          name: stName.trim(),
          code: stCode.trim().toUpperCase(),
          cnpj: stCnpj.trim() || undefined,
          phone: stPhone.trim() || undefined,
          active: stActive,
          notes: stNotes.trim() || undefined,
          createdAt: new Date().toISOString(),
        };

        await createStore(newStore);

        setLocalStores((prev) => [...prev, newStore]);

        createAuditLog({
          tenantId,
          action: 'Nova empresa de entrega cadastrada',
          entity: 'store',
          entityId: id,
          details: `Loja ${stName} (${stCode}) cadastrada`,
          userId: userProfile?.uid || 'user',
          userEmail: userProfile?.email || '',
        }).catch(console.error);

        setSuccessToast(`Empresa de entrega "${stName}" cadastrada com sucesso!`);
      }

      setIsStoreModalOpen(false);
      setEditingStore(null);
      setStName('');
      setStCode('');
      setStCnpj('');
      setStPhone('');
      setStNotes('');
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro ao salvar empresa.');
    } finally {
      setLoading(false);
    }
  };

  // Rate submit
  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!rtNeighborhood.trim() || !rtRate) {
      setErrorMsg('Preencha o Bairro e o Valor da tarifa.');
      return;
    }

    const numVal = parseFloat(String(rtRate).replace(',', '.'));
    if (isNaN(numVal) || numVal < 0) {
      setErrorMsg('Informe um valor de tarifa numérico válido.');
      return;
    }

    const tenantId = getActiveTenantId();
    // Resolve store id with graceful fallback
    const resolvedStoreId = rtStoreId || (localStores[0]?.id || 'matriz');
    const storeObj = localStores.find((s) => s.id === resolvedStoreId);
    const storeName = storeObj?.name || (localStores.length > 0 ? localStores[0].name : 'Loja Principal');

    setLoading(true);
    try {
      if (editingRate) {
        const updatedRate: NeighborhoodRate = {
          ...editingRate,
          tenantId: editingRate.tenantId || tenantId,
          storeId: resolvedStoreId,
          storeName: storeObj?.name || editingRate.storeName,
          neighborhood: rtNeighborhood.trim(),
          rate: numVal,
          active: rtActive,
          notes: rtNotes.trim() || undefined,
          updatedAt: new Date().toISOString(),
        };

        await updateRate(editingRate.id, updatedRate);

        setLocalRates((prev) =>
          prev.map((r) => (r.id === editingRate.id ? updatedRate : r))
        );

        createAuditLog({
          tenantId,
          action: 'Tarifa de bairro alterada',
          entity: 'rate',
          entityId: editingRate.id,
          details: `Tarifa para ${rtNeighborhood} (${storeName}) atualizada de ${formatCurrency(editingRate.rate)} para ${formatCurrency(numVal)}`,
          userId: userProfile?.uid || 'user',
          userEmail: userProfile?.email || '',
        }).catch(console.error);

        setSuccessToast(`Tarifa para o bairro "${rtNeighborhood}" atualizada com sucesso!`);
      } else {
        const id = `rate_${Date.now()}`;
        const newRate: NeighborhoodRate = {
          id,
          tenantId,
          storeId: resolvedStoreId,
          storeName,
          neighborhood: rtNeighborhood.trim(),
          rate: numVal,
          active: rtActive,
          notes: rtNotes.trim() || undefined,
          updatedAt: new Date().toISOString(),
        };

        await createRate(newRate);

        setLocalRates((prev) => [newRate, ...prev]);

        createAuditLog({
          tenantId,
          action: 'Nova tarifa de bairro cadastrada',
          entity: 'rate',
          entityId: id,
          details: `Tarifa para ${rtNeighborhood} (${storeName}) fixada em ${formatCurrency(numVal)}`,
          userId: userProfile?.uid || 'user',
          userEmail: userProfile?.email || '',
        }).catch(console.error);

        setSuccessToast(`Tarifa para "${rtNeighborhood}" (${storeName}) cadastrada com sucesso!`);
      }

      setIsRateModalOpen(false);
      setEditingRate(null);
      setRtNeighborhood('');
      setRtRate('');
      setRtNotes('');
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro ao salvar tarifa.');
    } finally {
      setLoading(false);
    }
  };

  // Delete Motoboy
  const handleDeleteMotoboy = async (m: Motoboy) => {
    if (!window.confirm(`Deseja realmente excluir o motoboy "${m.name}"?`)) return;
    const tenantId = getActiveTenantId();
    try {
      await deleteMotoboy(m.id, tenantId);
      setLocalMotoboys((prev) => prev.filter((item) => item.id !== m.id));
      createAuditLog({
        tenantId,
        action: 'Motoboy excluído',
        entity: 'motoboy',
        entityId: m.id,
        details: `Motoboy ${m.name} excluído por ${userProfile?.name || 'Administrador'}`,
        userId: userProfile?.uid || 'user',
        userEmail: userProfile?.email || '',
      }).catch(console.error);
      setSuccessToast(`Motoboy "${m.name}" excluído com sucesso.`);
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao excluir motoboy.');
    }
  };

  // Delete Store
  const handleDeleteStore = async (s: DeliveryStore) => {
    if (!window.confirm(`Deseja realmente excluir a empresa de entrega "${s.name}"?`)) return;
    const tenantId = getActiveTenantId();
    try {
      await deleteStore(s.id, tenantId);
      setLocalStores((prev) => prev.filter((item) => item.id !== s.id));
      createAuditLog({
        tenantId,
        action: 'Empresa de entrega excluída',
        entity: 'store',
        entityId: s.id,
        details: `Empresa ${s.name} excluída por ${userProfile?.name || 'Administrador'}`,
        userId: userProfile?.uid || 'user',
        userEmail: userProfile?.email || '',
      }).catch(console.error);
      setSuccessToast(`Empresa "${s.name}" excluída com sucesso.`);
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao excluir empresa.');
    }
  };

  // Delete Rate
  const handleDeleteRate = async (r: NeighborhoodRate) => {
    if (!window.confirm(`Deseja realmente excluir a tarifa do bairro "${r.neighborhood}" (${r.storeName})?`)) return;
    const tenantId = getActiveTenantId();
    try {
      await deleteRate(r.id, tenantId);
      setLocalRates((prev) => prev.filter((item) => item.id !== r.id));
      createAuditLog({
        tenantId,
        action: 'Tarifa de bairro excluída',
        entity: 'rate',
        entityId: r.id,
        details: `Tarifa para ${r.neighborhood} (${r.storeName}) excluída`,
        userId: userProfile?.uid || 'user',
        userEmail: userProfile?.email || '',
      }).catch(console.error);
      setSuccessToast(`Tarifa para "${r.neighborhood}" excluída com sucesso.`);
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao excluir tarifa.');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header and Tab Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">
            Cadastros Operacionais
          </h2>
          <p className="text-xs text-slate-500">
            Gerenciamento de motoboys, empresas/lojas parceiras de entrega e tabelas de tarifas por bairro.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex rounded-xl bg-slate-200/80 p-1 text-xs font-bold text-slate-600">
          <button
            onClick={() => setActiveTab('motoboys')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 transition-all ${
              activeTab === 'motoboys' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <Bike className="h-4 w-4 text-orange-500" />
            <span>Motoboys ({motoboys.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('lojas')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 transition-all ${
              activeTab === 'lojas' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <Store className="h-4 w-4 text-orange-500" />
            <span>Empresas ({stores.length}/10)</span>
          </button>

          <button
            onClick={() => setActiveTab('tarifas')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 transition-all ${
              activeTab === 'tarifas' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            <MapPin className="h-4 w-4 text-orange-500" />
            <span>Bairros & Tarifas ({rates.length})</span>
          </button>
        </div>
      </div>

      {/* Success Feedback Notification Toast */}
      {successToast && (
        <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 p-3 text-xs font-bold text-emerald-800 border border-emerald-200 shadow-sm animate-fade-in">
          <Check className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 1: MOTOBOYS */}
      {/* ======================================================== */}
      {activeTab === 'motoboys' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar motoboy por nome, CPF ou telefone..."
                className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-hidden"
              />
            </div>

            {canManage && (
              <button
                onClick={() => {
                  setEditingMotoboy(null);
                  setMbName('');
                  setMbCpf('');
                  setMbPhone('');
                  setMbNotes('');
                  setMbActive(true);
                  setErrorMsg(null);
                  setIsMotoboyModalOpen(true);
                }}
                className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Cadastrar Motoboy</span>
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">Motoboy</th>
                  <th className="py-3 px-4">CPF</th>
                  <th className="py-3 px-4">Celular</th>
                  <th className="py-3 px-4">Data Cadastro</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredMotoboys.length > 0 ? (
                  filteredMotoboys.map((mb) => (
                    <tr key={mb.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{mb.name}</div>
                        {mb.notes && <div className="text-[11px] text-slate-400">{mb.notes}</div>}
                      </td>
                      <td className="py-3 px-4 font-mono">{mb.cpf}</td>
                      <td className="py-3 px-4">{mb.phone}</td>
                      <td className="py-3 px-4 text-slate-500">{formatDate(mb.createdAt)}</td>
                      <td className="py-3 px-4">
                        {mb.active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 border border-slate-200">
                            <XCircle className="h-3 w-3" />
                            Inativo
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canManage && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingMotoboy(mb);
                                setMbName(mb.name);
                                setMbCpf(mb.cpf);
                                setMbPhone(mb.phone);
                                setMbNotes(mb.notes || '');
                                setMbActive(mb.active);
                                setErrorMsg(null);
                                setIsMotoboyModalOpen(true);
                              }}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                              title="Editar dados"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMotoboy(mb)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Excluir motoboy"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      Nenhum motoboy encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: LOJAS / EMPRESAS DE ENTREGA */}
      {/* ======================================================== */}
      {activeTab === 'lojas' && (
        <div className="space-y-4">
          {/* Plan Limit Banner */}
          {/* Store info banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-950">
            <div>
              <p className="font-bold flex items-center gap-2">
                <Store className="h-4 w-4 text-blue-600" />
                Empresas e Lojas de Entrega Cadastradas
              </p>
              <p className="text-[11px] text-blue-700 mt-0.5">
                Gerencie as empresas parceiras e pontos de expedição de pedidos.
              </p>
            </div>
            <div className="mt-2 sm:mt-0 font-bold text-sm bg-white px-3 py-1.5 rounded-lg border border-blue-200 shadow-xs">
              {localStores.length} Empresa(s) Cadastrada(s)
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar loja por nome ou identificador..."
                className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-hidden"
              />
            </div>

            {canManage && (
              <button
                onClick={() => {
                  setEditingStore(null);
                  setStName('');
                  setStCode(`LOJA-${localStores.length + 1}`);
                  setStCnpj('');
                  setStPhone('');
                  setStNotes('');
                  setStActive(true);
                  setErrorMsg(null);
                  setIsStoreModalOpen(true);
                }}
                className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Cadastrar Empresa de Origem</span>
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">Nome da Loja</th>
                  <th className="py-3 px-4">Identificador</th>
                  <th className="py-3 px-4">CNPJ</th>
                  <th className="py-3 px-4">Telefone</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredStores.length > 0 ? (
                  filteredStores.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{st.name}</div>
                        {st.notes && <div className="text-[11px] text-slate-400">{st.notes}</div>}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-700">{st.code}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{st.cnpj || '--'}</td>
                      <td className="py-3 px-4">{st.phone || '--'}</td>
                      <td className="py-3 px-4">
                        {st.active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Ativa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 border border-slate-200">
                            <XCircle className="h-3 w-3" />
                            Inativa
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canManage && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingStore(st);
                                setStName(st.name);
                                setStCode(st.code);
                                setStCnpj(st.cnpj || '');
                                setStPhone(st.phone || '');
                                setStNotes(st.notes || '');
                                setStActive(st.active);
                                setErrorMsg(null);
                                setIsStoreModalOpen(true);
                              }}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                              title="Editar dados"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteStore(st)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Excluir empresa"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      Nenhuma empresa de entrega cadastrada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: BAIRROS E TARIFAS */}
      {/* ======================================================== */}
      {activeTab === 'tarifas' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[220px]">
                <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar bairro ou loja..."
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-orange-500 focus:outline-hidden"
                />
              </div>

              <select
                value={filterStoreForRates}
                onChange={(e) => setFilterStoreForRates(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-orange-500 focus:outline-hidden"
              >
                <option value="all">Todas as Lojas</option>
                {localStores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {canManage && (
              <button
                onClick={() => {
                  setEditingRate(null);
                  setRtStoreId(localStores[0]?.id || 'matriz');
                  setRtNeighborhood('');
                  setRtRate('');
                  setRtNotes('');
                  setRtActive(true);
                  setErrorMsg(null);
                  setIsRateModalOpen(true);
                }}
                className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 transition-all"
              >
                <Plus className="h-4 w-4" />
                <span>Nova Tarifa de Bairro</span>
              </button>
            )}
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">Loja / Empresa</th>
                  <th className="py-3 px-4">Bairro Atendido</th>
                  <th className="py-3 px-4">Valor da Corrida</th>
                  <th className="py-3 px-4">Situação</th>
                  <th className="py-3 px-4">Última Atualização</th>
                  <th className="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredRates.length > 0 ? (
                  filteredRates.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{r.storeName}</td>
                      <td className="py-3 px-4 font-semibold text-slate-800">{r.neighborhood}</td>
                      <td className="py-3 px-4 font-black text-slate-900">
                        {formatCurrency(r.rate)}
                      </td>
                      <td className="py-3 px-4">
                        {r.active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            Ativa
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 border border-slate-200">
                            Inativa
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[11px]">
                        {formatDate(r.updatedAt)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canManage && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingRate(r);
                                setRtStoreId(r.storeId);
                                setRtNeighborhood(r.neighborhood);
                                setRtRate(String(r.rate));
                                setRtNotes(r.notes || '');
                                setRtActive(r.active);
                                setErrorMsg(null);
                                setIsRateModalOpen(true);
                              }}
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                              title="Editar tarifa"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteRate(r)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Excluir tarifa"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      Nenhuma tarifa de bairro cadastrada para os filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL MOTOBOY */}
      {/* ======================================================== */}
      {isMotoboyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Bike className="h-5 w-5 text-orange-500" />
              {editingMotoboy ? 'Editar Motoboy' : 'Cadastrar Novo Motoboy'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Informe os dados do entregador. O CPF deve ser válido.
            </p>

            {errorMsg && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-2.5 text-xs text-red-800 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveMotoboy} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={mbName}
                  onChange={(e) => setMbName(e.target.value)}
                  placeholder="Nome do entregador"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  CPF (com validação) *
                </label>
                <input
                  type="text"
                  value={mbCpf}
                  onChange={(e) => setMbCpf(maskCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono text-slate-900 focus:border-orange-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Celular / WhatsApp *
                </label>
                <input
                  type="text"
                  value={mbPhone}
                  onChange={(e) => setMbPhone(maskPhone(e.target.value))}
                  placeholder="(81) 98765-4321"
                  maxLength={15}
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Observações (Moto, placa, turno preferido)
                </label>
                <textarea
                  rows={2}
                  value={mbNotes}
                  onChange={(e) => setMbNotes(e.target.value)}
                  placeholder="Ex: Honda Fan 160 placa ABC-1234"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="mbActive"
                  checked={mbActive}
                  onChange={(e) => setMbActive(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <label htmlFor="mbActive" className="text-xs font-semibold text-slate-700">
                  Motoboy Ativo (apenas ativos podem receber novas corridas)
                </label>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsMotoboyModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Salvar Motoboy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL LOJA DE ORIGEM */}
      {/* ======================================================== */}
      {isStoreModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Store className="h-5 w-5 text-orange-500" />
              {editingStore ? 'Editar Empresa de Entrega' : 'Cadastrar Empresa de Origem'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Cadastre estabelecimentos parceiros (máx. 10 no plano inicial).
            </p>

            {errorMsg && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-2.5 text-xs text-red-800 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveStore} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome da Empresa / Loja *
                </label>
                <input
                  type="text"
                  value={stName}
                  onChange={(e) => setStName(e.target.value)}
                  placeholder="Ex: iFood Loja A, Hamburgueria Gourmet"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Identificador Interno (Código) *
                </label>
                <input
                  type="text"
                  value={stCode}
                  onChange={(e) => setStCode(e.target.value.toUpperCase())}
                  placeholder="Ex: IFD-01, HBG-02"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:border-orange-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  CNPJ (opcional)
                </label>
                <input
                  type="text"
                  value={stCnpj}
                  onChange={(e) => setStCnpj(maskCnpj(e.target.value))}
                  placeholder="00.000.000/0001-00"
                  maxLength={18}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono text-slate-900 focus:border-orange-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Telefone da Loja (opcional)
                </label>
                <input
                  type="text"
                  value={stPhone}
                  onChange={(e) => setStPhone(maskPhone(e.target.value))}
                  placeholder="(81) 3456-7890"
                  maxLength={15}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="stActive"
                  checked={stActive}
                  onChange={(e) => setStActive(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <label htmlFor="stActive" className="text-xs font-semibold text-slate-700">
                  Empresa Ativa
                </label>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsStoreModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Salvar Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL TARIFA DE BAIRRO */}
      {/* ======================================================== */}
      {isRateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-orange-500" />
              {editingRate ? 'Editar Tarifa de Bairro' : 'Cadastrar Tarifa por Bairro'}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Configure o valor cobrado para entrega neste bairro por esta loja.
            </p>

            {errorMsg && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-50 p-2.5 text-xs text-red-800 border border-red-200">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveRate} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Empresa / Loja de Origem *
                </label>
                <select
                  value={rtStoreId}
                  onChange={(e) => setRtStoreId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
                >
                  <option value="">Selecione a loja...</option>
                  {localStores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                  {localStores.length === 0 && (
                    <option value="matriz">Matriz / Loja Principal</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nome do Bairro *
                </label>
                <input
                  type="text"
                  value={rtNeighborhood}
                  onChange={(e) => setRtNeighborhood(e.target.value)}
                  placeholder="Ex: Centro, Boa Viagem, Pina..."
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-orange-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Valor Padrão da Corrida (R$) *
                </label>
                <input
                  type="text"
                  value={rtRate}
                  onChange={(e) => setRtRate(e.target.value)}
                  placeholder="Ex: 12,00"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-900 focus:border-orange-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="rtActive"
                  checked={rtActive}
                  onChange={(e) => setRtActive(e.target.checked)}
                  className="h-4 w-4 rounded-sm border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <label htmlFor="rtActive" className="text-xs font-semibold text-slate-700">
                  Tarifa Ativa
                </label>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRateModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:opacity-50"
                >
                  {loading ? 'Salvando...' : 'Salvar Tarifa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
