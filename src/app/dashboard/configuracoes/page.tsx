import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { hasPermission } from '@/lib/auth';
import { listUsers } from '@/lib/repo/users';
import { listActiveMotoboys } from '@/lib/repo/motoboys';
import { PageHeader } from '@/components/stat-card';
import { SettingsClient } from './client';

export const metadata: Metadata = { title: 'Configurações' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireUser();
  const canManageUsers = hasPermission(user.role, 'users.manage');

  const [users, motoboys] = canManageUsers
    ? await Promise.all([listUsers(), listActiveMotoboys()])
    : [[], []];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Configurações"
        description="Administração do sistema e controle de acessos."
      />
      <SettingsClient
        currentUserId={user.id}
        canManageUsers={canManageUsers}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          status: u.status,
          motoboy_id: u.motoboy_id,
          motoboy_name: u.motoboy_name,
          last_login_at: u.last_login_at,
        }))}
        motoboys={motoboys.map((m) => ({ id: m.id, name: m.name }))}
      />
    </div>
  );
}
