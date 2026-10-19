'use client';

/**
 * Configurações do sistema (client).
 * ---------------------------------------------------------------------------
 * Admin: lista de usuários com edição de papel, situação e vínculo com motoboy.
 * Os demais papéis veem apenas informações gerais do sistema.
 */
import { useEffect, useState } from 'react';
import { useFormState } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Pencil, ShieldCheck, Users } from 'lucide-react';
import { Alert, SelectField, SubmitButton } from '@/components/form';
import { Modal, EmptyState, ActiveStatusBadge } from '@/components/ui';
import { Section } from '@/components/stat-card';
import { updateUserAccessAction } from '@/app/actions/app';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABEL, type UserRole, type UserStatus } from '@/lib/types';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  motoboy_id: string | null;
  motoboy_name: string | null;
  last_login_at: string | null;
}

interface Option {
  id: string;
  name: string;
}

export function SettingsClient({
  currentUserId,
  canManageUsers,
  users,
  motoboys,
}: {
  currentUserId: string;
  canManageUsers: boolean;
  users: UserRow[];
  motoboys: Option[];
}) {
  const [editing, setEditing] = useState<UserRow | null>(null);

  return (
    <div className="space-y-5">
      {canManageUsers ? (
        <Section
          title="Usuários do sistema"
          description="Defina o papel e a situação de cada usuário."
          action={
            <span className="badge bg-ink-100 text-ink-600 ring-ink-200">
              <Users className="h-3.5 w-3.5" /> {users.length}
            </span>
          }
        >
          {users.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="Nenhum usuário"
              message="Não há usuários cadastrados."
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Papel</th>
                    <th>Motoboy vinculado</th>
                    <th>Situação</th>
                    <th>Último acesso</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="font-semibold text-ink-900">
                        {u.name}
                        {u.id === currentUserId && (
                          <span className="ml-2 text-xs font-normal text-brand-600">(você)</span>
                        )}
                      </td>
                      <td className="max-w-[220px] truncate text-ink-600" title={u.email}>
                        {u.email}
                      </td>
                      <td className="text-ink-700">{ROLE_LABEL[u.role]}</td>
                      <td className="text-ink-600">{u.motoboy_name ?? '—'}</td>
                      <td>
                        <ActiveStatusBadge status={u.status} />
                      </td>
                      <td className="whitespace-nowrap text-xs text-ink-500">
                        {u.last_login_at ? formatDateTime(u.last_login_at) : 'Nunca'}
                      </td>
                      <td>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="btn-ghost btn-sm p-1.5"
                            onClick={() => setEditing(u)}
                            title="Editar acesso"
                            aria-label="Editar acesso"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      ) : (
        <Section title="Acesso restrito" description="Gestão de usuários">
          <EmptyState
            icon={<ShieldCheck className="h-8 w-8" />}
            title="Somente administradores"
            message="A administração de usuários é exclusiva do papel Administrador."
          />
        </Section>
      )}

      <Section title="Sobre o sistema" description="Delivery_OS — Gestão de Entregas e Motoboys">
        <dl className="grid gap-3 p-4 text-sm sm:grid-cols-2 sm:p-5">
          <Info label="Versão" value="1.0.0" />
          <Info label="Fuso horário" value="America/Sao_Paulo" />
          <Info label="Backup do banco" value="data/delivery_os.db" />
          <Info label="Tempo real" value="SSE em /api/realtime" />
        </dl>
      </Section>

      {editing && (
        <AccessModal
          user={editing}
          motoboys={motoboys}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-ink-800">{value}</dd>
    </div>
  );
}

function AccessModal({
  user,
  motoboys,
  onClose,
}: {
  user: UserRow;
  motoboys: Option[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction] = useFormState(updateUserAccessAction, null);
  const [role, setRole] = useState<UserRole>(user.role);

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
      title="Editar acesso"
      subtitle={`${user.name} · ${user.email}`}
      size="sm"
    >
      <form action={formAction} className="space-y-4">
        {state?.error && <Alert kind="error" message={state.error} />}
        <input type="hidden" name="user_id" value={user.id} />

        <div>
          <label htmlFor="role" className="label">
            Papel
          </label>
          <select
            id="role"
            name="role"
            className="select"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>

        {role === 'motoboy' && (
          <SelectField
            label="Motoboy vinculado"
            name="motoboy_id"
            includeEmpty
            emptyLabel="Não vinculado"
            defaultValue={user.motoboy_id}
            options={motoboys.map((m) => ({ value: m.id, label: m.name }))}
          />
        )}

        <SelectField
          label="Situação"
          name="status"
          defaultValue={user.status}
          options={[
            { value: 'active', label: 'Ativo' },
            { value: 'inactive', label: 'Inativo' },
          ]}
        />

        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>
            Cancelar
          </button>
          <SubmitButton label="Salvar" className="btn-primary w-full sm:w-auto" />
        </div>
      </form>
    </Modal>
  );
}
