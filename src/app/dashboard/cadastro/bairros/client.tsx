'use client';

/**
 * Lista e CRUD de bairros (client).
 */
import { useState } from 'react';
import { MapPin, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { EmptyState, ActiveStatusBadge } from '@/components/ui';
import {
  ConfirmActionButton,
  PlainActionButton,
  SearchFilter,
  SelectFilter,
} from '@/components/page-tools';
import { CrudModal, Field, SelectField } from '@/components/form';
import {
  saveNeighborhoodAction,
  toggleNeighborhoodAction,
  deleteNeighborhoodAction,
} from '@/app/actions/cadastros';
import type { ActiveStatus } from '@/lib/types';

export interface NeighborhoodRow {
  id: string;
  name: string;
  city: string;
  state: string;
  status: ActiveStatus;
  companies_count: number;
}

export function NeighborhoodsClient({
  neighborhoods,
  canManage,
}: {
  neighborhoods: NeighborhoodRow[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<NeighborhoodRow | null>(null);
  const [creating, setCreating] = useState(false);

  const close = () => {
    setCreating(false);
    setEditing(null);
  };
  const open = creating || editing !== null;
  const current = editing;

  return (
    <>
      <div className="card card-pad">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchFilter
            placeholder="Buscar por bairro ou cidade..."
            className="w-full lg:max-w-md"
          />
          <div className="flex flex-wrap items-center gap-3">
            <SelectFilter
              paramName="status"
              label="Situação"
              allLabel="Todas"
              options={[
                { value: 'active', label: 'Ativos' },
                { value: 'inactive', label: 'Inativos' },
              ]}
            />
            {canManage && (
              <button type="button" className="btn-primary btn-sm" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> NOVO BAIRRO
              </button>
            )}
          </div>
        </div>
      </div>

      <section className="card overflow-hidden">
        {neighborhoods.length === 0 ? (
          <EmptyState
            icon={<MapPin className="h-8 w-8" />}
            title="Nenhum bairro cadastrado"
            message="Cadastre os bairros atendidos para vinculá-los às empresas e definir taxas."
            action={
              canManage ? (
                <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> NOVO BAIRRO
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Bairro</th>
                  <th>Cidade</th>
                  <th>UF</th>
                  <th>Empresas atendidas</th>
                  <th>Situação</th>
                  {canManage && <th className="text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {neighborhoods.map((n) => (
                  <tr key={n.id}>
                    <td className="font-semibold text-ink-900">{n.name}</td>
                    <td className="text-ink-700">{n.city}</td>
                    <td className="uppercase text-ink-600">{n.state}</td>
                    <td>
                      {n.companies_count > 0 ? (
                        <span className="badge bg-brand-50 text-brand-700 ring-brand-200">
                          {n.companies_count}
                        </span>
                      ) : (
                        <span className="text-ink-400">0</span>
                      )}
                    </td>
                    <td>
                      <ActiveStatusBadge status={n.status} />
                    </td>
                    {canManage && (
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="btn-ghost btn-sm p-1.5"
                            onClick={() => setEditing(n)}
                            title="Editar"
                            aria-label="Editar bairro"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <PlainActionButton
                            action={() => toggleNeighborhoodAction(n.id)}
                            successMessage={`Bairro ${n.status === 'active' ? 'inativado' : 'ativado'}.`}
                            className="btn-ghost btn-sm p-1.5"
                          >
                            <Power className="h-4 w-4" />
                          </PlainActionButton>
                          {n.companies_count === 0 && (
                            <ConfirmActionButton
                              action={() => deleteNeighborhoodAction(n.id)}
                              confirmTitle="Excluir bairro"
                              confirmMessage={`Excluir "${n.name}"? Bairros vinculados a empresas não podem ser excluídos.`}
                              successMessage="Bairro excluído."
                              className="btn-ghost btn-sm p-1.5 text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </ConfirmActionButton>
                          )}
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
        open={open}
        onClose={close}
        title={current ? 'Editar bairro' : 'Novo bairro'}
        subtitle={current ? current.name : 'Cadastre uma área de entrega.'}
        action={saveNeighborhoodAction}
        successMessage={current ? 'Bairro atualizado.' : 'Bairro cadastrado.'}
        submitLabel={current ? 'Salvar alterações' : 'Cadastrar bairro'}
      >
        {current && <input type="hidden" name="id" value={current.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nome do bairro"
            name="name"
            defaultValue={current?.name}
            required
            maxLength={120}
            className="sm:col-span-2"
          />
          <Field label="Cidade" name="city" defaultValue={current?.city} required maxLength={120} />
          <Field
            label="UF"
            name="state"
            defaultValue={current?.state}
            required
            maxLength={2}
            placeholder="PE"
          />
          <SelectField
            label="Situação"
            name="status"
            defaultValue={current?.status ?? 'active'}
            options={[
              { value: 'active', label: 'Ativo' },
              { value: 'inactive', label: 'Inativo' },
            ]}
            className="sm:col-span-2"
          />
        </div>
      </CrudModal>
    </>
  );
}
