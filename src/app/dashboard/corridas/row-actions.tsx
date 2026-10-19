'use client';

/**
 * Ações da linha de corrida na listagem.
 * ---------------------------------------------------------------------------
 * - Botão de histórico (abre um modal com a timeline de status).
 * - Botão de status (altera o status respeitando as transições permitidas).
 * - Botão de excluir (apenas admin).
 * O componente recebe apenas os dados necessários da linha — nada é buscado
 * no cliente, evitando consultas extras.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { History, Loader2, Trash2, Workflow } from 'lucide-react';
import {
  cancelDeliveryAction,
  changeStatusAction,
  deleteDeliveryAction,
} from '@/app/actions/deliveries';
import { Modal, useConfirm, useToast } from '@/components/ui';
import { DELIVERY_STATUS_LABEL, type DeliveryStatus } from '@/lib/types';
import { DeliveryHistory } from './history';

interface DeliveryLite {
  id: string;
  order_number: string;
  status: DeliveryStatus;
  company_id: string;
  customer_name: string;
  neighborhood_id: string;
  motoboy_id: string;
  fee_cents: number;
  notes: string | null;
}

/** Transições permitidas (espelha `canTransition` do repositório). */
const NEXT_STATUS: Record<DeliveryStatus, DeliveryStatus[]> = {
  pending: ['dispatched', 'cancelled'],
  dispatched: ['in_progress', 'delivered', 'cancelled', 'customer_not_found'],
  in_progress: ['delivered', 'cancelled', 'customer_not_found'],
  delivered: [],
  cancelled: [],
  customer_not_found: [],
};

export function DeliveryRowActions({
  delivery,
  user,
}: {
  delivery: DeliveryLite;
  user: { role: string; motoboy_id: string | null };
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [historyOpen, setHistoryOpen] = useState(false);

  const options = NEXT_STATUS[delivery.status];
  const canDelete = user.role === 'admin';

  const changeStatus = (next: DeliveryStatus) => {
    startTransition(async () => {
      const res =
        next === 'cancelled'
          ? await cancelDeliveryAction(delivery.id, 'Cancelada pelo operador')
          : await changeStatusAction(delivery.id, next);
      if (res.ok) {
        toast.success(`Status alterado para "${DELIVERY_STATUS_LABEL[next]}".`);
        router.refresh();
      } else {
        toast.error(res.error ?? 'Não foi possível alterar o status.');
      }
    });
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: 'Excluir corrida',
      message: `Excluir a corrida #${delivery.order_number}? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;

    startTransition(async () => {
      const res = await deleteDeliveryAction(delivery.id);
      if (res.ok) {
        toast.success('Corrida excluída.');
        router.refresh();
      } else {
        toast.error(res.error ?? 'Não foi possível excluir a corrida.');
      }
    });
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => setHistoryOpen(true)}
        className="btn-ghost btn-sm p-1.5"
        title="Ver histórico"
        aria-label="Ver histórico"
      >
        <History className="h-4 w-4" />
      </button>

      {options.length > 0 && (
        <label className="inline-flex items-center gap-1.5">
          <Workflow className="h-4 w-4 text-ink-400" />
          <select
            className="select w-auto min-w-[120px] py-1.5 text-xs"
            disabled={isPending}
            value=""
            onChange={(e) => {
              const next = e.target.value as DeliveryStatus;
              if (next) changeStatus(next);
            }}
            aria-label="Alterar status"
          >
            <option value="">Alterar status…</option>
            {options.map((s) => (
              <option key={s} value={s}>
                {DELIVERY_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-400" />}
        </label>
      )}

      {canDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={isPending}
          className="btn-ghost btn-sm p-1.5 text-rose-600 hover:bg-rose-50"
          title="Excluir"
          aria-label="Excluir corrida"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      <Modal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={`Histórico da corrida #${delivery.order_number}`}
        subtitle={`${delivery.customer_name} · ${DELIVERY_STATUS_LABEL[delivery.status]}`}
        size="md"
      >
        <DeliveryHistory deliveryId={delivery.id} />
      </Modal>
    </div>
  );
}
