'use client';

/**
 * Cadastro → Usuários (client).
 * ---------------------------------------------------------------------------
 * Lista os usuários, permite criar, editar, ativar/desativar e gerenciar a
 * matriz de permissões individuais por módulo. A identidade visual segue os
 * componentes já existentes (card, table, CrudModal, badges).
 */
import { useEffect, useState } from 'react';
import { KeyRound, Pencil, Plus, Power, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { EmptyState, ActiveStatusBadge, Modal } from '@/components/ui';
import { ConfirmActionButton, PlainActionButton, SearchFilter, SelectFilter } from '@/components/page-tools';
import { CrudModal, Field, MaskedField, SelectField, SubmitButton, Alert } from '@/components/form';
import { useFormState } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  createUserAction,
  updateUserAction,
  updateUserPermissionsAction,
  toggleUserStatusAction,
} from '@/app/actions/users';
import { ROLE_LABEL, type UserRole, type UserStatus } from '@/lib/types';
import { formatDateTime } from '@/lib/format';
import type { ActionResult } from '@/app/actions/guard';

/* ---------------------------------------------------------------------------
 * Catálogo de módulos × ações — base da matriz de permissões.
 * Derivado das permissões REAIS existentes em src/lib/auth.ts.
 * -------------------------------------------------------------------------*/
const MODULES: { label: string; actions: { perm: string; label: string }[] }[] = [
  {
    label: 'Dashboard',
    actions: [{ perm: 'dashboard.view', label: 'Visualizar' }],
  },
  {
    label: 'Corridas',
    actions: [
      { perm: 'deliveries.view', label: 'Visualizar' },
      { perm: 'deliveries.view.all', label: 'Ver todas' },
      { perm: 'deliveries.create', label: 'Criar' },
      { perm: 'deliveries.update', label: 'Editar' },
      { perm: 'deliveries.change_status', label: 'Alterar status' },
      { perm: 'deliveries.cancel', label: 'Cancelar' },
      { perm: 'deliveries.delete', label: 'Excluir' },
    ],
  },
  {
    label: 'Empresas',
    actions: [
      { perm: 'companies.view', label: 'Visualizar' },
      { perm: 'companies.manage', label: 'Gerenciar' },
    ],
  },
  {
    label: 'Motoboys',
    actions: [
      { perm: 'motoboys.view', label: 'Visualizar' },
      { perm: 'motoboys.manage', label: 'Gerenciar' },
    ],
  },
  {
    label: 'Bairros',
    actions: [
      { perm: 'neighborhoods.view', label: 'Visualizar' },
      { perm: 'neighborhoods.manage', label: 'Gerenciar' },
    ],
  },
  {
    label: 'Taxas',
    actions: [
      { perm: 'fees.view', label: 'Visualizar' },
      { perm: 'fees.manage', label: 'Gerenciar' },
    ],
  },
  {
    label: 'Relatórios',
    actions: [{ perm: 'reports.view', label: 'Visualizar' }],
  },
  {
    label: 'Comunicação',
    actions: [
      { perm: 'messages.view', label: 'Visualizar' },
      { perm: 'messages.send', label: 'Enviar' },
      { perm: 'announcements.send', label: 'Comunicados' },
    ],
  },
  {
    label: 'Configurações',
    actions: [
      { perm: 'audit.view', label: 'Ver auditoria' },
      { perm: 'settings.manage', label: 'Gerenciar' },
    ],
  },
  {
    label: 'Usuários',
    actions: [{ perm: 'users.manage', label: 'Gerenciar' }],
  },
];

interface UserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  motoboy_id: string | null;
  motoboy_name: string | null;
  permissions: string | null;
  last_login_at: string | null;
  created_at: string;
}

interface Option {
  id: string;
  name: string;
}

function parsePerms(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

export function UsersClient({
  currentUserId,
  isAdmin,
  users,
  motoboys,
}: {
  currentUserId: string;
  isAdmin: boolean;
  users: UserRow[];
  motoboys: Option[];
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [permissionsOf, setPermissionsOf] = useState<UserRow | null>(null);

  return (
    <>
      {/* Barra de filtros */}
      <div className="card card-pad">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchFilter
            placeholder="Buscar por nome ou e-mail..."
            className="w-full lg:max-w-md"
          />
          <div className="flex flex-wrap items-center gap-3">
            <SelectFilter
              paramName="status"
              label="Situação"
              allLabel="Todos"
              options={[
                { value: 'active', label: 'Ativos' },
                { value: 'inactive', label: 'Inativos' },
              ]}
            />
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-4 w-4" /> NOVO USUÁRIO
            </button>
          </div>
        </div>
      </div>

      <section className="card overflow-hidden">
        {users.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="Nenhum usuário encontrado"
            message="Cadastre usuários e defina as permissões de acesso de cada um."
            action={
              <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
                <UserPlus className="h-4 w-4" /> NOVO USUÁRIO
              </button>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Permissões</th>
                  <th>Situação</th>
                  <th>Cadastro</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const override = parsePerms(u.permissions);
                  return (
                    <tr key={u.id}>
                      <td className="font-semibold text-ink-900">
                        {u.name}
                        {u.id === currentUserId && (
                          <span className="ml-2 text-xs font-normal text-brand-600">(você)</span>
                        )}
                      </td>
                      <td className="max-w-[200px] truncate text-ink-600" title={u.email}>
                        {u.email}
                      </td>
                      <td>
                        <span className="badge bg-ink-100 text-ink-700 ring-ink-200">
                          {ROLE_LABEL[u.role]}
                        </span>
                      </td>
                      <td>
                        {override.length > 0 ? (
                          <span className="badge bg-brand-50 text-brand-700 ring-brand-200">
                            {override.length} personalizada(s)
                          </span>
                        ) : (
                          <span className="text-xs text-ink-500">Padrão do perfil</span>
                        )}
                      </td>
                      <td>
                        <ActiveStatusBadge status={u.status} />
                      </td>
                      <td className="whitespace-nowrap text-xs text-ink-500">
                        {u.created_at ? formatDateTime(u.created_at) : '—'}
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="btn-ghost btn-sm p-1.5"
                            onClick={() => setPermissionsOf(u)}
                            title="Gerenciar permissões"
                            aria-label={`Gerenciar permissões de ${u.name}`}
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="btn-ghost btn-sm p-1.5"
                            onClick={() => setEditing(u)}
                            title="Editar"
                            aria-label={`Editar ${u.name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {u.id !== currentUserId && (
                            <PlainActionButton
                              action={() => toggleUserStatusAction(u.id)}
                              successMessage={`Usuário ${u.status === 'active' ? 'desativado' : 'ativado'}.`}
                              className="btn-ghost btn-sm p-1.5"
                            >
                              <Power className="h-4 w-4" />
                            </PlainActionButton>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Criar */}
      <UserFormModal
        open={creating}
        onClose={() => setCreating(false)}
        isAdmin={isAdmin}
        motoboys={motoboys}
        mode="create"
      />

      {/* Editar */}
      {editing && (
        <UserFormModal
          open
          onClose={() => setEditing(null)}
          isAdmin={isAdmin}
          motoboys={motoboys}
          mode="edit"
          user={editing}
        />
      )}

      {/* Permissões */}
      {permissionsOf && (
        <PermissionsModal
          user={permissionsOf}
          onClose={() => setPermissionsOf(null)}
        />
      )}
    </>
  );
}

/* ============================ FORMULÁRIO =============================== */

function UserFormModal({
  open,
  onClose,
  isAdmin,
  motoboys,
  mode,
  user,
}: {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  motoboys: Option[];
  mode: 'create' | 'edit';
  user?: UserRow;
}) {
  const action = mode === 'create' ? createUserAction : updateUserAction;
  const [state, formAction] = useFormState<ActionResult | null, FormData>(action, null);
  const [role, setRole] = useState<UserRole>(user?.role ?? 'operator');
  const router = useRouter();

  // Fecha e atualiza a lista quando a action conclui com sucesso.
  // Precisa ser um efeito: chamar router.refresh()/onClose() durante a
  // renderização dispara atualização de estado em outro componente no meio
  // do render, o que o React rejeita e pode deixar o modal aberto.
  useEffect(() => {
    if (state?.ok && open) {
      router.refresh();
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const roleOptions = (Object.keys(ROLE_LABEL) as UserRole[])
    .filter((r) => isAdmin || r !== 'admin')
    .map((r) => ({ value: r, label: ROLE_LABEL[r] }));

  return (
    <CrudModal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Novo usuário' : 'Editar usuário'}
      subtitle={
        mode === 'create'
          ? 'Crie o acesso e defina as permissões iniciais.'
          : `${user?.name} · ${user?.email}`
      }
      action={action}
      successMessage={mode === 'create' ? 'Usuário cadastrado.' : 'Usuário atualizado.'}
      submitLabel={mode === 'create' ? 'Criar usuário' : 'Salvar alterações'}
      size="lg"
    >
      {user && <input type="hidden" name="user_id" value={user.id} />}
      {state?.error && <Alert kind="error" message={state.error} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Nome completo"
          name="name"
          defaultValue={user?.name}
          required
          maxLength={150}
          className="sm:col-span-2"
        />
        <Field
          label="E-mail"
          name="email"
          type="email"
          defaultValue={user?.email}
          required
          maxLength={200}
        />
        <MaskedField
          label="Telefone"
          name="phone"
          mask="phone"
          defaultValue={user?.phone}
          placeholder="(00) 00000-0000"
        />

        {mode === 'create' && (
          <>
            <Field
              label="Senha inicial"
              name="password"
              type="password"
              required
              hint="Mínimo 6 caracteres"
            />
            <Field
              label="Confirmar senha"
              name="confirmPassword"
              type="password"
              required
            />
          </>
        )}

        <div>
          <label htmlFor="role" className="label">
            Perfil de acesso <span className="text-rose-500">*</span>
          </label>
          <select
            id="role"
            name="role"
            className="select"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            required
          >
            {roleOptions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <SelectField
          label="Situação"
          name="status"
          defaultValue={user?.status ?? 'active'}
          options={[
            { value: 'active', label: 'Ativo' },
            { value: 'inactive', label: 'Inativo' },
          ]}
        />

        {role === 'motoboy' && (
          <SelectField
            label="Motoboy vinculado"
            name="motoboy_id"
            includeEmpty
            emptyLabel="Não vinculado"
            defaultValue={user?.motoboy_id}
            options={motoboys.map((m) => ({ value: m.id, label: m.name }))}
            className="sm:col-span-2"
          />
        )}

        {mode === 'create' && (
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm font-medium text-ink-700">
              Permissões iniciais (opcional)
            </p>
            <PermissionMatrix
              selected={[]}
              disabled={false}
              allowedModules={isAdmin ? undefined : ['Usuários']}
            />
            <p className="mt-2 text-xs text-ink-500">
              Sem nenhuma permissão marcada, o usuário herda o padrão do perfil escolhido.
            </p>
          </div>
        )}
      </div>
    </CrudModal>
  );
}

/* ========================== PERMISSÕES ================================ */

function PermissionsModal({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    updateUserPermissionsAction,
    null,
  );
  const router = useRouter();
  const [useDefaults, setUseDefaults] = useState(parsePerms(user.permissions).length === 0);
  const selected = parsePerms(user.permissions);

  // Ver comentário equivalente em UserFormModal: efeito, não render.
  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Modal
      open
      onClose={onClose}
      title="Gerenciar permissões"
      subtitle={`${user.name} · ${ROLE_LABEL[user.role]}`}
      size="lg"
    >
      <form action={formAction} className="space-y-5">
        {state?.error && <Alert kind="error" message={state.error} />}
        <input type="hidden" name="user_id" value={user.id} />

        <label className="flex items-start gap-2 rounded-lg border border-ink-200 bg-ink-50 p-3">
          <input
            type="checkbox"
            name="use_role_defaults"
            checked={useDefaults}
            onChange={(e) => setUseDefaults(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm text-ink-700">
            <span className="font-semibold">Usar o padrão do perfil</span>
            <span className="block text-xs text-ink-500">
              Quando marcado, o usuário recebe as permissões do perfil e a matriz abaixo é ignorada.
            </span>
          </span>
        </label>

        <div className={useDefaults ? 'pointer-events-none opacity-50' : ''}>
          <PermissionMatrix selected={selected} disabled={useDefaults} />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-ink-100 pt-4 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>
            Cancelar
          </button>
          <SubmitButton label="Salvar permissões" className="btn-primary w-full sm:w-auto" />
        </div>
      </form>
    </Modal>
  );
}

function PermissionMatrix({
  selected,
  disabled,
  allowedModules,
}: {
  selected: string[];
  disabled: boolean;
  allowedModules?: string[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-ink-200">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-ink-200 bg-ink-50/70">
            <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Módulo
            </th>
            <th className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-500">
              Ações permitidas
            </th>
          </tr>
        </thead>
        <tbody>
          {MODULES.map((mod) => {
            const moduleDisabled =
              disabled || (allowedModules ? !allowedModules.includes(mod.label) : false);
            return (
              <tr key={mod.label} className="border-b border-ink-100 last:border-0">
                <td className="px-3 py-2.5 align-top font-medium text-ink-800">{mod.label}</td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {mod.actions.map((a) => (
                      <label
                        key={a.perm}
                        className={`flex items-center gap-1.5 text-xs ${moduleDisabled ? 'text-ink-400' : 'text-ink-700'
                          }`}
                      >
                        <input
                          type="checkbox"
                          name="perm"
                          value={a.perm}
                          defaultChecked={selected.includes(a.perm)}
                          disabled={moduleDisabled}
                          className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                        />
                        {a.label}
                      </label>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}