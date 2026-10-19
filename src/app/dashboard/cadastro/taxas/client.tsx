'use client';

/**
 * Lista e CRUD de taxas (client).
 * ---------------------------------------------------------------------------
 * A taxa é a combinação Empresa × Bairro. O bairro é carregado sob demanda a
 * partir da empresa escolhida, usando a Server Action de bairros da empresa.
 */
import { useEffect, useState, useTransition } from 'react';
import { Plus, Receipt, Trash2, Loader2 } from 'lucide-react';
import { EmptyState, ActiveStatusBadge } from '@/components/ui';
import { ConfirmActionButton, SearchFilter, SelectFilter } from '@/components/page-tools';
import { CrudModal, SelectField, Field } from '@/components/form';
import { loadCompanyNeighborhoodsAction } from '@/app/actions/deliveries';
import { deleteFeeAction, saveFeeAction } from '@/app/actions/cadastros';
import { formatMoney } from '@/lib/format';
import type { ActiveStatus } from '@/lib/types';

export interface FeeRow {
  id: string;
  company_id: string;
  company_name: string;
  neighborhood_id: string;
  neighborhood_name: string;
  neighborhood_city: string;
  fee_cents: number;
  status: ActiveStatus;
}

interface Option {
  id: string;
  name: string;
}

export function FeesClient({
  fees,
  companies,
  canManage,
}: {
  fees: FeeRow[];
  companies: Option[];
  canManage: boolean;
}) {
  const [creating, setCreating] = useState(false);
  const [companyId, setCompanyId] = useState('');
  const [neighborhoods, setNeighborhoods] = useState<{ id: string; name: string; city: string }[]>(
    [],
  );
  const [loading, startLoad] = useTransition();

  // Carrega os bairros da empresa assim que ela é escolhida no modal.
  useEffect(() => {
    if (!companyId) {
      setNeighborhoods([]);
      return;
    }
    startLoad(async () => {
      const res = await loadCompanyNeighborhoodsAction(companyId);
      setNeighborhoods(res.ok ? (res.data ?? []) : []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const close = () => {
    setCreating(false);
    setCompanyId('');
    setNeighborhoods([]);
  };

  return (
    <>
      <div className="card card-pad">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchFilter
            placeholder="Buscar por empresa ou bairro..."
            className="w-full lg:max-w-md"
          />
          <div className="flex flex-wrap items-center gap-3">
            <SelectFilter
              paramName="empresa"
              label="Empresa"
              allLabel="Todas as empresas"
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
            />
            {canManage && (
              <button type="button" className="btn-primary btn-sm" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> NOVA TAXA
              </button>
            )}
          </div>
        </div>
      </div>

      <section className="card overflow-hidden">
        {fees.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-8 w-8" />}
            title="Nenhuma taxa configurada"
            message="Defina o valor de entrega para cada combinação de empresa e bairro."
            action={
              canManage ? (
                <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> NOVA TAXA
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Empresa</th>
                  <th>Bairro</th>
                  <th>Cidade</th>
                  <th>Valor</th>
                  <th>Situação</th>
                  {canManage && <th className="text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {fees.map((f) => (
                  <tr key={f.id}>
                    <td className="font-semibold text-ink-900">{f.company_name}</td>
                    <td className="text-ink-700">{f.neighborhood_name}</td>
                    <td className="text-ink-600">{f.neighborhood_city}</td>
                    <td className="font-medium">{formatMoney(f.fee_cents)}</td>
                    <td>
                      <ActiveStatusBadge status={f.status} />
                    </td>
                    {canManage && (
                      <td>
                        <div className="flex items-center justify-end">
                          <ConfirmActionButton
                            action={() => deleteFeeAction(f.id)}
                            confirmTitle="Excluir taxa"
                            confirmMessage={`Excluir a taxa de ${f.company_name} × ${f.neighborhood_name}?`}
                            successMessage="Taxa excluída."
                            className="btn-ghost btn-sm p-1.5 text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </ConfirmActionButton>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <CrudModal
        open={creating}
        onClose={close}
        title="Nova taxa"
        subtitle="Selecione a empresa e o bairro e defina o valor da entrega."
        action={saveFeeAction}
        successMessage="Taxa configurada."
        submitLabel="Salvar taxa"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="company_id" className="label">
              Empresa <span className="text-rose-500">*</span>
            </label>
            <select
              id="company_id"
              name="company_id"
              required
              className="select"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">Selecione...</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="neighborhood_id" className="label">
              Bairro <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                id="neighborhood_id"
                name="neighborhood_id"
                required
                className="select"
                disabled={!companyId || loading}
              >
                <option value="">
                  {!companyId
                    ? 'Selecione a empresa primeiro'
                    : neighborhoods.length === 0
                      ? 'Nenhum bairro vinculado à empresa'
                      : 'Selecione...'}
                </option>
                {neighborhoods.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.city})
                  </option>
                ))}
              </select>
              {loading && (
                <Loader2 className="absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-400" />
              )}
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Só aparecem bairros já vinculados à empresa. Vincule-os no cadastro de empresas.
            </p>
          </div>

          <Field label="Valor (R$)" name="fee" placeholder="8,50" required />
          <SelectField
            label="Situação"
            name="status"
            defaultValue="active"
            options={[
              { value: 'active', label: 'Ativa' },
              { value: 'inactive', label: 'Inativa' },
            ]}
          />
        </div>
      </CrudModal>
    </>
  );
}
