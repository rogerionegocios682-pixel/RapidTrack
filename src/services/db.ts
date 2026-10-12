/**
 * Database Services for Delivery OS (Herculano Gestor)
 * Multi-tenant Firestore Operations
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
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
  MotoboyShiftSummary,
  AppNotification,
} from '../types';

// ==========================================
// TENANT & COMPANY SETTINGS
// ==========================================

export async function getTenant(tenantId: string): Promise<Tenant | null> {
  const path = `tenants/${tenantId}`;
  try {
    const snap = await getDoc(doc(db, 'tenants', tenantId));
    if (!snap.exists()) return null;
    return snap.data() as Tenant;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function createTenant(tenantData: Tenant): Promise<void> {
  const path = `tenants/${tenantData.id}`;
  try {
    await setDoc(doc(db, 'tenants', tenantData.id), tenantData);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function getCompanySettings(tenantId: string): Promise<CompanySettings | null> {
  const path = `settings/${tenantId}`;
  try {
    const snap = await getDoc(doc(db, 'settings', tenantId));
    if (!snap.exists()) return null;
    return snap.data() as CompanySettings;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveCompanySettings(settings: CompanySettings): Promise<void> {
  const path = `settings/${settings.tenantId}`;
  try {
    await setDoc(doc(db, 'settings', settings.tenantId), {
      ...settings,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ==========================================
// USER PROFILES
// ==========================================

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return snap.data() as UserProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  const path = `users/${profile.uid}`;
  try {
    await setDoc(doc(db, 'users', profile.uid), profile, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function listenTenantUsers(tenantId: string, callback: (users: UserProfile[]) => void) {
  const q = query(collection(db, 'users'), where('tenantId', '==', tenantId));
  return onSnapshot(
    q,
    (snap) => {
      const users: UserProfile[] = [];
      snap.forEach((d) => users.push(d.data() as UserProfile));
      callback(users);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    }
  );
}

// ==========================================
// MOTOBOYS
// ==========================================

export function listenMotoboys(tenantId: string, callback: (motoboys: Motoboy[]) => void) {
  const q = query(collection(db, 'motoboys'), where('tenantId', '==', tenantId));
  return onSnapshot(
    q,
    (snap) => {
      const items: Motoboy[] = [];
      snap.forEach((d) => items.push(d.data() as Motoboy));
      // Sort alphabetically by name
      items.sort((a, b) => a.name.localeCompare(b.name));
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'motoboys');
    }
  );
}

export async function createMotoboy(motoboy: Motoboy): Promise<void> {
  // Check for duplicate CPF within tenant
  const q = query(
    collection(db, 'motoboys'),
    where('tenantId', '==', motoboy.tenantId),
    where('cpf', '==', motoboy.cpf)
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    throw new Error('Já existe um motoboy cadastrado com este CPF nesta empresa.');
  }

  const path = `motoboys/${motoboy.id}`;
  try {
    await setDoc(doc(db, 'motoboys', motoboy.id), motoboy);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateMotoboy(id: string, data: Partial<Motoboy>): Promise<void> {
  const path = `motoboys/${id}`;
  try {
    await updateDoc(doc(db, 'motoboys', id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ==========================================
// DELIVERY STORES (LOJAS DE ORIGEM)
// ==========================================

export function listenStores(tenantId: string, callback: (stores: DeliveryStore[]) => void) {
  const q = query(collection(db, 'stores'), where('tenantId', '==', tenantId));
  return onSnapshot(
    q,
    (snap) => {
      const items: DeliveryStore[] = [];
      snap.forEach((d) => items.push(d.data() as DeliveryStore));
      items.sort((a, b) => a.name.localeCompare(b.name));
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'stores');
    }
  );
}

export async function createStore(store: DeliveryStore): Promise<void> {
  // Enforce 10-store maximum on database service level
  const q = query(collection(db, 'stores'), where('tenantId', '==', store.tenantId));
  const snap = await getDocs(q);
  if (snap.size >= 10) {
    throw new Error('Limite atingido: O plano inicial permite no máximo 10 empresas de entrega/lojas cadastradas.');
  }

  const path = `stores/${store.id}`;
  try {
    await setDoc(doc(db, 'stores', store.id), store);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateStore(id: string, data: Partial<DeliveryStore>): Promise<void> {
  const path = `stores/${id}`;
  try {
    await updateDoc(doc(db, 'stores', id), data);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ==========================================
// NEIGHBORHOOD RATES (BAIRROS & TARIFAS)
// ==========================================

export function listenRates(tenantId: string, callback: (rates: NeighborhoodRate[]) => void) {
  const q = query(collection(db, 'rates'), where('tenantId', '==', tenantId));
  return onSnapshot(
    q,
    (snap) => {
      const items: NeighborhoodRate[] = [];
      snap.forEach((d) => items.push(d.data() as NeighborhoodRate));
      items.sort((a, b) => a.neighborhood.localeCompare(b.neighborhood));
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'rates');
    }
  );
}

export async function createRate(rate: NeighborhoodRate): Promise<void> {
  const path = `rates/${rate.id}`;
  try {
    await setDoc(doc(db, 'rates', rate.id), rate);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateRate(id: string, data: Partial<NeighborhoodRate>): Promise<void> {
  const path = `rates/${id}`;
  try {
    await updateDoc(doc(db, 'rates', id), {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ==========================================
// DELIVERY ORDERS (CORRIDAS / DESPACHO)
// ==========================================

export function listenOrders(tenantId: string, callback: (orders: DeliveryOrder[]) => void) {
  const q = query(collection(db, 'orders'), where('tenantId', '==', tenantId));
  return onSnapshot(
    q,
    (snap) => {
      const items: DeliveryOrder[] = [];
      snap.forEach((d) => items.push(d.data() as DeliveryOrder));
      // Sort newest first by createdAt
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    }
  );
}

export async function checkOrderDuplication(
  tenantId: string,
  orderNumber: string,
  storeId: string,
  operationalDate: string
): Promise<DeliveryOrder | null> {
  try {
    const q = query(
      collection(db, 'orders'),
      where('tenantId', '==', tenantId),
      where('orderNumber', '==', orderNumber.trim()),
      where('storeId', '==', storeId),
      where('operationalDate', '==', operationalDate)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as DeliveryOrder;
  } catch (error) {
    console.error('Duplication check error:', error);
    return null;
  }
}

export async function createOrder(order: DeliveryOrder): Promise<void> {
  const path = `orders/${order.id}`;
  try {
    await setDoc(doc(db, 'orders', order.id), order);

    // Create real-time notification
    const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await setDoc(doc(db, 'notifications', notifId), {
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
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
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
  const path = `orders/${orderId}`;
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

  try {
    await updateDoc(doc(db, 'orders', orderId), updatePayload);

    // Emit notification for status change
    const snap = await getDoc(doc(db, 'orders', orderId));
    if (snap.exists()) {
      const ordData = snap.data() as DeliveryOrder;
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      let notifTitle = `Pedido Atualizado`;
      let notifBody = `${ordData.storeName} - Pedido ${ordData.orderNumber}`;
      let notifType: 'new_order' | 'pending_delay' | 'order_completed' | 'order_canceled' | 'shift_closed' = 'order_completed';

      if (status === 'completed') {
        notifTitle = `Entrega Concluída: Pedido ${ordData.orderNumber}`;
        notifBody = `Confirmada por ${details.userName}. Motoboy: ${ordData.motoboyName}`;
        notifType = 'order_completed';
      } else if (status === 'canceled') {
        notifTitle = `Corrida Cancelada: Pedido ${ordData.orderNumber}`;
        notifBody = `Motivo: ${details.reason || 'Cancelado pelo operador'}`;
        notifType = 'order_canceled';
      } else if (status === 'client_not_found') {
        notifTitle = `Alerta de Ocorrência: Pedido ${ordData.orderNumber}`;
        notifBody = `Cliente não encontrado: ${details.notes || 'Sem contato'}`;
        notifType = 'pending_delay';
      }

      await setDoc(doc(db, 'notifications', notifId), {
        id: notifId,
        tenantId: ordData.tenantId,
        title: notifTitle,
        body: notifBody,
        type: notifType,
        orderId: ordData.id,
        orderNumber: ordData.orderNumber,
        targetRole: 'all',
        targetMotoboyId: ordData.motoboyId,
        targetMotoboyName: ordData.motoboyName,
        read: false,
        timestamp: now,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adjustOrderRate(
  order: DeliveryOrder,
  newRate: number,
  reason: string,
  userId: string,
  userName: string
): Promise<void> {
  const path = `orders/${order.id}`;
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

  try {
    await updateDoc(doc(db, 'orders', order.id), {
      rate: newRate,
      originalRate: order.originalRate ?? order.rate,
      manualRateAdjusted: true,
      adjustmentReason: reason,
      rateHistory: updatedHistory,
      updatedAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ==========================================
// SHIFT CLOSING (FECHAMENTO DE TURNO)
// ==========================================

export function listenShiftClosings(tenantId: string, callback: (closings: ShiftClosing[]) => void) {
  const q = query(collection(db, 'shift_closings'), where('tenantId', '==', tenantId));
  return onSnapshot(
    q,
    (snap) => {
      const items: ShiftClosing[] = [];
      snap.forEach((d) => items.push(d.data() as ShiftClosing));
      items.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shift_closings');
    }
  );
}

export async function executeShiftClosing(
  closing: ShiftClosing,
  orderIdsToLock: string[]
): Promise<void> {
  const path = `shift_closings/${closing.id}`;
  try {
    // 1. Create shift closing record
    await setDoc(doc(db, 'shift_closings', closing.id), closing);

    // 2. Lock orders by setting shiftClosingId
    for (const orderId of orderIdsToLock) {
      await updateDoc(doc(db, 'orders', orderId), {
        shiftClosingId: closing.id,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// ==========================================
// AUDIT LOGS
// ==========================================

export function listenAuditLogs(tenantId: string, callback: (logs: AuditLog[]) => void) {
  const q = query(collection(db, 'audit_logs'), where('tenantId', '==', tenantId));
  return onSnapshot(
    q,
    (snap) => {
      const items: AuditLog[] = [];
      snap.forEach((d) => items.push(d.data() as AuditLog));
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'audit_logs');
    }
  );
}

export async function createAuditLog(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
  const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const fullLog: AuditLog = {
    ...log,
    id,
    timestamp: new Date().toISOString(),
  };
  const path = `audit_logs/${id}`;
  try {
    await setDoc(doc(db, 'audit_logs', id), fullLog);
  } catch (error) {
    console.error('Audit log write error:', error);
  }
}

// ==========================================
// NOTIFICATIONS (PUSH & IN-APP)
// ==========================================

export function listenNotifications(tenantId: string, callback: (notifications: AppNotification[]) => void) {
  const q = query(collection(db, 'notifications'), where('tenantId', '==', tenantId));
  return onSnapshot(
    q,
    (snap) => {
      const items: AppNotification[] = [];
      snap.forEach((d) => items.push(d.data() as AppNotification));
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    }
  );
}

export async function createNotification(notification: AppNotification): Promise<void> {
  const path = `notifications/${notification.id}`;
  try {
    await setDoc(doc(db, 'notifications', notification.id), notification);
  } catch (error) {
    console.error('Notification write error:', error);
  }
}

export async function markNotificationAsRead(id: string): Promise<void> {
  const path = `notifications/${id}`;
  try {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
  }
}

export async function markAllNotificationsAsRead(notificationIds: string[]): Promise<void> {
  try {
    for (const id of notificationIds) {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    }
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
  }
}

// ==========================================
// SEED INITIAL DEMO DATA (OPTIONAL BOOTSTRAP)
// ==========================================

export async function seedDemoDataIfEmpty(tenantId: string, companyName: string): Promise<boolean> {
  try {
    const storesSnap = await getDocs(query(collection(db, 'stores'), where('tenantId', '==', tenantId)));
    if (!storesSnap.empty) return false;

    // Seed 2 Stores
    const store1: DeliveryStore = {
      id: `store_${Date.now()}_1`,
      tenantId,
      name: 'iFood Loja Central',
      code: 'IFD-01',
      cnpj: '12.345.678/0001-90',
      phone: '(81) 98765-4321',
      active: true,
      notes: 'Loja matriz integrada com iFood',
      createdAt: new Date().toISOString(),
    };
    const store2: DeliveryStore = {
      id: `store_${Date.now()}_2`,
      tenantId,
      name: 'Hamburgueria Artesanal',
      code: 'HBG-02',
      cnpj: '98.765.432/0001-10',
      phone: '(81) 99123-4567',
      active: true,
      notes: 'Pedidos diretos e WhatsApp',
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'stores', store1.id), store1);
    await setDoc(doc(db, 'stores', store2.id), store2);

    // Seed 3 Motoboys
    const motoboy1: Motoboy = {
      id: `mb_${Date.now()}_1`,
      tenantId,
      name: 'Carlos Eduardo Oliveira',
      cpf: '123.456.789-01',
      phone: '(81) 99876-1122',
      active: true,
      notes: 'Moto Honda Fan 160 - Noturno',
      createdAt: new Date().toISOString(),
    };
    const motoboy2: Motoboy = {
      id: `mb_${Date.now()}_2`,
      tenantId,
      name: 'Lucas Gabriel Silva',
      cpf: '234.567.890-12',
      phone: '(81) 98765-2233',
      active: true,
      notes: 'Moto Yamaha Fazer 250 - Diurno',
      createdAt: new Date().toISOString(),
    };
    const motoboy3: Motoboy = {
      id: `mb_${Date.now()}_3`,
      tenantId,
      name: 'Matheus Henrique Santos',
      cpf: '345.678.901-23',
      phone: '(81) 97654-3344',
      active: true,
      notes: 'Moto Honda Titan 160 - Integral',
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'motoboys', motoboy1.id), motoboy1);
    await setDoc(doc(db, 'motoboys', motoboy2.id), motoboy2);
    await setDoc(doc(db, 'motoboys', motoboy3.id), motoboy3);

    // Seed Neighborhood Rates for Store 1
    const neighborhoodsStore1 = [
      { name: 'Centro', rate: 10.0 },
      { name: 'Boa Viagem', rate: 14.0 },
      { name: 'Pina', rate: 12.0 },
      { name: 'Casa Forte', rate: 16.0 },
      { name: 'Madalena', rate: 11.5 },
    ];
    for (const item of neighborhoodsStore1) {
      const rateId = `rate_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await setDoc(doc(db, 'rates', rateId), {
        id: rateId,
        tenantId,
        storeId: store1.id,
        storeName: store1.name,
        neighborhood: item.name,
        rate: item.rate,
        active: true,
        notes: 'Tarifa padrão',
        updatedAt: new Date().toISOString(),
      });
    }

    // Seed Neighborhood Rates for Store 2
    const neighborhoodsStore2 = [
      { name: 'Centro', rate: 9.0 },
      { name: 'Boa Viagem', rate: 13.0 },
      { name: 'Pina', rate: 11.0 },
      { name: 'Candeias', rate: 18.0 },
    ];
    for (const item of neighborhoodsStore2) {
      const rateId = `rate_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await setDoc(doc(db, 'rates', rateId), {
        id: rateId,
        tenantId,
        storeId: store2.id,
        storeName: store2.name,
        neighborhood: item.name,
        rate: item.rate,
        active: true,
        notes: 'Tarifa promocional',
        updatedAt: new Date().toISOString(),
      });
    }

    // Seed initial orders for today
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const sampleOrders: DeliveryOrder[] = [
      {
        id: `ord_${Date.now()}_1`,
        tenantId,
        orderNumber: '#1041',
        dispatchTime: '11:30',
        operationalDate: todayStr,
        shiftName: 'Almoço / Tarde',
        storeId: store1.id,
        storeName: store1.name,
        clientName: 'Mariana Costa',
        clientPhone: '(81) 98822-1133',
        address: 'Rua das Flores, 142, Apto 302',
        neighborhood: 'Centro',
        rate: 10.0,
        motoboyId: motoboy1.id,
        motoboyName: motoboy1.name,
        status: 'completed',
        completionTime: new Date(Date.now() - 3600000).toISOString(),
        completedByName: 'Operador Sistema',
        createdAt: new Date(Date.now() - 4200000).toISOString(),
        updatedAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: `ord_${Date.now()}_2`,
        tenantId,
        orderNumber: '#1042',
        dispatchTime: '12:05',
        operationalDate: todayStr,
        shiftName: 'Almoço / Tarde',
        storeId: store1.id,
        storeName: store1.name,
        clientName: 'Fernando Alencar',
        clientPhone: '(81) 99112-4455',
        address: 'Av. Boa Viagem, 2400',
        neighborhood: 'Boa Viagem',
        rate: 14.0,
        motoboyId: motoboy2.id,
        motoboyName: motoboy2.name,
        status: 'completed',
        completionTime: new Date(Date.now() - 2400000).toISOString(),
        completedByName: 'Operador Sistema',
        createdAt: new Date(Date.now() - 3000000).toISOString(),
        updatedAt: new Date(Date.now() - 2400000).toISOString(),
      },
      {
        id: `ord_${Date.now()}_3`,
        tenantId,
        orderNumber: '#1043',
        dispatchTime: '12:40',
        operationalDate: todayStr,
        shiftName: 'Almoço / Tarde',
        storeId: store2.id,
        storeName: store2.name,
        clientName: 'Juliana Paes',
        clientPhone: '(81) 97788-9900',
        address: 'Rua do Sol, 88',
        neighborhood: 'Centro',
        rate: 9.0,
        motoboyId: motoboy1.id,
        motoboyName: motoboy1.name,
        status: 'completed',
        completionTime: new Date(Date.now() - 1200000).toISOString(),
        completedByName: 'Operador Sistema',
        createdAt: new Date(Date.now() - 1800000).toISOString(),
        updatedAt: new Date(Date.now() - 1200000).toISOString(),
      },
      {
        id: `ord_${Date.now()}_4`,
        tenantId,
        orderNumber: '#1044',
        dispatchTime: '13:15',
        operationalDate: todayStr,
        shiftName: 'Almoço / Tarde',
        storeId: store1.id,
        storeName: store1.name,
        clientName: 'Roberto Dias',
        clientPhone: '(81) 99443-2211',
        address: 'Rua Domingos Ferreira, 810',
        neighborhood: 'Boa Viagem',
        rate: 14.0,
        motoboyId: motoboy3.id,
        motoboyName: motoboy3.name,
        status: 'pending',
        createdAt: new Date(Date.now() - 600000).toISOString(),
        updatedAt: new Date(Date.now() - 600000).toISOString(),
      },
    ];

    for (const ord of sampleOrders) {
      await setDoc(doc(db, 'orders', ord.id), ord);
    }

    return true;
  } catch (error) {
    console.error('Error seeding demo data:', error);
    return false;
  }
}
