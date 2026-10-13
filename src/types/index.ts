/**
 * Delivery OS - Herculano Gestor
 * Domain Types and Interfaces
 */

export type UserRole = 'admin' | 'operator' | 'viewer';

export interface Tenant {
  id: string;
  name: string;
  tradeName: string;
  cnpj?: string;
  email: string;
  phone?: string;
  maxStores: number;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  password?: string;
  createdAt: string;
}

export interface CompanySettings {
  tenantId: string;
  legalName: string; // Razão Social
  tradeName: string; // Nome Fantasia (ex: JC Empreendimentos)
  cnpj: string;
  phone: string;
  email: string;
  cep: string;
  address: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  logoUrl?: string;
  timezone: string; // default: America/Recife
  shifts: string[]; // ['Geral', 'Almoço', 'Tarde', 'Noite', 'Madrugada']
  updatedAt: string;
}

export interface Motoboy {
  id: string;
  tenantId: string;
  name: string;
  cpf: string;
  phone: string;
  active: boolean;
  notes?: string;
  createdAt: string;
}

export interface DeliveryStore {
  id: string;
  tenantId: string;
  name: string; // ex: iFood Loja A, Hamburgueria Gourmet
  code: string; // Identificador interno
  cnpj?: string;
  phone?: string;
  active: boolean;
  notes?: string;
  createdAt: string;
}

export interface NeighborhoodRate {
  id: string;
  tenantId: string;
  storeId: string;
  storeName: string;
  neighborhood: string;
  rate: number;
  active: boolean;
  notes?: string;
  updatedAt: string;
}

export type OrderStatus = 'pending' | 'completed' | 'canceled' | 'client_not_found';

export interface RateAuditHistory {
  originalRate: number;
  newRate: number;
  adjustedBy: string;
  adjustedByName: string;
  reason: string;
  adjustedAt: string;
}

export interface DeliveryOrder {
  id: string;
  tenantId: string;
  orderNumber: string; // Ex: #1042, IFD-8921
  dispatchTime: string; // HH:mm or ISO
  operationalDate: string; // YYYY-MM-DD
  shiftName: string; // Ex: Almoço, Noite
  storeId: string;
  storeName: string;
  clientName: string;
  clientPhone?: string;
  address: string;
  neighborhood: string;
  addressRef?: string;
  rate: number;
  originalRate?: number;
  manualRateAdjusted?: boolean;
  adjustmentReason?: string;
  rateHistory?: RateAuditHistory[];
  motoboyId: string;
  motoboyName: string;
  status: OrderStatus;
  
  // Status details
  completionTime?: string;
  completedBy?: string;
  completedByName?: string;
  
  cancellationReason?: string;
  cancellationTime?: string;
  canceledBy?: string;
  canceledByName?: string;
  
  clientNotFoundNotes?: string;
  clientNotFoundTime?: string;
  clientNotFoundBy?: string;
  
  notes?: string;
  shiftClosingId?: string; // locked if populated
  createdAt: string;
  updatedAt: string;
}

export interface MotoboyShiftSummary {
  motoboyId: string;
  motoboyName: string;
  completedCount: number;
  totalAmount: number;
}

export interface ShiftClosing {
  id: string;
  tenantId: string;
  closingCode: string; // Ex: TURNO-20261012-001
  shiftName: string;
  operationalDate: string;
  closedAt: string;
  closedBy: string;
  closedByName: string;
  totalOrders: number;
  completedOrders: number;
  canceledOrders: number;
  clientNotFoundOrders: number;
  pendingOrdersResolved: number;
  totalFinancialAmount: number;
  motoboysSummary: MotoboyShiftSummary[];
  notes?: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  action: string;
  entity: 'order' | 'rate' | 'shift' | 'motoboy' | 'store' | 'company' | 'user';
  entityId: string;
  details: string;
  userId: string;
  userEmail: string;
  timestamp: string;
}

export interface DashboardMetrics {
  ordersToday: number;
  ordersWeek: number;
  ordersMonth: number;
  ordersPending: number;
  ordersCanceledPeriod: number;
  totalFinancialMonth: number;
}

export interface MotoboyRankingItem {
  position: number;
  motoboyId: string;
  motoboyName: string;
  completedCount: number;
  totalAmount: number;
  lastCompletedAt?: string;
}

export type NotificationType =
  | 'new_order'
  | 'pending_delay'
  | 'order_completed'
  | 'order_canceled'
  | 'shift_closed';

export interface AppNotification {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  type: NotificationType;
  orderId?: string;
  orderNumber?: string;
  targetRole: 'all' | 'manager' | 'motoboy';
  targetMotoboyId?: string;
  targetMotoboyName?: string;
  read: boolean;
  timestamp: string;
}

