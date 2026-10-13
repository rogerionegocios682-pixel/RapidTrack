/**
 * Database Services for Delivery OS (Herculano Gestor)
 * PostgreSQL (Cloud SQL) Relational Operations with Real-Time Polling Sync
 */

import type {
  Tenant,
  UserProfile,
  CompanySettings,
  Motoboy,
  DeliveryStore,
  NeighborhoodRate,
  DeliveryOrder,
  ShiftClosing,
  AuditLog,
  OrderStatus,
  AppNotification,
} from '../types';

// In-memory cache & listener store for real-time reactivity
type Listener<T> = (data: T) => void;

class RealtimeHub {
  private motoboyListeners = new Map<string, Set<Listener<Motoboy[]>>>();
  private storeListeners = new Map<string, Set<Listener<DeliveryStore[]>>>();
  private rateListeners = new Map<string, Set<Listener<NeighborhoodRate[]>>>();
  private orderListeners = new Map<string, Set<Listener<DeliveryOrder[]>>>();
  private closingListeners = new Map<string, Set<Listener<ShiftClosing[]>>>();
  private auditListeners = new Map<string, Set<Listener<AuditLog[]>>>();
  private notifListeners = new Map<string, Set<Listener<AppNotification[]>>>();

  // Cached states
  public motoboys = new Map<string, Motoboy[]>();
  public stores = new Map<string, DeliveryStore[]>();
  public rates = new Map<string, NeighborhoodRate[]>();
  public orders = new Map<string, DeliveryOrder[]>();
  public closings = new Map<string, ShiftClosing[]>();
  public audits = new Map<string, AuditLog[]>();
  public notifs = new Map<string, AppNotification[]>();

  private pollInterval: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.startPolling();
    }
  }

  private startPolling() {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(() => {
      this.refreshAllActiveTenants();
    }, 3000);
  }

  public register<T>(
    map: Map<string, Set<Listener<T>>>,
    tenantId: string,
    cb: Listener<T>,
    fetcher: () => Promise<void>
  ) {
    if (!map.has(tenantId)) {
      map.set(tenantId, new Set());
    }
    const set = map.get(tenantId)!;
    set.add(cb);
    fetcher();
    return () => {
      set.delete(cb);
    };
  }

  public emit<T>(map: Map<string, Set<Listener<T>>>, tenantId: string, data: T) {
    const set = map.get(tenantId);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error('Error in listener callback:', e);
        }
      });
    }
  }

  private async refreshAllActiveTenants() {
    const activeTenants = new Set<string>([
      ...this.motoboyListeners.keys(),
      ...this.storeListeners.keys(),
      ...this.rateListeners.keys(),
      ...this.orderListeners.keys(),
      ...this.closingListeners.keys(),
      ...this.auditListeners.keys(),
      ...this.notifListeners.keys(),
    ]);

    for (const tId of activeTenants) {
      if (this.orderListeners.get(tId)?.size) refreshOrders(tId).catch(() => {});
      if (this.notifListeners.get(tId)?.size) refreshNotifications(tId).catch(() => {});
      if (this.motoboyListeners.get(tId)?.size) refreshMotoboys(tId).catch(() => {});
      if (this.storeListeners.get(tId)?.size) refreshStores(tId).catch(() => {});
      if (this.rateListeners.get(tId)?.size) refreshRates(tId).catch(() => {});
      if (this.closingListeners.get(tId)?.size) refreshShiftClosings(tId).catch(() => {});
      if (this.auditListeners.get(tId)?.size) refreshAuditLogs(tId).catch(() => {});
    }
  }
}

export const hub = new RealtimeHub();

// ==========================================
// TENANT & COMPANY SETTINGS
// ==========================================

export async function getTenant(tenantId: string): Promise<Tenant | null> {
  try {
    const res = await fetch(`/api/tenants/${encodeURIComponent(tenantId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('getTenant error:', error);
    return null;
  }
}

export async function createTenant(tenantData: Tenant): Promise<void> {
  try {
    await fetch('/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tenantData),
    });
  } catch (error) {
    console.error('createTenant error:', error);
  }
}

export async function getCompanySettings(tenantId: string): Promise<CompanySettings | null> {
  try {
    const res = await fetch(`/api/company-settings/${encodeURIComponent(tenantId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('getCompanySettings error:', error);
    return null;
  }
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  try {
    await fetch('/api/company-settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  } catch (error) {
    console.error('saveCompanySettings error:', error);
  }
}

// ==========================================
// USER PROFILES
// ==========================================

export async function getUserProfile(uid: string, email?: string): Promise<UserProfile | null> {
  try {
    const url = email
      ? `/api/users/${encodeURIComponent(uid)}?email=${encodeURIComponent(email)}`
      : `/api/users/${encodeURIComponent(uid)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('getUserProfile error:', error);
    return null;
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  try {
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
  } catch (error) {
    console.error('saveUserProfile error:', error);
  }
}

export function listenTenantUsers(tenantId: string, callback: (users: UserProfile[]) => void) {
  getUserProfile(tenantId).then((user) => {
    if (user) callback([user]);
    else callback([]);
  });
  return () => {};
}

// ==========================================
// MOTOBOYS
// ==========================================

export async function refreshMotoboys(tenantId: string): Promise<Motoboy[]> {
  try {
    const res = await fetch(`/api/motoboys?tenantId=${encodeURIComponent(tenantId)}`);
    if (!res.ok) return hub.motoboys.get(tenantId) || [];
    const data: Motoboy[] = await res.json();
    data.sort((a, b) => a.name.localeCompare(b.name));
    hub.motoboys.set(tenantId, data);
    hub.emit((hub as any).motoboyListeners, tenantId, data);
    return data;
  } catch (error) {
    return hub.motoboys.get(tenantId) || [];
  }
}

export function listenMotoboys(tenantId: string, callback: (motoboys: Motoboy[]) => void) {
  const cached = hub.motoboys.get(tenantId);
  if (cached) callback(cached);
  return hub.register((hub as any).motoboyListeners, tenantId, callback, () => refreshMotoboys(tenantId).then(callback));
}

export async function createMotoboy(motoboy: Motoboy): Promise<void> {
  const current = hub.motoboys.get(motoboy.tenantId) || [];
  if (current.some((m) => m.cpf === motoboy.cpf)) {
    throw new Error('Já existe um motoboy cadastrado com este CPF nesta empresa.');
  }

  await fetch('/api/motoboys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(motoboy),
  });
  await refreshMotoboys(motoboy.tenantId);
}

export async function updateMotoboy(id: string, data: Partial<Motoboy>): Promise<void> {
  let tenantId = data.tenantId;
  if (!tenantId) {
    for (const [tId, list] of hub.motoboys.entries()) {
      const found = list.find((m) => m.id === id);
      if (found) {
        tenantId = tId;
        break;
      }
    }
  }

  const existing = hub.motoboys.get(tenantId || '')?.find((m) => m.id === id);
  const updated = { ...(existing || {}), ...data, id } as Motoboy;

  await fetch('/api/motoboys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated),
  });
  if (tenantId) await refreshMotoboys(tenantId);
}

// ==========================================
// DELIVERY STORES
// ==========================================

export async function refreshStores(tenantId: string): Promise<DeliveryStore[]> {
  try {
    const res = await fetch(`/api/stores?tenantId=${encodeURIComponent(tenantId)}`);
    if (!res.ok) return hub.stores.get(tenantId) || [];
    const data: DeliveryStore[] = await res.json();
    data.sort((a, b) => a.name.localeCompare(b.name));
    hub.stores.set(tenantId, data);
    hub.emit((hub as any).storeListeners, tenantId, data);
    return data;
  } catch (error) {
    return hub.stores.get(tenantId) || [];
  }
}

export function listenStores(tenantId: string, callback: (stores: DeliveryStore[]) => void) {
  const cached = hub.stores.get(tenantId);
  if (cached) callback(cached);
  return hub.register((hub as any).storeListeners, tenantId, callback, () => refreshStores(tenantId).then(callback));
}

export async function createStore(store: DeliveryStore): Promise<void> {
  const current = hub.stores.get(store.tenantId) || [];
  if (current.length >= 10) {
    throw new Error('Limite atingido: O plano inicial permite no máximo 10 empresas de entrega/lojas cadastradas.');
  }

  await fetch('/api/stores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(store),
  });
  await refreshStores(store.tenantId);
}

export async function updateStore(id: string, data: Partial<DeliveryStore>): Promise<void> {
  let tenantId = data.tenantId;
  if (!tenantId) {
    for (const [tId, list] of hub.stores.entries()) {
      const found = list.find((s) => s.id === id);
      if (found) {
        tenantId = tId;
        break;
      }
    }
  }

  const existing = hub.stores.get(tenantId || '')?.find((s) => s.id === id);
  const updated = { ...(existing || {}), ...data, id } as DeliveryStore;

  await fetch('/api/stores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated),
  });
  if (tenantId) await refreshStores(tenantId);
}

// ==========================================
// NEIGHBORHOOD RATES
// ==========================================

export async function refreshRates(tenantId: string): Promise<NeighborhoodRate[]> {
  try {
    const res = await fetch(`/api/rates?tenantId=${encodeURIComponent(tenantId)}`);
    if (!res.ok) return hub.rates.get(tenantId) || [];
    const data: NeighborhoodRate[] = await res.json();
    data.sort((a, b) => a.neighborhood.localeCompare(b.neighborhood));
    hub.rates.set(tenantId, data);
    hub.emit((hub as any).rateListeners, tenantId, data);
    return data;
  } catch (error) {
    return hub.rates.get(tenantId) || [];
  }
}

export function listenRates(tenantId: string, callback: (rates: NeighborhoodRate[]) => void) {
  const cached = hub.rates.get(tenantId);
  if (cached) callback(cached);
  return hub.register((hub as any).rateListeners, tenantId, callback, () => refreshRates(tenantId).then(callback));
}

export async function createRate(rate: NeighborhoodRate): Promise<void> {
  await fetch('/api/rates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rate),
  });
  await refreshRates(rate.tenantId);
}

export async function updateRate(id: string, data: Partial<NeighborhoodRate>): Promise<void> {
  let tenantId = data.tenantId;
  if (!tenantId) {
    for (const [tId, list] of hub.rates.entries()) {
      const found = list.find((r) => r.id === id);
      if (found) {
        tenantId = tId;
        break;
      }
    }
  }

  const existing = hub.rates.get(tenantId || '')?.find((r) => r.id === id);
  const updated = { ...(existing || {}), ...data, id } as NeighborhoodRate;

  await fetch('/api/rates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated),
  });
  if (tenantId) await refreshRates(tenantId);
}

// ==========================================
// DELIVERY ORDERS
// ==========================================

export async function refreshOrders(tenantId: string): Promise<DeliveryOrder[]> {
  try {
    const res = await fetch(`/api/orders?tenantId=${encodeURIComponent(tenantId)}`);
    if (!res.ok) return hub.orders.get(tenantId) || [];
    const data: DeliveryOrder[] = await res.json();
    data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    hub.orders.set(tenantId, data);
    hub.emit((hub as any).orderListeners, tenantId, data);
    return data;
  } catch (error) {
    return hub.orders.get(tenantId) || [];
  }
}

export function listenOrders(tenantId: string, callback: (orders: DeliveryOrder[]) => void) {
  const cached = hub.orders.get(tenantId);
  if (cached) callback(cached);
  return hub.register((hub as any).orderListeners, tenantId, callback, () => refreshOrders(tenantId).then(callback));
}

export async function checkOrderDuplication(
  tenantId: string,
  orderNumber: string,
  storeId: string,
  operationalDate: string
): Promise<DeliveryOrder | null> {
  const list = hub.orders.get(tenantId) || (await refreshOrders(tenantId));
  const cleanNum = orderNumber.trim().toLowerCase();
  const found = list.find(
    (o) =>
      o.tenantId === tenantId &&
      o.orderNumber.trim().toLowerCase() === cleanNum &&
      o.storeId === storeId &&
      o.operationalDate === operationalDate
  );
  return found || null;
}

export async function createOrder(order: DeliveryOrder): Promise<void> {
  await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  });

  // Create real-time notification
  const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await createNotification({
    id: notifId,
    tenantId: order.tenantId,
    title: `Nova Corrida: Pedido ${order.orderNumber}`,
    body: `${order.storeName} → ${order.neighborhood} | Motoboy: ${order.motoboyName}`,
    type: 'new_order',
    orderId: order.id,
    orderNumber: order.orderNumber,
    targetRole: 'all',
    targetMotoboyId: order.motoboyId,
    targetMotoboyName: order.motoboyName,
    read: false,
    timestamp: new Date().toISOString(),
  });

  await refreshOrders(order.tenantId);
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  details: {
    userName: string;
    userId: string;
    reason?: string;
    notes?: string;
  }
): Promise<void> {
  let tenantId = '';
  let currentOrder: DeliveryOrder | undefined;

  for (const [tId, list] of hub.orders.entries()) {
    const found = list.find((o) => o.id === orderId);
    if (found) {
      tenantId = tId;
      currentOrder = found;
      break;
    }
  }

  const now = new Date().toISOString();
  const updatePayload: Partial<DeliveryOrder> = {
    status,
    updatedAt: now,
  };

  if (status === 'completed') {
    updatePayload.completionTime = now;
    updatePayload.completedBy = details.userId;
    updatePayload.completedByName = details.userName;
  } else if (status === 'canceled') {
    updatePayload.cancellationTime = now;
    updatePayload.cancellationReason = details.reason || 'Cancelado pelo operador';
    updatePayload.canceledBy = details.userId;
    updatePayload.canceledByName = details.userName;
  } else if (status === 'client_not_found') {
    updatePayload.clientNotFoundTime = now;
    updatePayload.clientNotFoundNotes = details.notes || 'Cliente não atendeu / não localizado';
    updatePayload.clientNotFoundBy = details.userName;
  }

  const merged = { ...(currentOrder || {}), ...updatePayload, id: orderId } as DeliveryOrder;

  await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(merged),
  });

  if (currentOrder) {
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let notifTitle = `Pedido Atualizado`;
    let notifBody = `${currentOrder.storeName} - Pedido ${currentOrder.orderNumber}`;
    let notifType: 'new_order' | 'pending_delay' | 'order_completed' | 'order_canceled' | 'shift_closed' = 'order_completed';

    if (status === 'completed') {
      notifTitle = `Entrega Concluída: Pedido ${currentOrder.orderNumber}`;
      notifBody = `Confirmada por ${details.userName}. Motoboy: ${currentOrder.motoboyName}`;
      notifType = 'order_completed';
    } else if (status === 'canceled') {
      notifTitle = `Corrida Cancelada: Pedido ${currentOrder.orderNumber}`;
      notifBody = `Motivo: ${details.reason || 'Cancelado pelo operador'}`;
      notifType = 'order_canceled';
    } else if (status === 'client_not_found') {
      notifTitle = `Alerta de Ocorrência: Pedido ${currentOrder.orderNumber}`;
      notifBody = `Cliente não encontrado: ${details.notes || 'Sem contato'}`;
      notifType = 'pending_delay';
    }

    await createNotification({
      id: notifId,
      tenantId: currentOrder.tenantId,
      title: notifTitle,
      body: notifBody,
      type: notifType,
      orderId: currentOrder.id,
      orderNumber: currentOrder.orderNumber,
      targetRole: 'all',
      targetMotoboyId: currentOrder.motoboyId,
      targetMotoboyName: currentOrder.motoboyName,
      read: false,
      timestamp: now,
    });
  }

  if (tenantId) await refreshOrders(tenantId);
}

export async function adjustOrderRate(
  order: DeliveryOrder,
  newRate: number,
  reason: string,
  userId: string,
  userName: string
): Promise<void> {
  const now = new Date().toISOString();
  const historyItem = {
    originalRate: order.rate,
    newRate,
    adjustedBy: userId,
    adjustedByName: userName,
    reason,
    adjustedAt: now,
  };

  const updatedHistory = order.rateHistory ? [...order.rateHistory, historyItem] : [historyItem];

  const updatedOrder: DeliveryOrder = {
    ...order,
    rate: newRate,
    originalRate: order.originalRate ?? order.rate,
    manualRateAdjusted: true,
    adjustmentReason: reason,
    rateHistory: updatedHistory,
    updatedAt: now,
  };

  await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedOrder),
  });

  await refreshOrders(order.tenantId);
}

// ==========================================
// SHIFT CLOSINGS
// ==========================================

export async function refreshShiftClosings(tenantId: string): Promise<ShiftClosing[]> {
  try {
    const res = await fetch(`/api/shift-closings?tenantId=${encodeURIComponent(tenantId)}`);
    if (!res.ok) return hub.closings.get(tenantId) || [];
    const data: ShiftClosing[] = await res.json();
    data.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
    hub.closings.set(tenantId, data);
    hub.emit((hub as any).closingListeners, tenantId, data);
    return data;
  } catch (error) {
    return hub.closings.get(tenantId) || [];
  }
}

export function listenShiftClosings(tenantId: string, callback: (closings: ShiftClosing[]) => void) {
  const cached = hub.closings.get(tenantId);
  if (cached) callback(cached);
  return hub.register((hub as any).closingListeners, tenantId, callback, () => refreshShiftClosings(tenantId).then(callback));
}

export async function executeShiftClosing(
  closing: ShiftClosing,
  orderIdsToLock: string[]
): Promise<void> {
  await fetch('/api/shift-closings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(closing),
  });

  // Lock orders
  const currentOrders = hub.orders.get(closing.tenantId) || [];
  for (const ord of currentOrders) {
    if (orderIdsToLock.includes(ord.id)) {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...ord,
          shiftClosingId: closing.id,
          updatedAt: new Date().toISOString(),
        }),
      });
    }
  }

  await refreshShiftClosings(closing.tenantId);
  await refreshOrders(closing.tenantId);
}

// ==========================================
// AUDIT LOGS
// ==========================================

export async function refreshAuditLogs(tenantId: string): Promise<AuditLog[]> {
  try {
    const res = await fetch(`/api/audit-logs?tenantId=${encodeURIComponent(tenantId)}`);
    if (!res.ok) return hub.audits.get(tenantId) || [];
    const data: AuditLog[] = await res.json();
    data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    hub.audits.set(tenantId, data);
    hub.emit((hub as any).auditListeners, tenantId, data);
    return data;
  } catch (error) {
    return hub.audits.get(tenantId) || [];
  }
}

export function listenAuditLogs(tenantId: string, callback: (logs: AuditLog[]) => void) {
  const cached = hub.audits.get(tenantId);
  if (cached) callback(cached);
  return hub.register((hub as any).auditListeners, tenantId, callback, () => refreshAuditLogs(tenantId).then(callback));
}

export async function createAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
  const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const fullLog: AuditLog = {
    ...log,
    id,
    timestamp: new Date().toISOString(),
  };

  try {
    await fetch('/api/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullLog),
    });
    await refreshAuditLogs(log.tenantId);
  } catch (error) {
    console.error('Audit log write error:', error);
  }
}

// ==========================================
// NOTIFICATIONS
// ==========================================

export async function refreshNotifications(tenantId: string): Promise<AppNotification[]> {
  try {
    const res = await fetch(`/api/notifications?tenantId=${encodeURIComponent(tenantId)}`);
    if (!res.ok) return hub.notifs.get(tenantId) || [];
    const data: AppNotification[] = await res.json();
    data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    hub.notifs.set(tenantId, data);
    hub.emit((hub as any).notifListeners, tenantId, data);
    return data;
  } catch (error) {
    return hub.notifs.get(tenantId) || [];
  }
}

export function listenNotifications(tenantId: string, callback: (notifications: AppNotification[]) => void) {
  const cached = hub.notifs.get(tenantId);
  if (cached) callback(cached);
  return hub.register((hub as any).notifListeners, tenantId, callback, () => refreshNotifications(tenantId).then(callback));
}

export async function createNotification(notification: AppNotification): Promise<void> {
  try {
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification),
    });
    await refreshNotifications(notification.tenantId);
  } catch (error) {
    console.error('Notification write error:', error);
  }
}

export async function markNotificationAsRead(id: string): Promise<void> {
  try {
    await fetch(`/api/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read: true }),
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

export async function markAllNotificationsAsRead(notificationIds: string[]): Promise<void> {
  try {
    for (const [tenantId, list] of hub.notifs.entries()) {
      if (list.some((n) => notificationIds.includes(n.id))) {
        await fetch('/api/notifications/mark-all-read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId }),
        });
        await refreshNotifications(tenantId);
        break;
      }
    }
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
}

// ==========================================
// SEED INITIAL DEMO DATA
// ==========================================

export async function seedDemoDataIfEmpty(tenantId: string, companyName: string): Promise<boolean> {
  try {
    const res = await fetch('/api/seed-demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantId, tradeName: companyName }),
    });
    if (res.ok) {
      await refreshStores(tenantId);
      await refreshMotoboys(tenantId);
      await refreshRates(tenantId);
      await refreshOrders(tenantId);
      await refreshNotifications(tenantId);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error seeding demo data:', error);
    return false;
  }
}
