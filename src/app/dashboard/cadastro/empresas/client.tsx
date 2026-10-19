'use client';

/**
 * Lista e CRUD de empresas (client).
 * ---------------------------------------------------------------------------
 * A listagem e os filtros vêm do servidor via props + URL. Aqui ficam apenas
 * as interações: abrir modais, alternar status e excluir (com confirmação).
 */
import { useState } from 'react';
import { Building2, MapPin, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { EmptyState, ActiveStatusBadge, useToast } from '@/components/ui';
import { ConfirmActionButton, PlainActionButton, SearchFilter, SelectFilter } from '@/components/page-tools';
import { CrudModal, Field, MaskedField, SelectField } from '@/components/form';
import { CompanyNeighborhoodsModal } from '@/components/company-neighborhoods-modal';
import {
  deleteCompanyAction,
  saveCompanyAction,
  toggleCompanyAction,
} from '@/app/actions/cadastros';
import { useRouter } from 'next/navigation';
import type { ActiveStatus } from '@/lib/types';

export interface CompanyRow {
  id: string;
  name: string;
  trade_name: string | null;
  cnpj: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  status: ActiveStatus;
  neighborhoods_count: number;
}

export function CompaniesClient({
  companies,
  canManage,
}: {
  companies: CompanyRow[];
  canManage: boolean;
}) {
  const toast = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [managingNeighborhoods, setManagingNeighborhoods] = useState<CompanyRow | null>(null);

  const close = () => {
    setCreating(false);
    setEditing(null);
  };

  const open = creating || editing !== null;
  const current = editing;

  return (
    <>
      {/* Barra de filtros */}
      <div className="card card-pad">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchFilter
            placeholder="Buscar por nome, razão social ou CNPJ..."
            className="w-full lg:max-w-md"
          />
          <div className="flex flex-wrap items-center gap-3">
            <SelectFilter
              paramName="status"
              label="Situação"
              allLabel="Todas"
              options={[
                { value: 'active', label: 'Ativas' },
                { value: 'inactive', label: 'Inativas' },
              ]}
            />
            {canManage && (
              <button type="button" className="btn-primary btn-sm" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4" /> NOVA EMPRESA
              </button>
            )}
          </div>
        </div>
      </div>

      <section className="card overflow-hidden">
        {companies.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-8 w-8" />}
            title="Nenhuma empresa cadastrada"
            message="Cadastre a primeira empresa cliente para começar a registrar corridas."
            action={
              canManage ? (
                <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
                  <Plus className="h-4 w-4" /> NOVA EMPRESA
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
                  <th>CNPJ</th>
                  <th>Contato</th>
                  <th>Endereço</th>
                  <th>Bairros</th>
                  <th>Situação</th>
                  {canManage && <th className="text-right">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <p className="font-semibold text-ink-900">{c.name}</p>
                      {c.trade_name && <p className="text-xs text-ink-500">{c.trade_name}</p>}
                    </td>
                    <td className="whitespace-nowrap text-ink-600">{c.cnpj ?? '—'}</td>
                    <td className="text-xs text-ink-600">
                      {c.phone && <p>Tel: {c.phone}</p>}
                      {c.whatsapp && <p>Whats: {c.whatsapp}</p>}
                      {c.email && <p className="truncate" title={c.email}>{c.email}</p>}
                      {!c.phone && !c.whatsapp && !c.email && '—'}
                    </td>
                    <td className="max-w-[220px] text-xs text-ink-600">
                      {c.address ? <p className="truncate" title={c.address}>{c.address}</p> : '—'}
                      {(c.city || c.state) && (
                        <p className="text-ink-400">
                          {[c.neighborhood, c.city, c.state].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </td>
                    <td>
                      <span className="badge bg-ink-100 text-ink-700 ring-ink-200">
                        <MapPin className="h-3 w-3" /> {c.neighborhoods_count}
                      </span>
                    </td>
                    <td>
                      <ActiveStatusBadge status={c.status} />
                    </td>
                    {canManage && (
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="btn-ghost btn-sm p-1.5"
                            onClick={() => setManagingNeighborhoods(c)}
                            title="Bairros atendidos"
                            aria-label={`Gerenciar bairros de ${c.name}`}
                          >
                            <MapPin className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="btn-ghost btn-sm p-1.5"
                            onClick={() => setEditing(c)}
                            title="Editar"
                            aria-label="Editar empresa"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <PlainActionButton
                            action={() => toggleCompanyAction(c.id)}
                            successMessage={`Empresa ${c.status === 'active' ? 'inativada' : 'ativada'}.`}
                            className="btn-ghost btn-sm p-1.5"
                          >
                            <Power className="h-4 w-4" />
                          </PlainActionButton>
                          {c.neighborhoods_count === 0 && (
                            <ConfirmActionButton
                              action={() => deleteCompanyAction(c.id)}
                              confirmTitle="Excluir empresa"
                              confirmMessage={`Excluir "${c.name}"? Empresas com corridas vinculadas não podem ser excluídas.`}
                              successMessage="Empresa excluída."
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

      {/* Modal criar/editar */}
      <CrudModal
        open={open}
        onClose={close}
        title={current ? 'Editar empresa' : 'Nova empresa'}
        subtitle={current ? current.name : 'Preencha os dados da empresa cliente.'}
        action={saveCompanyAction}
        successMessage={current ? 'Empresa atualizada.' : 'Empresa cadastrada.'}
        size="lg"
        submitLabel={current ? 'Salvar alterações' : 'Cadastrar empresa'}
      >
        {current && <input type="hidden" name="id" value={current.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Nome / razão social"
            name="name"
            defaultValue={current?.name}
            required
            maxLength={150}
            className="sm:col-span-2"
          />
          <Field
            label="Nome fantasia"
            name="trade_name"
            defaultValue={current?.trade_name}
            maxLength={150}
          />
          <MaskedField
            label="CNPJ"
            name="cnpj"
            mask="cnpj"
            defaultValue={current?.cnpj}
            placeholder="00.000.000/0000-00"
          />
          <MaskedField
            label="Telefone"
            name="phone"
            mask="phone"
            defaultValue={current?.phone}
            placeholder="(00) 0000-0000"
          />
          <MaskedField
            label="WhatsApp"
            name="whatsapp"
            mask="phone"
            defaultValue={current?.whatsapp}
            placeholder="(00) 00000-0000"
          />
          <Field
            label="E-mail"
            name="email"
            type="email"
            defaultValue={current?.email}
            maxLength={150}
            className="sm:col-span-2"
          />
          <Field
            label="Endereço"
            name="address"
            defaultValue={current?.address}
            maxLength={250}
            className="sm:col-span-2"
          />
          <Field label="Bairro" name="neighborhood" defaultValue={current?.neighborhood} maxLength={120} />
          <Field label="Cidade" name="city" defaultValue={current?.city} maxLength={120} />
          <Field label="UF" name="state" defaultValue={current?.state} maxLength={2} placeholder="PE" />
          <SelectField
            label="Situação"
            name="status"
            defaultValue={current?.status ?? 'active'}
            options={[
              { value: 'active', label: 'Ativa' },
              { value: 'inactive', label: 'Inativa' },
            ]}
          />
        </div>
      </CrudModal>

      <CompanyNeighborhoodsModal
        open={managingNeighborhoods !== null}
        onClose={() => setManagingNeighborhoods(null)}
        company={
          managingNeighborhoods
            ? { id: managingNeighborhoods.id, name: managingNeighborhoods.name }
            : null
        }
        onChanged={() => router.refresh()}
      />
    </>
  );
}
