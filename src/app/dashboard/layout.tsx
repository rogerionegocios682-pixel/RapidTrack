import { redirect } from 'next/navigation';
import { getCurrentUser, getEffectivePermissions } from '@/lib/auth';
import { countUnread } from '@/lib/repo/messages';
import { DashboardShell } from '@/components/dashboard-shell';

/**
 * Layout protegido do dashboard.
 * Todas as páginas aqui dentro pressupõem usuário autenticado — o middleware
 * já barra requisições sem sessão, e aqui confirmamos o usuário no banco.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const unread = await countUnread(user);

  return (
    <DashboardShell
      user={user}
      permissions={getEffectivePermissions(user)}
      unreadCount={unread}
    >
      {children}
    </DashboardShell>
  );
}
