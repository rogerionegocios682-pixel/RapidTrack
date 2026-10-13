import { eq, desc, and } from 'drizzle-orm';
import { db } from './index.ts';
import {
  tenants,
  users,
  companySettings,
  motoboys,
  deliveryStores,
  neighborhoodRates,
  deliveryOrders,
  shiftClosings,
  auditLogs,
  appNotifications,
} from './schema.ts';
import type {
  Tenant,
  UserProfile,
  CompanySettings as CompanySettingsType,
  Motoboy,
  DeliveryStore,
  NeighborhoodRate,
  DeliveryOrder,
  ShiftClosing,
  AuditLog,
  AppNotification,
} from '../types/index.ts';

// ==========================================
// TENANTS
// ==========================================

export async function getTenantById(tenantId: string): Promise<Tenant | null> {
  try {
    const res = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    if (!res.length) return null;
    const t = res[0];
    return {
      id: t.id,
      name: t.name,
      tradeName: t.tradeName,
      cnpj: t.cnpj || undefined,
      email: t.email,
      phone: t.phone || undefined,
      maxStores: t.maxStores,
      createdAt: t.createdAt,
    };
  } catch (error) {
    console.error('getTenantById failed:', error);
    throw new Error('Falha ao consultar empresa/tenant.', { cause: error });
  }
}

export async function upsertTenant(tenantData: Tenant): Promise<Tenant> {
  try {
    await db
      .insert(tenants)
      .values({
        id: tenantData.id,
        name: tenantData.name,
        tradeName: tenantData.tradeName,
        cnpj: tenantData.cnpj || null,
        email: tenantData.email,
        phone: tenantData.phone || null,
        maxStores: tenantData.maxStores || 50,
        createdAt: tenantData.createdAt || new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: tenants.id,
        set: {
          name: tenantData.name,
          tradeName: tenantData.tradeName,
          cnpj: tenantData.cnpj || null,
          email: tenantData.email,
          phone: tenantData.phone || null,
          maxStores: tenantData.maxStores || 50,
        },
      });
    return tenantData;
  } catch (error) {
    console.error('upsertTenant failed:', error);
    throw new Error('Falha ao salvar dados da empresa.', { cause: error });
  }
}

// ==========================================
// USERS
// ==========================================

export async function getUserByUid(uid: string): Promise<UserProfile | null> {
  try {
    const res = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (!res.length) return null;
    const u = res[0];
    return {
      uid: u.uid,
      tenantId: u.tenantId,
      email: u.email,
      name: u.name,
      role: u.role as any,
      active: u.active,
      createdAt: u.createdAt,
    };
  } catch (error) {
    console.error('getUserByUid failed:', error);
    throw new Error('Falha ao consultar perfil de usuário.', { cause: error });
  }
}

export async function getUserByEmail(email: string): Promise<(UserProfile & { password?: string | null }) | null> {
  try {
    const res = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase())).limit(1);
    if (!res.length) return null;
    const u = res[0];
    return {
      uid: u.uid,
      tenantId: u.tenantId,
      email: u.email,
      name: u.name,
      role: u.role as any,
      active: u.active,
      createdAt: u.createdAt,
      password: u.password || undefined,
    };
  } catch (error) {
    console.error('getUserByEmail failed:', error);
    throw new Error('Falha ao consultar perfil por e-mail.', { cause: error });
  }
}

export async function upsertUserProfile(profile: UserProfile & { password?: string }): Promise<UserProfile> {
  try {
    await db
      .insert(users)
      .values({
        uid: profile.uid,
        tenantId: profile.tenantId,
        email: profile.email.toLowerCase(),
        name: profile.name,
        role: profile.role,
        password: profile.password || null,
        active: profile.active,
        createdAt: profile.createdAt || new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          tenantId: profile.tenantId,
          email: profile.email.toLowerCase(),
          name: profile.name,
          role: profile.role,
          ...(profile.password ? { password: profile.password } : {}),
          active: profile.active,
        },
      });
    return profile;
  } catch (error) {
    console.error('upsertUserProfile failed:', error);
    throw new Error('Falha ao salvar perfil de usuário.', { cause: error });
  }
}

// ==========================================
// COMPANY SETTINGS
// ==========================================

export async function getCompanySettingsByTenant(tenantId: string): Promise<CompanySettingsType | null> {
  try {
    const res = await db.select().from(companySettings).where(eq(companySettings.tenantId, tenantId)).limit(1);
    if (!res.length) return null;
    const s = res[0];
    return {
      tenantId: s.tenantId,
      legalName: s.legalName,
      tradeName: s.tradeName,
      cnpj: s.cnpj,
      phone: s.phone,
      email: s.email,
      cep: s.cep,
      address: s.address,
      number: s.number,
      complement: s.complement || undefined,
      neighborhood: s.neighborhood,
      city: s.city,
      state: s.state,
      logoUrl: s.logoUrl || undefined,
      timezone: s.timezone,
      shifts: s.shifts,
      updatedAt: s.updatedAt,
    };
  } catch (error) {
    console.error('getCompanySettingsByTenant failed:', error);
    throw new Error('Falha ao consultar configurações da empresa.', { cause: error });
  }
}

export async function upsertCompanySettings(settings: CompanySettingsType): Promise<CompanySettingsType> {
  try {
    await db
      .insert(companySettings)
      .values({
        tenantId: settings.tenantId,
        legalName: settings.legalName,
        tradeName: settings.tradeName,
        cnpj: settings.cnpj,
        phone: settings.phone,
        email: settings.email,
        cep: settings.cep,
        address: settings.address,
        number: settings.number,
        complement: settings.complement || null,
        neighborhood: settings.neighborhood,
        city: settings.city,
        state: settings.state,
        logoUrl: settings.logoUrl || null,
        timezone: settings.timezone || 'America/Recife',
        shifts: settings.shifts || ['Geral', 'Almoço', 'Noite'],
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: companySettings.tenantId,
        set: {
          legalName: settings.legalName,
          tradeName: settings.tradeName,
          cnpj: settings.cnpj,
          phone: settings.phone,
          email: settings.email,
          cep: settings.cep,
          address: settings.address,
          number: settings.number,
          complement: settings.complement || null,
          neighborhood: settings.neighborhood,
          city: settings.city,
          state: settings.state,
          logoUrl: settings.logoUrl || null,
          timezone: settings.timezone || 'America/Recife',
          shifts: settings.shifts || ['Geral', 'Almoço', 'Noite'],
          updatedAt: new Date().toISOString(),
        },
      });
    return settings;
  } catch (error) {
    console.error('upsertCompanySettings failed:', error);
    throw new Error('Falha ao atualizar configurações.', { cause: error });
  }
}

// ==========================================
// MOTOBOYS
// ==========================================

export async function getMotoboysByTenant(tenantId: string): Promise<Motoboy[]> {
  try {
    const res = await db.select().from(motoboys).where(eq(motoboys.tenantId, tenantId));
    return res.map((m) => ({
      id: m.id,
      tenantId: m.tenantId,
      name: m.name,
      cpf: m.cpf,
      phone: m.phone,
      active: m.active,
      notes: m.notes || undefined,
      createdAt: m.createdAt,
    }));
  } catch (error) {
    console.error('getMotoboysByTenant failed:', error);
    throw new Error('Falha ao buscar motoboys.', { cause: error });
  }
}

export async function upsertMotoboy(item: Motoboy): Promise<Motoboy> {
  try {
    await db
      .insert(motoboys)
      .values({
        id: item.id,
        tenantId: item.tenantId,
        name: item.name,
        cpf: item.cpf,
        phone: item.phone,
        active: item.active,
        notes: item.notes || null,
        createdAt: item.createdAt || new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: motoboys.id,
        set: {
          name: item.name,
          cpf: item.cpf,
          phone: item.phone,
          active: item.active,
          notes: item.notes || null,
        },
      });
    return item;
  } catch (error) {
    console.error('upsertMotoboy failed:', error);
    throw new Error('Falha ao salvar motoboy.', { cause: error });
  }
}

export async function deleteMotoboyById(id: string): Promise<void> {
  try {
    await db.delete(motoboys).where(eq(motoboys.id, id));
  } catch (error) {
    console.error('deleteMotoboyById failed:', error);
    throw new Error('Falha ao excluir motoboy.', { cause: error });
  }
}

// ==========================================
// DELIVERY STORES
// ==========================================

export async function getStoresByTenant(tenantId: string): Promise<DeliveryStore[]> {
  try {
    const res = await db.select().from(deliveryStores).where(eq(deliveryStores.tenantId, tenantId));
    return res.map((s) => ({
      id: s.id,
      tenantId: s.tenantId,
      name: s.name,
      code: s.code,
      cnpj: s.cnpj || undefined,
      phone: s.phone || undefined,
      active: s.active,
      notes: s.notes || undefined,
      createdAt: s.createdAt,
    }));
  } catch (error) {
    console.error('getStoresByTenant failed:', error);
    throw new Error('Falha ao buscar lojas.', { cause: error });
  }
}

export async function upsertStore(item: DeliveryStore): Promise<DeliveryStore> {
  try {
    await db
      .insert(deliveryStores)
      .values({
        id: item.id,
        tenantId: item.tenantId,
        name: item.name,
        code: item.code,
        cnpj: item.cnpj || null,
        phone: item.phone || null,
        active: item.active,
        notes: item.notes || null,
        createdAt: item.createdAt || new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: deliveryStores.id,
        set: {
          name: item.name,
          code: item.code,
          cnpj: item.cnpj || null,
          phone: item.phone || null,
          active: item.active,
          notes: item.notes || null,
        },
      });
    return item;
  } catch (error) {
    console.error('upsertStore failed:', error);
    throw new Error('Falha ao salvar loja.', { cause: error });
  }
}

export async function deleteStoreById(id: string): Promise<void> {
  try {
    await db.delete(deliveryStores).where(eq(deliveryStores.id, id));
  } catch (error) {
    console.error('deleteStoreById failed:', error);
    throw new Error('Falha ao excluir loja.', { cause: error });
  }
}

// ==========================================
// NEIGHBORHOOD RATES
// ==========================================

export async function getRatesByTenant(tenantId: string): Promise<NeighborhoodRate[]> {
  try {
    const res = await db.select().from(neighborhoodRates).where(eq(neighborhoodRates.tenantId, tenantId));
    return res.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      storeId: r.storeId,
      storeName: r.storeName,
      neighborhood: r.neighborhood,
      rate: r.rate,
      active: r.active,
      notes: r.notes || undefined,
      updatedAt: r.updatedAt,
    }));
  } catch (error) {
    console.error('getRatesByTenant failed:', error);
    throw new Error('Falha ao buscar taxas por bairro.', { cause: error });
  }
}

export async function upsertRate(item: NeighborhoodRate): Promise<NeighborhoodRate> {
  try {
    await db
      .insert(neighborhoodRates)
      .values({
        id: item.id,
        tenantId: item.tenantId,
        storeId: item.storeId,
        storeName: item.storeName,
        neighborhood: item.neighborhood,
        rate: item.rate,
        active: item.active,
        notes: item.notes || null,
        updatedAt: item.updatedAt || new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: neighborhoodRates.id,
        set: {
          storeId: item.storeId,
          storeName: item.storeName,
          neighborhood: item.neighborhood,
          rate: item.rate,
          active: item.active,
          notes: item.notes || null,
          updatedAt: new Date().toISOString(),
        },
      });
    return item;
  } catch (error) {
    console.error('upsertRate failed:', error);
    throw new Error('Falha ao salvar taxa.', { cause: error });
  }
}

export async function deleteRateById(id: string): Promise<void> {
  try {
    await db.delete(neighborhoodRates).where(eq(neighborhoodRates.id, id));
  } catch (error) {
    console.error('deleteRateById failed:', error);
    throw new Error('Falha ao excluir taxa.', { cause: error });
  }
}

// ==========================================
// DELIVERY ORDERS
// ==========================================

export async function getOrdersByTenant(tenantId: string): Promise<DeliveryOrder[]> {
  try {
    const res = await db
      .select()
      .from(deliveryOrders)
      .where(eq(deliveryOrders.tenantId, tenantId))
      .orderBy(desc(deliveryOrders.createdAt));
    return res.map((o) => ({
      id: o.id,
      tenantId: o.tenantId,
      orderNumber: o.orderNumber,
      dispatchTime: o.dispatchTime,
      operationalDate: o.operationalDate,
      shiftName: o.shiftName,
      storeId: o.storeId,
      storeName: o.storeName,
      clientName: o.clientName,
      clientPhone: o.clientPhone || undefined,
      address: o.address,
      neighborhood: o.neighborhood,
      addressRef: o.addressRef || undefined,
      rate: o.rate,
      originalRate: o.originalRate || undefined,
      manualRateAdjusted: o.manualRateAdjusted,
      adjustmentReason: o.adjustmentReason || undefined,
      rateHistory: o.rateHistory || undefined,
      motoboyId: o.motoboyId,
      motoboyName: o.motoboyName,
      status: o.status as any,
      completionTime: o.completionTime || undefined,
      completedBy: o.completedBy || undefined,
      completedByName: o.completedByName || undefined,
      cancellationReason: o.cancellationReason || undefined,
      cancellationTime: o.cancellationTime || undefined,
      canceledBy: o.canceledBy || undefined,
      canceledByName: o.canceledByName || undefined,
      clientNotFoundNotes: o.clientNotFoundNotes || undefined,
      clientNotFoundTime: o.clientNotFoundTime || undefined,
      clientNotFoundBy: o.clientNotFoundBy || undefined,
      notes: o.notes || undefined,
      shiftClosingId: o.shiftClosingId || undefined,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));
  } catch (error) {
    console.error('getOrdersByTenant failed:', error);
    throw new Error('Falha ao buscar pedidos/corridas.', { cause: error });
  }
}

export async function upsertOrder(order: DeliveryOrder): Promise<DeliveryOrder> {
  try {
    await db
      .insert(deliveryOrders)
      .values({
        id: order.id,
        tenantId: order.tenantId,
        orderNumber: order.orderNumber,
        dispatchTime: order.dispatchTime,
        operationalDate: order.operationalDate,
        shiftName: order.shiftName,
        storeId: order.storeId,
        storeName: order.storeName,
        clientName: order.clientName,
        clientPhone: order.clientPhone || null,
        address: order.address,
        neighborhood: order.neighborhood,
        addressRef: order.addressRef || null,
        rate: order.rate,
        originalRate: order.originalRate || null,
        manualRateAdjusted: order.manualRateAdjusted || false,
        adjustmentReason: order.adjustmentReason || null,
        rateHistory: order.rateHistory || null,
        motoboyId: order.motoboyId,
        motoboyName: order.motoboyName,
        status: order.status,
        completionTime: order.completionTime || null,
        completedBy: order.completedBy || null,
        completedByName: order.completedByName || null,
        cancellationReason: order.cancellationReason || null,
        cancellationTime: order.cancellationTime || null,
        canceledBy: order.canceledBy || null,
        canceledByName: order.canceledByName || null,
        clientNotFoundNotes: order.clientNotFoundNotes || null,
        clientNotFoundTime: order.clientNotFoundTime || null,
        clientNotFoundBy: order.clientNotFoundBy || null,
        notes: order.notes || null,
        shiftClosingId: order.shiftClosingId || null,
        createdAt: order.createdAt || new Date().toISOString(),
        updatedAt: order.updatedAt || new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: deliveryOrders.id,
        set: {
          orderNumber: order.orderNumber,
          dispatchTime: order.dispatchTime,
          operationalDate: order.operationalDate,
          shiftName: order.shiftName,
          storeId: order.storeId,
          storeName: order.storeName,
          clientName: order.clientName,
          clientPhone: order.clientPhone || null,
          address: order.address,
          neighborhood: order.neighborhood,
          addressRef: order.addressRef || null,
          rate: order.rate,
          originalRate: order.originalRate || null,
          manualRateAdjusted: order.manualRateAdjusted || false,
          adjustmentReason: order.adjustmentReason || null,
          rateHistory: order.rateHistory || null,
          motoboyId: order.motoboyId,
          motoboyName: order.motoboyName,
          status: order.status,
          completionTime: order.completionTime || null,
          completedBy: order.completedBy || null,
          completedByName: order.completedByName || null,
          cancellationReason: order.cancellationReason || null,
          cancellationTime: order.cancellationTime || null,
          canceledBy: order.canceledBy || null,
          canceledByName: order.canceledByName || null,
          clientNotFoundNotes: order.clientNotFoundNotes || null,
          clientNotFoundTime: order.clientNotFoundTime || null,
          clientNotFoundBy: order.clientNotFoundBy || null,
          notes: order.notes || null,
          shiftClosingId: order.shiftClosingId || null,
          updatedAt: new Date().toISOString(),
        },
      });
    return order;
  } catch (error) {
    console.error('upsertOrder failed:', error);
    throw new Error('Falha ao salvar pedido.', { cause: error });
  }
}

export async function deleteOrderById(id: string): Promise<void> {
  try {
    await db.delete(deliveryOrders).where(eq(deliveryOrders.id, id));
  } catch (error) {
    console.error('deleteOrderById failed:', error);
    throw new Error('Falha ao excluir pedido.', { cause: error });
  }
}

// ==========================================
// SHIFT CLOSINGS
// ==========================================

export async function getShiftClosingsByTenant(tenantId: string): Promise<ShiftClosing[]> {
  try {
    const res = await db
      .select()
      .from(shiftClosings)
      .where(eq(shiftClosings.tenantId, tenantId))
      .orderBy(desc(shiftClosings.closedAt));
    return res.map((s) => ({
      id: s.id,
      tenantId: s.tenantId,
      closingCode: s.closingCode,
      shiftName: s.shiftName,
      operationalDate: s.operationalDate,
      closedAt: s.closedAt,
      closedBy: s.closedBy,
      closedByName: s.closedByName,
      totalOrders: s.totalOrders,
      completedOrders: s.completedOrders,
      canceledOrders: s.canceledOrders,
      clientNotFoundOrders: s.clientNotFoundOrders,
      pendingOrdersResolved: s.pendingOrdersResolved,
      totalFinancialAmount: s.totalFinancialAmount,
      motoboysSummary: s.motoboysSummary,
      notes: s.notes || undefined,
    }));
  } catch (error) {
    console.error('getShiftClosingsByTenant failed:', error);
    throw new Error('Falha ao consultar fechamentos de turno.', { cause: error });
  }
}

export async function insertShiftClosing(closing: ShiftClosing): Promise<ShiftClosing> {
  try {
    await db.insert(shiftClosings).values({
      id: closing.id,
      tenantId: closing.tenantId,
      closingCode: closing.closingCode,
      shiftName: closing.shiftName,
      operationalDate: closing.operationalDate,
      closedAt: closing.closedAt,
      closedBy: closing.closedBy,
      closedByName: closing.closedByName,
      totalOrders: closing.totalOrders,
      completedOrders: closing.completedOrders,
      canceledOrders: closing.canceledOrders,
      clientNotFoundOrders: closing.clientNotFoundOrders,
      pendingOrdersResolved: closing.pendingOrdersResolved,
      totalFinancialAmount: closing.totalFinancialAmount,
      motoboysSummary: closing.motoboysSummary,
      notes: closing.notes || null,
    });
    return closing;
  } catch (error) {
    console.error('insertShiftClosing failed:', error);
    throw new Error('Falha ao salvar fechamento de turno.', { cause: error });
  }
}

// ==========================================
// AUDIT LOGS
// ==========================================

export async function getAuditLogsByTenant(tenantId: string): Promise<AuditLog[]> {
  try {
    const res = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.tenantId, tenantId))
      .orderBy(desc(auditLogs.timestamp))
      .limit(100);
    return res.map((a) => ({
      id: a.id,
      tenantId: a.tenantId,
      action: a.action,
      entity: a.entity as any,
      entityId: a.entityId,
      details: a.details,
      userId: a.userId,
      userEmail: a.userEmail,
      timestamp: a.timestamp,
    }));
  } catch (error) {
    console.error('getAuditLogsByTenant failed:', error);
    throw new Error('Falha ao consultar registros de auditoria.', { cause: error });
  }
}

export async function insertAuditLog(log: AuditLog): Promise<AuditLog> {
  try {
    await db.insert(auditLogs).values({
      id: log.id,
      tenantId: log.tenantId,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      details: log.details,
      userId: log.userId,
      userEmail: log.userEmail,
      timestamp: log.timestamp,
    });
    return log;
  } catch (error) {
    console.error('insertAuditLog failed:', error);
    throw new Error('Falha ao gravar log de auditoria.', { cause: error });
  }
}

// ==========================================
// NOTIFICATIONS
// ==========================================

export async function getNotificationsByTenant(tenantId: string): Promise<AppNotification[]> {
  try {
    const res = await db
      .select()
      .from(appNotifications)
      .where(eq(appNotifications.tenantId, tenantId))
      .orderBy(desc(appNotifications.timestamp))
      .limit(100);
    return res.map((n) => ({
      id: n.id,
      tenantId: n.tenantId,
      title: n.title,
      body: n.body,
      type: n.type as any,
      orderId: n.orderId || undefined,
      orderNumber: n.orderNumber || undefined,
      targetRole: n.targetRole as any,
      targetMotoboyId: n.targetMotoboyId || undefined,
      targetMotoboyName: n.targetMotoboyName || undefined,
      read: n.read,
      timestamp: n.timestamp,
    }));
  } catch (error) {
    console.error('getNotificationsByTenant failed:', error);
    throw new Error('Falha ao consultar notificações.', { cause: error });
  }
}

export async function insertNotification(n: AppNotification): Promise<AppNotification> {
  try {
    await db.insert(appNotifications).values({
      id: n.id,
      tenantId: n.tenantId,
      title: n.title,
      body: n.body,
      type: n.type,
      orderId: n.orderId || null,
      orderNumber: n.orderNumber || null,
      targetRole: n.targetRole,
      targetMotoboyId: n.targetMotoboyId || null,
      targetMotoboyName: n.targetMotoboyName || null,
      read: n.read,
      timestamp: n.timestamp,
    });
    return n;
  } catch (error) {
    console.error('insertNotification failed:', error);
    throw new Error('Falha ao criar notificação.', { cause: error });
  }
}

export async function updateNotificationRead(id: string, read: boolean): Promise<void> {
  try {
    await db.update(appNotifications).set({ read }).where(eq(appNotifications.id, id));
  } catch (error) {
    console.error('updateNotificationRead failed:', error);
    throw new Error('Falha ao atualizar status da notificação.', { cause: error });
  }
}

export async function markAllNotificationsRead(tenantId: string): Promise<void> {
  try {
    await db.update(appNotifications).set({ read: true }).where(eq(appNotifications.tenantId, tenantId));
  } catch (error) {
    console.error('markAllNotificationsRead failed:', error);
    throw new Error('Falha ao marcar notificações como lidas.', { cause: error });
  }
}
