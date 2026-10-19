'use client';

/**
 * Menu lateral com a estrutura exata solicitada:
 * INÍCIO · CORRIDAS · RELATÓRIOS · CADASTRO · COMUNICAÇÃO INTERNA · SISTEMA
 * Em telas pequenas vira um drawer deslizante.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Building2,
  CalendarDays,
  CalendarRange,
  Car,
  ChevronDown,
  ClipboardList,
  Bike,
  FileBarChart,
  Gauge,
  Home,
  LogOut,
  MapPin,
  MessageSquare,
  Megaphone,
  Plus,
  Receipt,
  Settings,
  Table2,
  User,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { SessionUser } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/types';
import type { Permission } from '@/lib/auth';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  permission?: Permission;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: NavItem[];
}

const Ic = ({ children }: { children: React.ReactNode }) => (
  <span className="grid h-[18px] w-[18px] shrink-0 place-items-center">{children}</span>
);

const GROUPS: (NavGroup | { id: string; standalone: NavItem })[] = [
  {
    id: 'inicio',
    standalone: {
      href: '/dashboard',
      label: 'Dashboard',
      icon: <Ic><Home className="h-[18px] w-[18px]" /></Ic>,
      permission: 'dashboard.view',
    },
  },
  {
    id: 'corridas',
    label: 'Corridas',
    icon: <Ic><Bike className="h-[18px] w-[18px]" /></Ic>,
    items: [
      {
        href: '/dashboard/corridas/nova',
        label: 'Nova Corrida',
        icon: <Plus className="h-4 w-4" />,
        permission: 'deliveries.create',
      },
      {
        href: '/dashboard/corridas/hoje',
        label: 'Corridas do Dia',
        icon: <CalendarDays className="h-4 w-4" />,
        permission: 'deliveries.view',
      },
      {
        href: '/dashboard/corridas',
        label: 'Todas as Corridas',
        icon: <Table2 className="h-4 w-4" />,
        permission: 'deliveries.view',
      },
    ],
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    icon: <Ic><BarChart3 className="h-[18px] w-[18px]" /></Ic>,
    items: [
      { href: '/dashboard/relatorios/diario', label: 'Diário', icon: <CalendarDays className="h-4 w-4" />, permission: 'reports.view' },
      { href: '/dashboard/relatorios/semanal', label: 'Semanal', icon: <CalendarRange className="h-4 w-4" />, permission: 'reports.view' },
      { href: '/dashboard/relatorios/mensal', label: 'Mensal', icon: <Gauge className="h-4 w-4" />, permission: 'reports.view' },
      { href: '/dashboard/relatorios/anual', label: 'Anual', icon: <FileBarChart className="h-4 w-4" />, permission: 'reports.view' },
      { href: '/dashboard/relatorios/motoboy', label: 'Por Motoboy', icon: <Bike className="h-4 w-4" />, permission: 'reports.view' },
      { href: '/dashboard/relatorios/empresa', label: 'Por Empresa', icon: <Building2 className="h-4 w-4" />, permission: 'reports.view' },
    ],
  },
  {
    id: 'cadastro',
    label: 'Cadastro',
    icon: <Ic><ClipboardList className="h-[18px] w-[18px]" /></Ic>,
    items: [
      { href: '/dashboard/cadastro/empresas', label: 'Empresas', icon: <Building2 className="h-4 w-4" />, permission: 'companies.view' },
      { href: '/dashboard/cadastro/motoboys', label: 'Motoboys', icon: <Bike className="h-4 w-4" />, permission: 'motoboys.view' },
      { href: '/dashboard/cadastro/bairros', label: 'Bairros', icon: <MapPin className="h-4 w-4" />, permission: 'neighborhoods.view' },
      { href: '/dashboard/cadastro/taxas', label: 'Taxas', icon: <Receipt className="h-4 w-4" />, permission: 'fees.view' },
      { href: '/dashboard/cadastro/usuarios', label: 'Usuários', icon: <Users className="h-4 w-4" />, permission: 'users.manage' },
    ],
  },
  {
    id: 'comunicacao',
    label: 'Comunicação Interna',
    icon: <Ic><MessageSquare className="h-[18px] w-[18px]" /></Ic>,
    items: [
      { href: '/dashboard/comunicacao', label: 'Mensagens', icon: <MessageSquare className="h-4 w-4" />, permission: 'messages.view' },
      { href: '/dashboard/comunicacao/comunicados', label: 'Comunicados', icon: <Megaphone className="h-4 w-4" />, permission: 'messages.view' },
    ],
  },
  {
    id: 'sistema',
    label: 'Sistema',
    icon: <Ic><Settings className="h-[18px] w-[18px]" /></Ic>,
    items: [
      { href: '/dashboard/perfil', label: 'Meu Perfil', icon: <User className="h-4 w-4" /> },
      { href: '/dashboard/configuracoes', label: 'Configurações', icon: <Settings className="h-4 w-4" /> },
    ],
  },
];

export function Sidebar({
  user,
  permissions,
  unreadCount,
  mobileOpen,
  onCloseMobile,
  onLogout,
}: {
  user: SessionUser;
  permissions: Permission[];
  unreadCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
}) {
  const pathname = usePathname();
  const can = (p?: Permission) => !p || permissions.includes(p);

  // Grupos abertos: o que contém a rota atual + os que o usuário abriu.
  const activeGroupId = GROUPS.find(
    (g) =>
      'items' in g && g.items.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`)),
  )?.id;

  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    activeGroupId ? { [activeGroupId]: true } : { corridas: true },
  );

  useEffect(() => {
    if (activeGroupId) setOpen((prev) => ({ ...prev, [activeGroupId]: true }));
  }, [activeGroupId]);

  // Fecha o drawer ao navegar no mobile.
  useEffect(() => {
    onCloseMobile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const content = (
    <div className="flex h-full flex-col bg-white">
      {/* Marca */}
      <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
          <Car className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight text-ink-900">
            DELIVERY_OS
          </p>
          <p className="truncate text-[11px] text-ink-500">
            Gestão de Entregas e Motoboys
          </p>
        </div>
      </div>

      {/* Usuário */}
      <div className="border-b border-ink-100 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold uppercase text-brand-700 ring-1 ring-brand-100">
            {user.name.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink-900">{user.name}</p>
            <p className="truncate text-[11px] text-ink-500">{ROLE_LABEL[user.role]}</p>
          </div>
        </div>
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Menu principal">
        {GROUPS.map((group) => {
          if ('standalone' in group) {
            const item = group.standalone;
            if (!can(item.permission)) return null;
            const active = pathname === item.href;
            return (
              <Link
                key={group.id}
                href={item.href}
                className={`nav-link mb-1 ${active ? 'nav-link-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          }

          const visibleItems = group.items.filter((i) => can(i.permission));
          if (!visibleItems.length) return null;

          const isOpen = open[group.id] ?? false;
          const hasActive = visibleItems.some((i) => pathname === i.href);

          return (
            <div key={group.id} className="mb-0.5">
              <button
                type="button"
                onClick={() => setOpen((p) => ({ ...p, [group.id]: !isOpen }))}
                aria-expanded={isOpen}
                className={`nav-link w-full justify-between ${hasActive && !isOpen ? 'text-brand-700' : ''
                  }`}
              >
                <span className="flex items-center gap-3">
                  {group.icon}
                  <span>{group.label}</span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-ink-400 transition-transform ${isOpen ? 'rotate-180' : ''
                    }`}
                />
              </button>

              {isOpen && (
                <div className="ml-4 mt-0.5 space-y-0.5 border-l border-ink-200 pl-2">
                  {visibleItems.map((item) => {
                    const active = pathname === item.href;
                    const showBadge =
                      item.href === '/dashboard/comunicacao' && unreadCount > 0;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`sublink ${active ? 'sublink-active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                      >
                        {item.icon}
                        <span className="flex-1 truncate">{item.label}</span>
                        {showBadge && (
                          <span className="badge bg-rose-100 text-rose-700 ring-rose-200">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Sair */}
      <div className="border-t border-ink-100 p-3">
        <button
          type="button"
          onClick={onLogout}
          className="nav-link w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700"
        >
          <LogOut className="h-[18px] w-[18px]" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-64 shrink-0 border-r border-ink-200 lg:block print:hidden">
        <div className="sticky top-0 h-screen">{content}</div>
      </aside>

      {/* Mobile: drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div
            className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm"
            onClick={onCloseMobile}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-xs animate-slide-in shadow-pop">
            {content}
          </div>
        </div>
      )}
    </>
  );
}

export { Users };
