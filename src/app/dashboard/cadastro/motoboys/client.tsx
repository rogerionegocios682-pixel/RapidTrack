'use client';

/**
 * Lista e CRUD de motoboys (client).
 */
import { useState } from 'react';
import { Bike, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { EmptyState, MotoboyStatusBadge } from '@/components/ui';
import {
  ConfirmActionButton,
  PlainActionButton,
  SearchFilter,
  SelectFilter,
} from '@/components/page-tools';
import { CrudModal, Field, MaskedField, TextArea, SelectField } from '@/components/form';
import { saveMotoboyAction, toggleMotoboyAction, deleteMotoboyAction } from '@/app/actions/cadastros';
import { MOTOBOY_STATUS_LABEL, type MotoboyStatus } from '@/lib/types';

export interface MotoboyRow {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  whatsapp: string | null;
  motorcycle_plate: string | null;
  motorcycle_model: string | null;
  notes: string | null;
  status: MotoboyStatus;
  open_deliveries: number;
}

const STATUS_OPTIONS = (Object.keys(MOTOBOY_STATUS_LABEL) as MotoboyStatus[]).map((s) => ({
  value: s,
  label: MOTOBOY_STATUS_LABEL[s],
}));

export function MotoboysClient({
  motoboys,
  canManage,
}: {
  motoboys: MotoboyRow[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState<MotoboyRow | null>(null);
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
            placeholder="Buscar por nome, telefone ou CPF..."
            className="w-full lg:max-w-md"
          />
          <div className="flex flex-wrap items-center gap-3">
            <SelectFilter
              paramName="status"
              label="Situação"
              allLabel="Todas"
              options={[
                { value: 'available', label: 'Disponível' },
                { value: 'on_delivery', label: 'Em corrida' },
                { value: 'inactive', label: 'Inativo' },
              ]}
            />
            {canManage && (
              <button type="button" className="btn-primary btn-sm" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> NOVO MOTOBOY
              </button>
            )}
          </div>
        </div>
      </div>

      <section className="card overflow-hidden">
        {motoboys.length === 0 ? (
          <EmptyState
            icon={<Bike className="h-8 w-8" />}
            title="Nenhum motoboy cadastrado"
            message="Cadastre os motoboys para poder despachar corridas para eles."
            action={
              canManage ? (
                <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> NOVO MOTOBOY
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Motoboy</th>
                  <th>CPF</th>
                  <th>Contato</th>
                  <th>Moto</th>
                  <th>Corridas abertas</th>
                  <th>Situação</th>
                  {canManage && <th className="text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {motoboys.map((m) => (
                  <tr key={m.id}>
                    <td className="font-semibold text-ink-900">{m.name}</td>
                    <td className="whitespace-nowrap text-ink-600">{m.cpf ?? '—'}</td>
                    <td className="text-xs text-ink-600">
                      {m.phone && <p>Tel: {m.phone}</p>}
                      {m.whatsapp && <p>Whats: {m.whatsapp}</p>}
                      {!m.phone && !m.whatsapp && '—'}
                    </td>
                    <td className="text-xs text-ink-600">
                      {m.motorcycle_model && <p>{m.motorcycle_model}</p>}
                      {m.motorcycle_plate && (
                        <p className="font-mono text-ink-500">{m.motorcycle_plate}</p>
                      )}
                      {!m.motorcycle_model && !m.motorcycle_plate && '—'}
                    </td>
                    <td>
                      {m.open_deliveries > 0 ? (
                        <span className="badge bg-brand-50 text-brand-700 ring-brand-200">
                          {m.open_deliveries}
                        </span>
                      ) : (
                        <span className="text-ink-400">0</span>
                      )}
                    </td>
                    <td>
                      <MotoboyStatusBadge status={m.status} />
                    </td>
                    {canManage && (
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="btn-ghost btn-sm p-1.5"
                            onClick={() => setEditing(m)}
                            title="Editar"
                            aria-label="Editar motoboy"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <PlainActionButton
                            action={() => toggleMotoboyAction(m.id)}
                            successMessage={`Motoboy ${m.status === 'inactive' ? 'ativado' : 'inativado'}.`}
                            className="btn-ghost btn-sm p-1.5"
                          >
                            <Power className="h-4 w-4" />
                          </PlainActionButton>
                          {m.open_deliveries === 0 && (
                            <ConfirmActionButton
                              action={() => deleteMotoboyAction(m.id)}
                              confirmTitle="Excluir motoboy"
                              confirmMessage={`Excluir "${m.name}"? Motoboys com corridas vinculadas não podem ser excluídos.`}
                              successMessage="Motoboy excluído."
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
        title={current ? 'Editar motoboy' : 'Novo motoboy'}
        subtitle={current ? current.name : 'Preencha os dados do motoboy.'}
        action={saveMotoboyAction}
        successMessage={current ? 'Motoboy atualizado.' : 'Motoboy cadastrado.'}
        size="lg"
        submitLabel={current ? 'Salvar alterações' : 'Cadastrar motoboy'}
      >
        {current && <input type="hidden" name="id" value={current.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nome completo"
            name="name"
            defaultValue={current?.name}
            required
            maxLength={150}
            className="sm:col-span-2"
          />
          <MaskedField
            label="CPF"
            name="cpf"
            mask="cpf"
            defaultValue={current?.cpf}
            placeholder="000.000.000-00"
          />
          <MaskedField
            label="Telefone"
            name="phone"
            mask="phone"
            defaultValue={current?.phone}
            placeholder="(00) 00000-0000"
          />
          <MaskedField
            label="WhatsApp"
            name="whatsapp"
            mask="phone"
            defaultValue={current?.whatsapp}
            placeholder="(00) 00000-0000"
          />
          <Field
            label="Modelo da moto"
            name="motorcycle_model"
            defaultValue={current?.motorcycle_model}
            maxLength={80}
          />
          <Field
            label="Placa"
            name="motorcycle_plate"
            defaultValue={current?.motorcycle_plate}
            maxLength={10}
            placeholder="ABC1D23"
          />
          <SelectField
            label="Situação"
            name="status"
            defaultValue={current?.status ?? 'available'}
            options={STATUS_OPTIONS}
          />
          <TextArea
            label="Observações"
            name="notes"
            defaultValue={current?.notes}
            maxLength={500}
            className="sm:col-span-2"
          />
        </div>
      </CrudModal>
    </>
  );
}
