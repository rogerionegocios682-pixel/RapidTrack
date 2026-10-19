'use server';

import { requirePermission } from '@/lib/auth';
import {
  createDelivery,
  updateDelivery,
  changeDeliveryStatus,
  deleteDelivery,
  getDelivery,
  getDeliveryHistory,
  canTransition,
} from '@/lib/repo/deliveries';
import { clean, parseMoneyToCents } from '@/lib/utils';
import { listNeighborhoodsForCompany } from '@/lib/repo/companies';
import { DELIVERY_STATUS_LABEL, type DeliveryStatus } from '@/lib/types';
import { guard, type ActionResult } from './guard';

const REVALIDATE = ['/dashboard', '/dashboard/corridas', '/dashboard/relatorios'];

const VALID_STATUSES: DeliveryStatus[] = [
  'pending',
  'dispatched',
  'in_progress',
  'delivered',
  'cancelled',
  'customer_not_found',
];

function parseStatus(value: string): DeliveryStatus {
  return VALID_STATUSES.includes(value as DeliveryStatus)
    ? (value as DeliveryStatus)
    : 'dispatched';
}

function readDeliveryForm(formData: FormData) {
  const feeInput = String(formData.get('fee') ?? '');
  const feeCents = parseMoneyToCents(feeInput);

  if (!feeInput.trim()) throw new Error('Informe o valor da taxa de entrega.');

  return {
    order_number: clean(formData.get('order_number'), 50),
    company_id: clean(formData.get('company_id'), 60),
    customer_name: clean(formData.get('customer_name'), 150),
    neighborhood_id: clean(formData.get('neighborhood_id'), 60),
    motoboy_id: clean(formData.get('motoboy_id'), 60),
    fee_cents: feeCents,
    notes: clean(formData.get('notes'), 500),
    status: parseStatus(clean(formData.get('status'), 30) || 'dispatched'),
  };
}

/** Cria a corrida e já a despacha. */
export async function createDeliveryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return guard(async () => {
    const user = await requirePermission('deliveries.create');
    const input = readDeliveryForm(formData);

    if (!input.order_number) throw new Error('Informe o número do pedido.');
    if (!input.company_id) throw new Error('Selecione a empresa.');
    if (!input.customer_name) throw new Error('Informe o nome do cliente.');
    if (!input.neighborhood_id) throw new Error('Selecione o bairro.');
    if (!input.motoboy_id) throw new Error('Selecione o motoboy.');
    if (input.fee_cents <= 0) throw new Error('O valor da taxa deve ser maior que zero.');

    const delivery = await createDelivery(input, user);
    return { id: delivery.id };
  }, { revalidate: REVALIDATE });
}

export async function updateDeliveryAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('deliveries.update');
    const id = clean(formData.get('id'), 60);
    if (!id) throw new Error('Corrida não identificada.');

    const input = readDeliveryForm(formData);
    await updateDelivery(id, input, user);
    return true;
  }, { revalidate: REVALIDATE });
}

/** Altera o status (com validação de transição e registro de histórico). */
export async function changeStatusAction(
  id: string,
  newStatus: DeliveryStatus,
  reason?: string,
): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('deliveries.change_status');
    const delivery = await getDelivery(id, user);
    if (!delivery) throw new Error('Corrida não encontrada.');

    if (!canTransition(delivery.status, newStatus)) {
      throw new Error(
        `Não é possível mudar de "${DELIVERY_STATUS_LABEL[delivery.status]}" para "${DELIVERY_STATUS_LABEL[newStatus]}".`,
      );
    }

    await changeDeliveryStatus(id, newStatus, user, reason);
    return true;
  }, { revalidate: REVALIDATE });
}

export async function cancelDeliveryAction(
  id: string,
  reason?: string,
): Promise<ActionResult> {
  return changeStatusAction(id, 'cancelled', reason || 'Cancelada pelo operador');
}

export async function deleteDeliveryAction(id: string): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('deliveries.delete');
    await deleteDelivery(id, user);
    return true;
  }, { revalidate: REVALIDATE });
}

/**
 * Carrega os bairros atendidos por uma empresa (com a taxa sugerida).
 * Usado no formulário de nova corrida para preencher o select dependente e
 * já sugerir o valor da taxa daquela empresa+bairro.
 */
export async function loadCompanyNeighborhoodsAction(companyId: string): Promise<
  ActionResult<{ id: string; name: string; city: string; fee_cents: number | null }[]>
> {
  return guard(async () => {
    await requirePermission('deliveries.view');
    if (!companyId) return [];
    const rows = await listNeighborhoodsForCompany(companyId);
    return rows.map((n) => ({
      id: n.id,
      name: n.name,
      city: n.city,
      fee_cents: n.fee_cents ?? null,
    }));
  });
}

/**
 * Devolve o histórico de status de uma corrida.
 * Chamado pelo client quando o usuário abre o modal de histórico — evita
 * importar um Server Component dentro de um Client Component.
 */
export async function loadDeliveryHistoryAction(deliveryId: string): Promise<
  ActionResult<
    { id: string; old_status: DeliveryStatus | null; new_status: DeliveryStatus; created_at: string; user_name: string }[]
  >
> {
  return guard(async () => {
    await requirePermission('deliveries.view');
    if (!deliveryId) return [];
    return getDeliveryHistory(deliveryId);
  });
}
