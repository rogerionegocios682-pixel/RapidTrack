'use server';

import { requirePermission } from '@/lib/auth';
import {
  sendMessage,
  markMessageRead,
  markAllRead,
  deleteMessage,
} from '@/lib/repo/messages';
import {
  updateProfile,
  changeOwnPassword,
  listUsers,
  updateUserRoleAndStatus,
} from '@/lib/repo/users';
import { clean } from '@/lib/utils';
import type { MessageAudience, UserRole, UserStatus } from '@/lib/types';
import { guard, type ActionResult } from './guard';

const REVALIDATE = ['/dashboard/comunicacao', '/dashboard'];

/* ======================= COMUNICAÇÃO INTERNA =========================== */

export async function sendMessageAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('messages.send');

    const audienceRaw = clean(formData.get('audience'), 20) || 'user';
    const isAnnouncement = formData.get('is_announcement') === 'on';

    if (isAnnouncement) {
      await requirePermission('announcements.send');
    }

    const audience: MessageAudience = (['user', 'all', 'operators', 'motoboys'] as const).includes(
      audienceRaw as MessageAudience,
    )
      ? (audienceRaw as MessageAudience)
      : 'user';

    await sendMessage(
      {
        audience,
        receiver_id: audience === 'user' ? clean(formData.get('receiver_id'), 60) : null,
        subject: clean(formData.get('subject'), 150),
        message: clean(formData.get('message'), 2000),
        is_announcement: isAnnouncement,
      },
      user,
    );
    return true;
  }, { revalidate: REVALIDATE });
}

export async function markMessageReadAction(id: string): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('messages.view');
    await markMessageRead(id, user);
    return true;
  }, { revalidate: REVALIDATE });
}

export async function markAllReadAction(): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('messages.view');
    await markAllRead(user);
    return true;
  }, { revalidate: REVALIDATE });
}

export async function deleteMessageAction(id: string): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('messages.view');
    await deleteMessage(id, user);
    return true;
  }, { revalidate: REVALIDATE });
}

/* ============================= PERFIL ================================= */

export async function updateProfileAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('dashboard.view');
    await updateProfile(
      user.id,
      {
        name: clean(formData.get('name'), 150),
        phone: clean(formData.get('phone'), 30),
      },
      user,
    );
    return true;
  }, { revalidate: ['/dashboard/perfil'] });
}

export async function changePasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('dashboard.view');
    await changeOwnPassword(
      user.id,
      String(formData.get('currentPassword') ?? ''),
      String(formData.get('newPassword') ?? ''),
      String(formData.get('confirmPassword') ?? ''),
      user,
    );
    return true;
  }, { revalidate: ['/dashboard/perfil'] });
}

/* ====================== GESTÃO DE USUÁRIOS (admin) ===================== */

export async function listUsersAction(): Promise<ActionResult<Awaited<ReturnType<typeof listUsers>>>> {
  return guard(async () => {
    await requirePermission('users.manage');
    return listUsers();
  });
}

export async function updateUserAccessAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const actor = await requirePermission('users.manage');
    const userId = clean(formData.get('user_id'), 60);
    if (!userId) throw new Error('Usuário não identificado.');

    const roleRaw = clean(formData.get('role'), 20);
    const role: UserRole = (['admin', 'operator', 'motoboy'] as const).includes(
      roleRaw as UserRole,
    )
      ? (roleRaw as UserRole)
      : 'operator';

    const status: UserStatus = clean(formData.get('status'), 20) === 'inactive'
      ? 'inactive'
      : 'active';

    await updateUserRoleAndStatus(
      userId,
      { role, status, motoboy_id: clean(formData.get('motoboy_id'), 60) || null },
      actor,
    );
    return true;
  }, { revalidate: ['/dashboard/configuracoes'] });
}
