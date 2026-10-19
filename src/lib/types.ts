/** Tipos de domínio do Delivery_OS. */

export type UserRole = 'admin' | 'operator' | 'motoboy';
export type UserStatus = 'active' | 'inactive';

export type DeliveryStatus =
  | 'pending'
  | 'dispatched'
  | 'in_progress'
  | 'delivered'
  | 'cancelled'
  | 'customer_not_found';

export type MotoboyStatus = 'available' | 'on_delivery' | 'inactive';
export type ActiveStatus = 'active' | 'inactive';
export type MessageAudience = 'user' | 'all' | 'operators' | 'motoboys';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  motoboy_id: string | null;
  last_login_at: string | null;
  /** Permissões individuais (JSON). NULL = usa as permissões do papel. */
  permissions: string | null;
  created_at: string;
  updated_at: string;
}

/** Usuário seguro (sem hash de senha) para transportar à UI. */
export type SessionUser = Omit<User, 'password_hash' | 'status'> & {
  status: UserStatus;
};

export interface Company {
  id: string;
  name: string;
  trade_name: string | null;
  cnpj: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  status: ActiveStatus;
  created_at: string;
  updated_at: string;
}

export interface Motoboy {
  id: string;
  name: string;
  cpf: string | null;
  phone: string | null;
  whatsapp: string | null;
  motorcycle_plate: string | null;
  motorcycle_model: string | null;
  notes: string | null;
  status: MotoboyStatus;
  created_at: string;
  updated_at: string;
}

export interface Neighborhood {
  id: string;
  name: string;
  city: string;
  state: string;
  status: ActiveStatus;
  created_at: string;
  updated_at: string;
}

export interface CompanyNeighborhood {
  id: string;
  company_id: string;
  neighborhood_id: string;
  created_at: string;
}

export interface DeliveryFee {
  id: string;
  company_id: string;
  neighborhood_id: string;
  fee_cents: number;
  status: ActiveStatus;
  created_at: string;
  updated_at: string;
}

export interface Delivery {
  id: string;
  order_number: string;
  company_id: string;
  customer_name: string;
  neighborhood_id: string;
  motoboy_id: string;
  fee_cents: number;
  status: DeliveryStatus;
  notes: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Corrida com dados relacionados (joins) — usada em listagens e relatórios. */
export interface DeliveryRow extends Delivery {
  company_name: string;
  neighborhood_name: string;
  neighborhood_city: string;
  motoboy_name: string;
  operator_name: string;
}

export interface DeliveryStatusHistory {
  id: string;
  delivery_id: string;
  old_status: DeliveryStatus | null;
  new_status: DeliveryStatus;
  changed_by: string;
  created_at: string;
}

export interface InternalMessage {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  audience: MessageAudience;
  subject: string | null;
  message: string;
  is_announcement: number;
  read_at: string | null;
  created_at: string;
}

export interface InternalMessageRow extends InternalMessage {
  sender_name: string;
  receiver_name: string | null;
}

export interface Audit {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  description: string | null;
  metadata: string | null;
  created_at: string;
}

/* ---------------------------------------------------------------------------
 * Rótulos de exibição (pt-BR)
 * -------------------------------------------------------------------------*/

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  pending: 'Aguardando',
  dispatched: 'Despachada',
  in_progress: 'Em andamento',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
  customer_not_found: 'Cliente não encontrado',
};

export const DELIVERY_STATUS_COLOR: Record<DeliveryStatus, string> = {
  pending: 'bg-ink-100 text-ink-700 ring-ink-200',
  dispatched: 'bg-brand-50 text-brand-700 ring-brand-200',
  in_progress: 'bg-accent-400/15 text-accent-600 ring-accent-400/30',
  delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200',
  customer_not_found: 'bg-orange-50 text-orange-700 ring-orange-200',
};

export const MOTOBOY_STATUS_LABEL: Record<MotoboyStatus, string> = {
  available: 'Disponível',
  on_delivery: 'Em corrida',
  inactive: 'Inativo',
};

export const MOTOBOY_STATUS_COLOR: Record<MotoboyStatus, string> = {
  available: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  on_delivery: 'bg-brand-50 text-brand-700 ring-brand-200',
  inactive: 'bg-ink-100 text-ink-600 ring-ink-200',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  motoboy: 'Motoboy',
};

/** Status considerados "em aberto" (ainda não finalizados). */
export const OPEN_STATUSES: DeliveryStatus[] = ['pending', 'dispatched', 'in_progress'];
/** Status que ocupam o motoboy. */
export const BUSY_STATUSES: DeliveryStatus[] = ['dispatched', 'in_progress'];
