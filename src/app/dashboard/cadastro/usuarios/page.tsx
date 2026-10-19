import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth';
import { listUsers } from '@/lib/repo/users';
import { listActiveMotoboys } from '@/lib/repo/motoboys';
import { PageHeader } from '@/components/stat-card';
import { UsersClient } from './client';

export const metadata: Metadata = { title: 'Usuários' };
export const dynamic = 'force-dynamic';

function readParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = searchParams[key];
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  // Proteção no servidor: sem permissão, a página não carrega.
  const user = await requirePermission('users.manage');

  const search = readParam(searchParams, 'q');
  const statusParam = readParam(searchParams, 'status');
  const status = statusParam === 'active' || statusParam === 'inactive' ? statusParam : 'all';

  const [allUsers, motoboys] = await Promise.all([listUsers(), listActiveMotoboys()]);

  // Filtros aplicados no servidor (busca por nome/e-mail + situação).
  const needle = search.trim().toLowerCase();
  const users = allUsers.filter((u) => {
    const matchSearch =
      !needle ||
      u.name.toLowerCase().includes(needle) ||
      u.email.toLowerCase().includes(needle);
    const matchStatus = status === 'all' || u.status === status;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Usuários"
        description="Cadastro e permissões das pessoas autorizadas a operar o sistema."
      />
      <UsersClient
        currentUserId={user.id}
        isAdmin={user.role === 'admin'}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          role: u.role,
          status: u.status,
          motoboy_id: u.motoboy_id,
          motoboy_name: u.motoboy_name,
          permissions: u.permissions,
          last_login_at: u.last_login_at,
          created_at: u.created_at,
        }))}
        motoboys={motoboys.map((m) => ({ id: m.id, name: m.name }))}
      />
    </div>
  );
}