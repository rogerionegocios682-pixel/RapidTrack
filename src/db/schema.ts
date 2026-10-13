import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  doublePrecision,
  jsonb,
  timestamp,
} from 'drizzle-orm/pg-core';

// Tenants
export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  tradeName: text('trade_name').notNull(),
  cnpj: text('cnpj'),
  email: text('email').notNull(),
  phone: text('phone'),
  maxStores: integer('max_stores').default(50).notNull(),
  createdAt: text('created_at').notNull(),
});

// Users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Auth UID
  tenantId: text('tenant_id').notNull(),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull(), // 'admin' | 'operator' | 'viewer'
  active: boolean('active').default(true).notNull(),
  createdAt: text('created_at').notNull(),
});

// Company Settings
export const companySettings = pgTable('company_settings', {
  tenantId: text('tenant_id').primaryKey(),
  legalName: text('legal_name').notNull(),
  tradeName: text('trade_name').notNull(),
  cnpj: text('cnpj').notNull(),
  phone: text('phone').notNull(),
  email: text('email').notNull(),
  cep: text('cep').notNull(),
  address: text('address').notNull(),
  number: text('number').notNull(),
  complement: text('complement'),
  neighborhood: text('neighborhood').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  logoUrl: text('logo_url'),
  timezone: text('timezone').default('America/Recife').notNull(),
  shifts: jsonb('shifts').$type<string[]>().notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Motoboys
export const motoboys = pgTable('motoboys', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  cpf: text('cpf').notNull(),
  phone: text('phone').notNull(),
  active: boolean('active').default(true).notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

// Delivery Stores
export const deliveryStores = pgTable('delivery_stores', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  code: text('code').notNull(),
  cnpj: text('cnpj'),
  phone: text('phone'),
  active: boolean('active').default(true).notNull(),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

// Neighborhood Rates
export const neighborhoodRates = pgTable('neighborhood_rates', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  storeId: text('store_id').notNull(),
  storeName: text('store_name').notNull(),
  neighborhood: text('neighborhood').notNull(),
  rate: doublePrecision('rate').notNull(),
  active: boolean('active').default(true).notNull(),
  notes: text('notes'),
  updatedAt: text('updated_at').notNull(),
});

// Delivery Orders
export const deliveryOrders = pgTable('delivery_orders', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  orderNumber: text('order_number').notNull(),
  dispatchTime: text('dispatch_time').notNull(),
  operationalDate: text('operational_date').notNull(),
  shiftName: text('shift_name').notNull(),
  storeId: text('store_id').notNull(),
  storeName: text('store_name').notNull(),
  clientName: text('client_name').notNull(),
  clientPhone: text('client_phone'),
  address: text('address').notNull(),
  neighborhood: text('neighborhood').notNull(),
  addressRef: text('address_ref'),
  rate: doublePrecision('rate').notNull(),
  originalRate: doublePrecision('original_rate'),
  manualRateAdjusted: boolean('manual_rate_adjusted').default(false).notNull(),
  adjustmentReason: text('adjustment_reason'),
  rateHistory: jsonb('rate_history').$type<any[]>(),
  motoboyId: text('motoboy_id').notNull(),
  motoboyName: text('motoboy_name').notNull(),
  status: text('status').notNull(), // 'pending' | 'completed' | 'canceled' | 'client_not_found'
  completionTime: text('completion_time'),
  completedBy: text('completed_by'),
  completedByName: text('completed_by_name'),
  cancellationReason: text('cancellation_reason'),
  cancellationTime: text('cancellation_time'),
  canceledBy: text('canceled_by'),
  canceledByName: text('canceled_by_name'),
  clientNotFoundNotes: text('client_not_found_notes'),
  clientNotFoundTime: text('client_not_found_time'),
  clientNotFoundBy: text('client_not_found_by'),
  notes: text('notes'),
  shiftClosingId: text('shift_closing_id'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Shift Closings
export const shiftClosings = pgTable('shift_closings', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  closingCode: text('closing_code').notNull(),
  shiftName: text('shift_name').notNull(),
  operationalDate: text('operational_date').notNull(),
  closedAt: text('closed_at').notNull(),
  closedBy: text('closed_by').notNull(),
  closedByName: text('closed_by_name').notNull(),
  totalOrders: integer('total_orders').notNull(),
  completedOrders: integer('completed_orders').notNull(),
  canceledOrders: integer('canceled_orders').notNull(),
  clientNotFoundOrders: integer('client_not_found_orders').notNull(),
  pendingOrdersResolved: integer('pending_orders_resolved').notNull(),
  totalFinancialAmount: doublePrecision('total_financial_amount').notNull(),
  motoboysSummary: jsonb('motoboys_summary').$type<any[]>().notNull(),
  notes: text('notes'),
});

// Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  action: text('action').notNull(),
  entity: text('entity').notNull(),
  entityId: text('entity_id').notNull(),
  details: text('details').notNull(),
  userId: text('user_id').notNull(),
  userEmail: text('user_email').notNull(),
  timestamp: text('timestamp').notNull(),
});

// App Notifications
export const appNotifications = pgTable('app_notifications', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  type: text('type').notNull(),
  orderId: text('order_id'),
  orderNumber: text('order_number'),
  targetRole: text('target_role').notNull(),
  targetMotoboyId: text('target_motoboy_id'),
  targetMotoboyName: text('target_motoboy_name'),
  read: boolean('read').default(false).notNull(),
  timestamp: text('timestamp').notNull(),
});
