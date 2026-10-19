'use client';

/**
 * Shell do dashboard: mantém o estado do menu mobile, dispara o tempo real
 * e envolve as páginas. O logout é feito via server action + redirecionamento.
 */
import { useState, useTransition, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import { ConfirmProvider, ToastProvider, useConfirm, useToast } from '@/components/ui';
import { useRealtime, useVisibilityRefresh } from '@/components/use-realtime';
import { soundNotification } from '@/lib/sound';
import { logoutAction } from '@/app/actions/auth';
import type { SessionUser } from '@/lib/types';
import type { Permission } from '@/lib/auth';

function ShellInner({
  user,
  permissions,
  unreadCount,
  children,
}: {
  user: SessionUser;
  permissions: Permission[];
  unreadCount: number;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { status, lastEventAt } = useRealtime();
  useVisibilityRefresh();
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();

  // Toca um chime discreto a cada atualização recebida em tempo real.
  // Ignora o primeiro evento para não soar logo ao abrir a página.
  const sawFirstEvent = useRef(false);
  useEffect(() => {
    if (!lastEventAt) return;
    if (!sawFirstEvent.current) {
      sawFirstEvent.current = true;
      return;
    }
    soundNotification.play('newOrder');
  }, [lastEventAt]);

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Sair do sistema',
      message: 'Tem certeza que deseja encerrar a sua sessão?',
      confirmLabel: 'Sair',
      danger: true,
    });
    if (!ok) return;

    startTransition(async () => {
      try {
        await logoutAction();
      } catch {
        // logoutAction redireciona; se falhar, forçamos a ida ao login.
        toast.error('Sessão encerrada localmente.');
        router.push('/login');
      }
    });
  };

  return (
    <div className="flex min-h-screen bg-ink-50">
      <Sidebar
        user={user}
        permissions={permissions}
        unreadCount={unreadCount}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        onLogout={handleLogout}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          user={user}
          unreadCount={unreadCount}
          realtimeStatus={status}
          onOpenMobileMenu={() => setMobileOpen(true)}
          onLogout={handleLogout}
        />

        <main
          className={`flex-1 p-4 sm:p-5 lg:p-6 ${isPending ? 'opacity-70' : ''} print-container`}
        >
          {children}
        </main>

        <footer className="border-t border-ink-200 px-4 py-3 text-center text-xs text-ink-400 sm:px-6 print:hidden">
          DELIVERY_OS · Sistema de Gestão de Entregas e Motoboys
        </footer>
      </div>
    </div>
  );
}

export function DashboardShell(props: {
  user: SessionUser;
  permissions: Permission[];
  unreadCount: number;
  children: React.ReactNode;
}) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <ShellInner {...props} />
      </ConfirmProvider>
    </ToastProvider>
  );
}
