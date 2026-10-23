/**
 * Delivery OS — Herculano Gestor
 * Main Application Component with Real-Time Push Notifications
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Bike, Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, type ActivePage } from './components/layout/Sidebar';
import { AuthView } from './components/auth/AuthView';
import { DashboardView } from './components/dashboard/DashboardView';
import { DispatchView } from './components/dispatch/DispatchView';
import { RegistrationsView } from './components/registrations/RegistrationsView';
import { ReportsView } from './components/reports/ReportsView';
import { CompanyView } from './components/company/CompanyView';
import { UsersView } from './components/users/UsersView';
import { SettingsView } from './components/settings/SettingsView';
import {
  listenOrders,
  listenStores,
  listenMotoboys,
  listenRates,
  listenShiftClosings,
  listenNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createNotification,
} from './services/db';
import { pushNotification } from './services/pushNotification';
import type {
  DeliveryOrder,
  DeliveryStore,
  Motoboy,
  NeighborhoodRate,
  ShiftClosing,
  AppNotification,
} from './types';

const MainAppContent: React.FC = () => {
  const { currentUser, userProfile, loading, isAdmin, activeTenantId } = useAuth();

  // Navigation state: Admin gets dashboard, Operador and Consulta get dispatch
  const [activePage, setActivePage] = useState<ActivePage>(isAdmin ? 'dashboard' : 'dispatch');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Enforce access control: Operador and Consulta cannot access dashboard, relatorios, or usuarios
  useEffect(() => {
    if (!loading && userProfile && !isAdmin) {
      if (
        activePage === 'dashboard' ||
        activePage.startsWith('relatorios-') ||
        activePage === 'usuarios'
      ) {
        setActivePage('dispatch');
      }
    }
  }, [isAdmin, loading, userProfile, activePage]);

  // Modal open for new dispatch directly from anywhere
  const [isNewDispatchModalOpen, setIsNewDispatchModalOpen] = useState(false);

  // Real-time Firestore / Postgres state
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [stores, setStores] = useState<DeliveryStore[]>([]);
  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
  const [rates, setRates] = useState<NeighborhoodRate[]>([]);
  const [shiftClosings, setShiftClosings] = useState<ShiftClosing[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Ref to track known notification IDs to only trigger audio/push on truly new ones
  const initialLoadDone = useRef(false);
  const knownNotificationIds = useRef<Set<string>>(new Set());

  // Attach real-time listeners only when user is authenticated with an active tenant
  useEffect(() => {
    if (!currentUser || !activeTenantId) return;

    const unsubOrders = listenOrders(activeTenantId, (loaded) => {
      setOrders(loaded);
    });

    const unsubStores = listenStores(activeTenantId, (loaded) => {
      setStores(loaded);
    });

    const unsubMotoboys = listenMotoboys(activeTenantId, (loaded) => {
      setMotoboys(loaded);
    });

    const unsubRates = listenRates(activeTenantId, (loaded) => {
      setRates(loaded);
    });

    const unsubClosings = listenShiftClosings(activeTenantId, (loaded) => {
      setShiftClosings(loaded);
    });

    const unsubNotifications = listenNotifications(activeTenantId, (loaded) => {
      // Check for new incoming notifications to trigger sound & push
      if (initialLoadDone.current) {
        loaded.forEach((notif) => {
          if (!knownNotificationIds.current.has(notif.id) && !notif.read) {
            pushNotification.showNotification(
              notif.title,
              notif.body,
              notif.type,
              notif.id
            );
          }
        });
      } else {
        initialLoadDone.current = true;
      }

      // Update known IDs
      loaded.forEach((n) => knownNotificationIds.current.add(n.id));
      setNotifications(loaded);
    });

    return () => {
      unsubOrders();
      unsubStores();
      unsubMotoboys();
      unsubRates();
      unsubClosings();
      unsubNotifications();
    };
  }, [currentUser, activeTenantId]);

  // Periodic check for delayed pending orders (e.g. pending for > 20 minutes)
  const alertedDelays = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!activeTenantId || orders.length === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      orders.forEach((o) => {
        if (o.status === 'pending') {
          const orderTime = new Date(o.createdAt).getTime();
          const diffMinutes = (now - orderTime) / (1000 * 60);

          // If pending for more than 20 minutes and not yet alerted
          if (diffMinutes >= 20 && !alertedDelays.current.has(o.id)) {
            alertedDelays.current.add(o.id);

            const notifId = `notif_delay_${o.id}`;
            const delayNotif: AppNotification = {
              id: notifId,
              tenantId: activeTenantId,
              title: `Alerta de Demora: Pedido ${o.orderNumber}`,
              body: `Corrida com ${o.motoboyName} está pendente há mais de 20 minutos!`,
              type: 'pending_delay',
              orderId: o.id,
              orderNumber: o.orderNumber,
              targetRole: 'all',
              targetMotoboyId: o.motoboyId,
              targetMotoboyName: o.motoboyName,
              read: false,
              timestamp: new Date().toISOString(),
            };

            createNotification(delayNotif);
          }
        }
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [orders, userProfile?.tenantId]);

  // Pending orders count for live badges
  const pendingOrdersCount = useMemo(() => {
    return orders.filter((o) => o.status === 'pending').length;
  }, [orders]);

  // Loading state screen
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B192C] text-white">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500 shadow-xl shadow-orange-500/30 animate-pulse">
          <Bike className="h-8 w-8 text-white" />
        </div>
        <h2 className="mt-4 text-xl font-black tracking-tight text-white">Delivery OS</h2>
        <span className="text-[11px] font-bold text-orange-400 uppercase tracking-widest">
          Herculano Gestor
        </span>
        <div className="mt-6 flex items-center gap-2 text-xs text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
          <span>Carregando ambiente operacional...</span>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Authentication View
  if (!currentUser || !userProfile) {
    return <AuthView />;
  }

  return (
    <div className="flex min-h-screen bg-slate-100 selection:bg-orange-500 selection:text-white">
      {/* Sidebar */}
      <Sidebar
        activePage={activePage}
        onSelectPage={(page) => setActivePage(page)}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        pendingOrdersCount={pendingOrdersCount}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Navbar Header with Real-Time Push Notifications */}
        <Navbar
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          pendingOrdersCount={pendingOrdersCount}
          onNavigateToDispatch={() => setActivePage('dispatch')}
          notifications={notifications}
          onMarkNotificationRead={(id) => markNotificationAsRead(id)}
          onMarkAllNotificationsRead={() => {
            const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
            if (unreadIds.length > 0) markAllNotificationsAsRead(unreadIds);
          }}
        />

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          {activePage === 'dashboard' && (
            isAdmin ? (
              <DashboardView
                orders={orders}
                stores={stores}
                motoboys={motoboys}
                onNavigate={(page) => setActivePage(page)}
                onOpenNewDispatch={() => {
                  setActivePage('dispatch');
                  setIsNewDispatchModalOpen(true);
                }}
              />
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-900 shadow-xs">
                <h3 className="text-base font-black">Acesso Restrito ao Administrador</h3>
                <p className="mt-1 text-xs text-amber-700">
                  Operadores e usuários de Consulta não possuem acesso ao Dashboard executivo.
                </p>
                <button
                  onClick={() => setActivePage('dispatch')}
                  className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-orange-600 transition-all"
                >
                  Ir para Despachar Pedidos
                </button>
              </div>
            )
          )}

          {activePage === 'dispatch' && (
            <DispatchView
              orders={orders}
              stores={stores}
              motoboys={motoboys}
              rates={rates}
              isNewModalOpen={isNewDispatchModalOpen}
              onOpenNewModal={() => setIsNewDispatchModalOpen(true)}
              onCloseNewModal={() => setIsNewDispatchModalOpen(false)}
            />
          )}

          {activePage === 'cadastros-motoboys' && (
            <RegistrationsView
              initialTab="motoboys"
              tenantId={activeTenantId}
              motoboys={motoboys}
              stores={stores}
              rates={rates}
            />
          )}

          {activePage === 'cadastros-lojas' && (
            <RegistrationsView
              initialTab="lojas"
              tenantId={activeTenantId}
              motoboys={motoboys}
              stores={stores}
              rates={rates}
            />
          )}

          {activePage === 'cadastros-tarifas' && (
            <RegistrationsView
              initialTab="tarifas"
              tenantId={activeTenantId}
              motoboys={motoboys}
              stores={stores}
              rates={rates}
            />
          )}

          {activePage.startsWith('relatorios-') && (
            isAdmin ? (
              <>
                {activePage === 'relatorios-lojas' && (
                  <ReportsView
                    initialSubTab="lojas"
                    orders={orders}
                    stores={stores}
                    motoboys={motoboys}
                    shiftClosings={shiftClosings}
                  />
                )}

                {activePage === 'relatorios-motoboys' && (
                  <ReportsView
                    initialSubTab="motoboys"
                    orders={orders}
                    stores={stores}
                    motoboys={motoboys}
                    shiftClosings={shiftClosings}
                  />
                )}

                {activePage === 'relatorios-mensal' && (
                  <ReportsView
                    initialSubTab="mensal"
                    orders={orders}
                    stores={stores}
                    motoboys={motoboys}
                    shiftClosings={shiftClosings}
                  />
                )}

                {activePage === 'relatorios-ranking' && (
                  <ReportsView
                    initialSubTab="ranking"
                    orders={orders}
                    stores={stores}
                    motoboys={motoboys}
                    shiftClosings={shiftClosings}
                  />
                )}

                {activePage === 'relatorios-fechamentos' && (
                  <ReportsView
                    initialSubTab="fechamentos"
                    orders={orders}
                    stores={stores}
                    motoboys={motoboys}
                    shiftClosings={shiftClosings}
                  />
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-900 shadow-xs">
                <h3 className="text-base font-black">Acesso Restrito ao Administrador</h3>
                <p className="mt-1 text-xs text-amber-700">
                  Operadores e usuários de Consulta não possuem acesso aos Relatórios e demonstrativos.
                </p>
                <button
                  onClick={() => setActivePage('dispatch')}
                  className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-orange-600 transition-all"
                >
                  Ir para Despachar Pedidos
                </button>
              </div>
            )
          )}

          {activePage === 'empresa' && <CompanyView />}

          {activePage === 'usuarios' && (
            isAdmin ? (
              <UsersView />
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-amber-900 shadow-xs">
                <h3 className="text-base font-black">Acesso Restrito ao Administrador</h3>
                <p className="mt-1 text-xs text-amber-700">
                  Apenas administradores podem gerenciar usuários e definir permissões de acesso.
                </p>
                <button
                  onClick={() => setActivePage('dispatch')}
                  className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-orange-600 transition-all"
                >
                  Ir para Despachar Pedidos
                </button>
              </div>
            )
          )}

          {activePage === 'configuracoes' && <SettingsView />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
