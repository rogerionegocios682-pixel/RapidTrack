import React, { useState, useEffect, useMemo } from 'react';
import {
  Bell,
  LogOut,
  User,
  Building2,
  Clock,
  Shield,
  Menu,
  Sparkles,
  ChevronDown,
  Volume2,
  VolumeX,
  CheckCheck,
  Send,
  AlertTriangle,
  Bike,
  CheckCircle,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatTime, formatDateTime } from '../../utils/formatters';
import { pushNotification } from '../../services/pushNotification';
import { soundNotification } from '../../services/soundNotification';
import type { AppNotification } from '../../types';

interface NavbarProps {
  onToggleSidebar: () => void;
  pendingOrdersCount: number;
  onNavigateToDispatch: () => void;
  notifications: AppNotification[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  pendingOrdersCount,
  onNavigateToDispatch,
  notifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
}) => {
  const { userProfile, companySettings, logout, isAdmin, isOperator, seedDemo } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Notification preferences state
  const [soundEnabled, setSoundEnabled] = useState(soundNotification.isEnabled());
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(
    pushNotification.getPermission()
  );
  const [notificationFilter, setNotificationFilter] = useState<'all' | 'manager' | 'motoboy' | 'delay'>('all');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      if (notificationFilter === 'manager') return n.targetRole === 'manager' || n.targetRole === 'all';
      if (notificationFilter === 'motoboy') return n.targetRole === 'motoboy' || n.targetRole === 'all';
      if (notificationFilter === 'delay') return n.type === 'pending_delay';
      return true;
    });
  }, [notifications, notificationFilter]);

  const handleToggleSound = () => {
    const newState = !soundEnabled;
    soundNotification.setEnabled(newState);
    setSoundEnabled(newState);
    if (newState) {
      soundNotification.playCompletedChime();
    }
  };

  const handleRequestPush = async () => {
    const granted = await pushNotification.requestPermission();
    setPushPermission(pushNotification.getPermission());
    if (granted) {
      pushNotification.showNotification(
        'Notificações Ativadas!',
        'Você receberá alertas em tempo real sobre novas corridas e status de pedidos.',
        'new_order'
      );
    }
  };

  const handleTestNotification = () => {
    pushNotification.showNotification(
      'Teste: Nova Corrida #9999',
      'Loja Central → Boa Viagem | Motoboy: Carlos Eduardo - R$ 14,00',
      'new_order'
    );
  };

  const getRoleBadge = (role: string | undefined) => {
    switch (role) {
      case 'admin':
        return { label: 'ADMINISTRADOR', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' };
      case 'operator':
        return { label: 'OPERADOR', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' };
      default:
        return { label: 'CONSULTA', color: 'bg-slate-500/10 text-slate-600 border-slate-500/30' };
    }
  };

  const roleInfo = getRoleBadge(userProfile?.role);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-md sm:px-6 shadow-xs">
      {/* Left side: Mobile Toggle & Company Identity */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          aria-label="Alternar menu"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3">
          {companySettings?.logoUrl ? (
            <img
              src={companySettings.logoUrl}
              alt="Logo"
              className="h-10 w-10 rounded-lg object-contain border border-slate-200 bg-white p-1"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0B192C] text-white font-bold shadow-xs">
              <Building2 className="h-5 w-5 text-orange-500" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 sm:text-base leading-tight">
                {companySettings?.tradeName || 'Delivery OS'}
              </h1>
              <span className="hidden sm:inline-block rounded-sm bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 border border-slate-200">
                HERCULANO GESTOR
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden md:block">
              CNPJ: {companySettings?.cnpj || 'Não informado'}
            </p>
          </div>
        </div>
      </div>

      {/* Right side: Clock, Notifications, User Profile */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Live operational clock */}
        <div className="hidden lg:flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 border border-slate-200/80 text-xs text-slate-600">
          <Clock className="h-3.5 w-3.5 text-orange-500" />
          <span className="font-medium text-slate-800">{formatDate(currentTime)}</span>
          <span className="text-slate-300">|</span>
          <span className="font-mono font-semibold text-slate-900">{formatTime(currentTime)}</span>
        </div>

        {/* Real-time Push & In-app Notification Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus:outline-hidden"
            title="Notificações Push e Avisos em Tempo Real"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 ? (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-600 text-[10px] font-bold text-white animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : pendingOrdersCount > 0 ? (
              <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-orange-500" />
            ) : null}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-96 max-w-[92vw] rounded-2xl border border-slate-200 bg-white shadow-2xl z-50 overflow-hidden">
              {/* Header */}
              <div className="bg-[#0B192C] p-4 text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-orange-400" />
                    <h4 className="font-bold text-sm">Notificações em Tempo Real</h4>
                  </div>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-orange-500/20 border border-orange-500/30 px-2 py-0.5 text-[10px] font-bold text-orange-300">
                      {unreadCount} novas
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 mt-1">
                  Avisos para gestores e motoboys sobre novas corridas e pendências.
                </p>

                {/* Control bar: Browser Push toggle, Sound toggle, Test button */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2 text-[11px]">
                  {/* Push Permission button */}
                  {pushPermission === 'granted' ? (
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Push Ativo
                    </span>
                  ) : (
                    <button
                      onClick={handleRequestPush}
                      className="rounded-lg bg-orange-500/20 border border-orange-500/40 px-2 py-1 font-bold text-orange-300 hover:bg-orange-500/30 transition-colors"
                    >
                      Ativar Push no Navegador
                    </button>
                  )}

                  {/* Sound Toggle */}
                  <button
                    onClick={handleToggleSound}
                    className="flex items-center gap-1 rounded-lg bg-slate-800 px-2 py-1 text-slate-300 hover:text-white transition-colors"
                    title={soundEnabled ? 'Silenciar alertas sonoros' : 'Ativar alertas sonoros'}
                  >
                    {soundEnabled ? (
                      <>
                        <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Som Ativo</span>
                      </>
                    ) : (
                      <>
                        <VolumeX className="h-3.5 w-3.5 text-slate-400" />
                        <span>Mudo</span>
                      </>
                    )}
                  </button>

                  {/* Test button */}
                  <button
                    onClick={handleTestNotification}
                    className="text-[10px] font-semibold text-slate-400 hover:text-orange-400 underline"
                  >
                    Testar Aviso
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600 gap-2">
                <button
                  onClick={() => setNotificationFilter('all')}
                  className={`rounded-md px-2 py-1 ${
                    notificationFilter === 'all' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  Todas
                </button>
                <button
                  onClick={() => setNotificationFilter('manager')}
                  className={`rounded-md px-2 py-1 ${
                    notificationFilter === 'manager' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  Gestor
                </button>
                <button
                  onClick={() => setNotificationFilter('motoboy')}
                  className={`rounded-md px-2 py-1 ${
                    notificationFilter === 'motoboy' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  Motoboys
                </button>
                <button
                  onClick={() => setNotificationFilter('delay')}
                  className={`rounded-md px-2 py-1 ${
                    notificationFilter === 'delay' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
                  }`}
                >
                  Pendências
                </button>
              </div>

              {/* Notification List */}
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 scrollbar-thin">
                {filteredNotifications.length > 0 ? (
                  filteredNotifications.slice(0, 15).map((n) => {
                    let Icon = Bike;
                    let iconBg = 'bg-blue-100 text-blue-600';

                    if (n.type === 'new_order') {
                      Icon = Send;
                      iconBg = 'bg-orange-100 text-orange-600';
                    } else if (n.type === 'pending_delay') {
                      Icon = AlertTriangle;
                      iconBg = 'bg-amber-100 text-amber-700';
                    } else if (n.type === 'order_completed') {
                      Icon = CheckCircle;
                      iconBg = 'bg-emerald-100 text-emerald-600';
                    } else if (n.type === 'order_canceled') {
                      Icon = XCircle;
                      iconBg = 'bg-red-100 text-red-600';
                    }

                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (!n.read) onMarkNotificationRead(n.id);
                        }}
                        className={`flex items-start gap-3 p-3 transition-colors cursor-pointer ${
                          !n.read ? 'bg-orange-50/40 hover:bg-orange-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className={`rounded-xl p-2 shrink-0 ${iconBg}`}>
                          <Icon className="h-4 w-4" />
                        </div>

                        <div className="flex-1 min-w-0 text-xs">
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-bold text-slate-900 truncate">{n.title}</p>
                            {!n.read && <span className="h-2 w-2 rounded-full bg-orange-500 shrink-0" />}
                          </div>
                          <p className="text-slate-600 mt-0.5 leading-snug">{n.body}</p>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                            <span>{formatTime(n.timestamp)}</span>
                            {n.targetMotoboyName && (
                              <span className="font-semibold text-slate-500">
                                Motoboy: {n.targetMotoboyName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-xs text-slate-500">
                    <p className="font-medium text-slate-700">Nenhum aviso no momento</p>
                    <p className="text-slate-400 mt-0.5">As notificações em tempo real aparecerão aqui.</p>
                  </div>
                )}
              </div>

              {/* Bottom bar */}
              <div className="border-t border-slate-100 bg-slate-50 p-2.5 flex items-center justify-between text-xs">
                {unreadCount > 0 && (
                  <button
                    onClick={onMarkAllNotificationsRead}
                    className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-slate-900"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>Marcar todas como lidas</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    setShowNotifications(false);
                    onNavigateToDispatch();
                  }}
                  className="text-[11px] font-bold text-orange-600 hover:text-orange-700 ml-auto"
                >
                  Ir para Despacho →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 rounded-xl p-1.5 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
              {userProfile?.name?.charAt(0) || 'U'}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-bold text-slate-900 leading-tight">
                {userProfile?.name || 'Operador'}
              </p>
              <span className={`inline-block text-[9px] font-bold border px-1.5 py-0.2 rounded-sm ${roleInfo.color}`}>
                {roleInfo.label}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400 hidden sm:block" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-50">
              <div className="border-b border-slate-100 px-3 py-2 mb-1">
                <p className="text-xs font-bold text-slate-900">{userProfile?.name}</p>
                <p className="text-[11px] text-slate-500 truncate">{userProfile?.email}</p>
                <div className="mt-1.5">
                  <span className={`inline-block text-[9px] font-bold border px-1.5 py-0.2 rounded-sm ${roleInfo.color}`}>
                    {roleInfo.label}
                  </span>
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={async () => {
                    await seedDemo();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-orange-50 hover:text-orange-700 text-left transition-colors"
                >
                  <Sparkles className="h-4 w-4 text-orange-500" />
                  Popular Dados de Exemplo
                </button>
              )}

              <button
                onClick={async () => {
                  setShowUserMenu(false);
                  await logout();
                }}
                className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 text-left transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sair da Conta
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
