'use client';

/**
 * Modal para gerenciar os bairros atendidos por uma empresa.
 * ---------------------------------------------------------------------------
 * Permite vincular bairros disponíveis e desvincular os já vinculados. É o
 * passo necessário para que a tela de Taxas encontre bairros para uma empresa
 * (a taxa é a combinação empresa × bairro).
 */
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { Loader2, MapPin, Plus, Search, X } from 'lucide-react';
import { Modal, useToast } from '@/components/ui';
import {
  addCompanyNeighborhoodsBulkAction,
  loadCompanyNeighborhoodsAdminAction,
  removeCompanyNeighborhoodAction,
} from '@/app/actions/cadastros';

interface Option {
  id: string;
  name: string;
  city: string;
  state: string;
}

export function CompanyNeighborhoodsModal({
  open,
  onClose,
  company,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  company: { id: string; name: string } | null;
  onChanged?: () => void;
}) {
  const toast = useToast();
  const [linked, setLinked] = useState<Option[]>([]);
  const [available, setAvailable] = useState<Option[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, startLoad] = useTransition();
  const [saving, startSave] = useTransition();

  const reload = useCallback(() => {
    if (!company) return;
    startLoad(async () => {
      const res = await loadCompanyNeighborhoodsAdminAction(company.id);
      if (res.ok && res.data) {
        setLinked(res.data.linked);
        setAvailable(res.data.available);
      } else {
        toast.error(res.error ?? 'Não foi possível carregar os bairros.');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  useEffect(() => {
    if (open && company) {
      setSelectedIds(new Set());
      setSearch('');
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, company?.id]);

  const term = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      term
        ? available.filter((n) =>
            `${n.name} ${n.city} ${n.state}`.toLowerCase().includes(term),
          )
        : available,
    [available, term],
  );

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    const allSelected = filtered.length > 0 && filtered.every((n) => selectedIds.has(n.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) filtered.forEach((n) => next.delete(n.id));
      else filtered.forEach((n) => next.add(n.id));
      return next;
    });
  };

  const handleAddSelected = () => {
    if (!company || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    startSave(async () => {
      const res = await addCompanyNeighborhoodsBulkAction(company.id, ids);
      if (res.ok) {
        const count = res.data?.count ?? 0;
        toast.success(
          count === 0
            ? 'Nenhum bairro novo para vincular.'
            : count === 1
              ? 'Bairro vinculado à empresa.'
              : `${count} bairros vinculados à empresa.`,
        );
        setSelectedIds(new Set());
        reload();
        onChanged?.();
      } else {
        toast.error(res.error ?? 'Não foi possível vincular os bairros.');
      }
    });
  };

  const handleRemove = (neighborhoodId: string) => {
    if (!company) return;
    startSave(async () => {
      const res = await removeCompanyNeighborhoodAction(company.id, neighborhoodId);
      if (res.ok) {
        toast.success('Bairro desvinculado da empresa.');
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(neighborhoodId);
          return next;
        });
        reload();
        onChanged?.();
      } else {
        toast.error(res.error ?? 'Não foi possível desvincular o bairro.');
      }
    });
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((n) => selectedIds.has(n.id));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Bairros atendidos"
      subtitle={company ? company.name : undefined}
      size="md"
    >
      <div className="space-y-5">
        {/* Vincular bairros */}
        <div>
          <label htmlFor="neighborhood_search" className="label">
            Vincular bairros
          </label>

          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              id="neighborhood_search"
              type="text"
              className="input pl-8"
              placeholder="Buscar por bairro, cidade ou UF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={loading}
            />
          </div>

          {available.length === 0 ? (
            <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center">
              <MapPin className="h-6 w-6 text-ink-300" />
              <p className="text-sm text-ink-500">
                Todos os bairros ativos já estão vinculados a esta empresa.
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center">
              <p className="text-sm text-ink-500">Nenhum bairro encontrado para “{search}”.</p>
            </div>
          ) : (
            <>
              <div className="mb-1.5 flex items-center justify-between">
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-700 hover:underline"
                  onClick={toggleAllFiltered}
                  disabled={saving}
                >
                  {allFilteredSelected
                    ? 'Desmarcar todos'
                    : `Selecionar todos (${filtered.length})`}
                </button>
                {selectedIds.size > 0 && (
                  <span className="text-xs text-ink-500">{selectedIds.size} selecionado(s)</span>
                )}
              </div>

              <ul className="max-h-56 overflow-y-auto rounded-lg border border-ink-200">
                {filtered.map((n) => {
                  const checked = selectedIds.has(n.id);
                  return (
                    <li key={n.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-ink-50">
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                          checked={checked}
                          onChange={() => toggle(n.id)}
                          disabled={saving}
                        />
                        <MapPin className="h-4 w-4 shrink-0 text-ink-400" />
                        <span className="text-ink-800">{n.name}</span>
                        <span className="ml-auto shrink-0 text-xs text-ink-500">
                          {n.city}/{n.state}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-xs text-ink-500">
              Sem bairros vinculados não é possível criar taxas para esta empresa.
            </p>
            <button
              type="button"
              className="btn-primary shrink-0"
              onClick={handleAddSelected}
              disabled={selectedIds.size === 0 || saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Vincular {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </button>
          </div>
        </div>

        {/* Lista de vinculados */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-900">
              Bairros vinculados
              <span className="ml-2 badge bg-brand-50 text-brand-700 ring-brand-200">
                {linked.length}
              </span>
            </h3>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-ink-400" />}
          </div>

          {linked.length === 0 ? (
            <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-ink-200 px-4 py-6 text-center">
              <MapPin className="h-6 w-6 text-ink-300" />
              <p className="text-sm text-ink-500">Nenhum bairro vinculado ainda.</p>
            </div>
          ) : (
            <ul className="divide-y divide-ink-100 rounded-lg border border-ink-200">
              {linked.map((n) => (
                <li key={n.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm text-ink-800">
                    <MapPin className="h-4 w-4 text-ink-400" />
                    {n.name}
                    <span className="text-xs text-ink-500">
                      ({n.city}/{n.state})
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(n.id)}
                    disabled={saving}
                    className="btn-ghost btn-sm p-1.5 text-rose-600 hover:bg-rose-50"
                    aria-label={`Desvincular ${n.name}`}
                    title="Desvincular"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end border-t border-ink-100 pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </Modal>
  );
}