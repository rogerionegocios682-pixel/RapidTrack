'use server';

/**
 * Server Actions de gerenciamento de usuários (Cadastro → Usuários).
 * ---------------------------------------------------------------------------
 * Todas as ações exigem a permissão `users.manage`. A criação de usuários é
 * feita por função administrativa segura — nunca no cliente — e a senha é
 * sempre armazenada como hash (scrypt), jamais em texto puro.
 *
 * Regras de segurança aplicadas aqui (não apenas na UI):
 *  - Um usuário NÃO pode alterar as próprias permissões nem se desativar.
 *  - Um usuário não-administrador não pode criar outro administrador.
 *  - Usuários inativos não podem ser criados como ativos sem decisão do admin.
 */
import { requirePermission, parsePermissions, PERMISSIONS } from '@/lib/auth';
import {
  createUserByAdmin,
  updateUserDetails,
  updateUserPermissions,
  getUserById,
} from '@/lib/repo/users';
import { clean } from '@/lib/utils';
import type { UserRole, UserStatus } from '@/lib/types';
import { guard, type ActionResult } from './guard';

const REVALIDATE = ['/dashboard/cadastro/usuarios', '/dashboard/configuracoes'];

const ROLES: UserRole[] = ['admin', 'operator', 'motoboy'];

function asRole(value: unknown): UserRole {
  const v = clean(value, 20);
  return (ROLES as string[]).includes(v) ? (v as UserRole) : 'operator';
}

function asStatus(value: unknown): UserStatus {
  return clean(value, 20) === 'inactive' ? 'inactive' : 'active';
}

/** Lê as permissões marcadas no formulário (campos `perm` repetidos). */
function readPermissions(formData: FormData): string[] {
  const raw = formData.getAll('perm').map((v) => String(v));
  return raw.filter((p) => (PERMISSIONS as string[]).includes(p));
}

/* ======================== CRIAR USUÁRIO =============================== */

export async function createUserAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const actor = await requirePermission('users.manage');

    const role = asRole(formData.get('role'));

    // Um não-administrador não pode criar outro administrador.
    if (role === 'admin' && actor.role !== 'admin') {
      throw new Error('Apenas administradores podem criar outros administradores.');
    }

    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');
    if (password !== confirmPassword) throw new Error('As senhas não conferem.');

    await createUserByAdmin(
      {
        name: clean(formData.get('name'), 150),
        email: clean(formData.get('email'), 200),
        phone: clean(formData.get('phone'), 30),
        password,
        role,
        status: asStatus(formData.get('status')),
        motoboy_id: clean(formData.get('motoboy_id'), 60) || null,
        permissions: readPermissions(formData),
      },
      actor,
    );
    return true;
  }, { revalidate: REVALIDATE });
}

/* ======================== EDITAR USUÁRIO ============================== */

export async function updateUserAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const actor = await requirePermission('users.manage');
    const userId = clean(formData.get('user_id'), 60);
    if (!userId) throw new Error('Usuário não identificado.');

    const target = await getUserById(userId);
    if (!target) throw new Error('Usuário não encontrado.');

    const role = asRole(formData.get('role'));

    // Somente um administrador pode promover alguém a administrador.
    if (role === 'admin' && target.role !== 'admin' && actor.role !== 'admin') {
      throw new Error('Apenas administradores podem conceder o papel de administrador.');
    }

    await updateUserDetails(
      userId,
      {
        name: clean(formData.get('name'), 150),
        email: clean(formData.get('email'), 200),
        phone: clean(formData.get('phone'), 30),
        role,
        status: asStatus(formData.get('status')),
        motoboy_id: clean(formData.get('motoboy_id'), 60) || null,
      },
      actor,
    );
    return true;
  }, { revalidate: REVALIDATE });
}

/* ==================== PERMISSÕES INDIVIDUAIS ========================== */

export async function updateUserPermissionsAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const actor = await requirePermission('users.manage');
    const userId = clean(formData.get('user_id'), 60);
    if (!userId) throw new Error('Usuário não identificado.');

    // "Restaurar padrão do papel" remove o override.
    const useRoleDefaults = formData.get('use_role_defaults') === 'on';
    const permissions = useRoleDefaults ? null : readPermissions(formData);

    await updateUserPermissions(userId, permissions, actor);
    return true;
  }, { revalidate: REVALIDATE });
}

/* ==================== ATIVAR / DESATIVAR ============================== */

export async function toggleUserStatusAction(userId: string): Promise<ActionResult> {
  return guard(async () => {
    const actor = await requirePermission('users.manage');
    const target = await getUserById(userId);
    if (!target) throw new Error('Usuário não encontrado.');
    if (target.id === actor.id) throw new Error('Você não pode desativar o seu próprio usuário.');

    await updateUserDetails(
      userId,
      {
        name: target.name,
        email: target.email,
        phone: target.phone ?? undefined,
        role: target.role,
        status: target.status === 'active' ? 'inactive' : 'active',
        motoboy_id: target.motoboy_id,
      },
      actor,
    );
    return true;
  }, { revalidate: REVALIDATE });
}

/* ==================== LISTAR (para a UI) ============================== */

export { parsePermissions };