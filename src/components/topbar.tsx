'use client';

/**
 * Barra superior: alterna o menu no mobile, mostra notificações de mensagens
 * não lidas, indicador de tempo real e ações de perfil/sair.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  User as UserIcon,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { SessionUser } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/types';
import { RealtimeIndicator } from '@/components/ui';
import { soundNotification } from '@/lib/sound';
import type { RealtimeStatus } from '@/components/use-realtime';

/** Rótulo amigável da rota atual (mostrado no cabeçalho). */
const TITLES: { match: string; title: string }[] = [
  { match: '/dashboard/corridas/nova', title: 'Nova Corrida' },
  { match: '/dashboard/corridas/hoje', title: 'Corridas do Dia' },
  { match: '/dashboard/corridas', title: 'Todas as Corridas' },
  { match: '/dashboard/relatorios', title: 'Relatórios' },
  { match: '/dashboard/cadastro', title: 'Cadastro' },
  { match: '/dashboard/comunicacao/comunicados', title: 'Comunicados' },
  { match: '/dashboard/comunicacao', title: 'Comunicação Interna' },
  { match: '/dashboard/perfil', title: 'Meu Perfil' },
  { match: '/dashboard/configuracoes', title: 'Configurações' },
  { match: '/dashboard', title: 'Dashboard' },
];

export function Topbar({
  user,
  unreadCount,
  realtimeStatus,
  onOpenMobileMenu,
  onLogout,
}: {
  user: SessionUser;
  unreadCount: number;
  realtimeStatus: RealtimeStatus;
  onOpenMobileMenu: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  const title = TITLES.find((t) => pathname.startsWith(t.match))?.title ?? 'Dashboard';

  // Lê a preferência salva só no cliente (evita divergência de hidratação).
  useEffect(() => {
    setSoundOn(soundNotification.isEnabled());
  }, []);

  const toggleSound = () => {
    const next = !soundOn;
    soundNotification.setEnabled(next);
    setSoundOn(next);
    if (next) soundNotification.playCompleted();
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/90 backdrop-blur print:hidden">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="btn-ghost -ml-2 p-2 lg:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-ink-900 sm:text-lg">{title}</h1>
        </div>

        <RealtimeIndicator status={realtimeStatus} />

        {/* Som de notificações */}
        <button
          type="button"
          onClick={toggleSound}
          className="rounded-lg p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
          aria-label={soundOn ? 'Desativar som de notificações' : 'Ativar som de notificações'}
          title={soundOn ? 'Som ativado' : 'Som desativado'}
        >
          {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
        </button>

        {/* Notificações */}
        <Link
          href="/dashboard/comunicacao"
          className="relative rounded-lg p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-900"
          aria-label={
            unreadCount > 0 ? `${unreadCount} mensagem(ns) não lida(s)` : 'Mensagens'
          }
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        {/* Menu do usuário */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg p-1.5 pr-2 transition hover:bg-ink-100"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold uppercase text-white">
              {user.name.charAt(0)}
            </span>
            <span className="hidden max-w-[120px] truncate text-sm font-medium text-ink-800 sm:block">
              {user.name}
            </span>
            <ChevronDown className="h-4 w-4 text-ink-400" />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 w-56 animate-fade-in overflow-hidden rounded-xl border-ink-200 bg-white py-1 shadow-pop"
              role="menu"
            >
              <div className="border-b border-ink-100 px-3 py-2">
                <p className="truncate text-sm font-semibold text-ink-900">{user.name}</p>
                <p className="truncate text-xs text-ink-500">{user.email}</p>
                <p className="mt-1 text-[11px] font-medium text-brand-700">
                  {ROLE_LABEL[user.role]}
                </p>
              </div>
              <Link
                href="/dashboard/perfil"
                className="flex items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                <UserIcon className="h-4 w-4" /> Meu Perfil
              </Link>
              <Link
                href="/dashboard/configuracoes"
                className="flex items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                <Settings className="h-4 w-4" /> Configurações
              </Link>
              <Link
                href="/dashboard/comunicacao"
                className="flex items-center gap-2 px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                <MessageSquare className="h-4 w-4" /> Mensagens
                {unreadCount > 0 && (
                  <span className="badge ml-auto bg-rose-100 text-rose-700 ring-rose-200">
                    {unreadCount}
                  </span>
                )}
              </Link>
              <div className="my-1 border-t border-ink-100" />
              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"
                role="menuitem"
              >
                <LogOut className="h-4 w-4" /> Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
