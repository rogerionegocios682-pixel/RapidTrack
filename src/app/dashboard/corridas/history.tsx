'use client';

/**
 * Timeline do histórico de status de uma corrida (client).
 * Carrega os dados via Server Action quando o modal é aberto, para não
 * importar um Server Component dentro deste Client Component.
 */
import { useEffect, useState } from 'react';
import { CircleDashed, Clock, Loader2 } from 'lucide-react';
import { loadDeliveryHistoryAction } from '@/app/actions/deliveries';
import { EmptyState } from '@/components/ui';
import {
  DELIVERY_STATUS_LABEL,
  DELIVERY_STATUS_COLOR,
  type DeliveryStatus,
} from '@/lib/types';
import { formatDateTime } from '@/lib/format';

interface HistoryRow {
  id: string;
  old_status: DeliveryStatus | null;
  new_status: DeliveryStatus;
  created_at: string;
  user_name: string;
}

export function DeliveryHistory({ deliveryId }: { deliveryId: string }) {
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadDeliveryHistoryAction(deliveryId).then((res) => {
      if (!active) return;
      if (res.ok) setHistory((res.data as HistoryRow[]) ?? []);
      else setError(res.error ?? 'Não foi possível carregar o histórico.');
    });
    return () => {
      active = false;
    };
  }, [deliveryId]);

  if (error) {
    return <p className="text-sm text-rose-600">{error}</p>;
  }

  if (history === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <EmptyState
        icon={<CircleDashed className="h-8 w-8" />}
        title="Sem movimentações registradas"
        message="Esta corrida ainda não teve alterações de status."
      />
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-ink-200 pl-5">
      {history.map((h) => (
        <li key={h.id} className="relative">
          <span className="absolute -left-[26px] top-1 grid h-3 w-3 place-items-center rounded-full bg-brand-500 ring-4 ring-white" />
          <div className="flex flex-wrap items-center gap-2">
            {h.old_status ? (
              <span className={`badge ${DELIVERY_STATUS_COLOR[h.old_status]}`}>
                {DELIVERY_STATUS_LABEL[h.old_status]}
              </span>
            ) : (
              <span className="badge bg-ink-100 text-ink-600 ring-ink-200">Criada</span>
            )}
            <span className="text-ink-400">→</span>
            <span className={`badge ${DELIVERY_STATUS_COLOR[h.new_status]}`}>
              {DELIVERY_STATUS_LABEL[h.new_status]}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
            <Clock className="h-3.5 w-3.5" />
            {formatDateTime(h.created_at)} · por {h.user_name ?? 'Sistema'}
          </p>
        </li>
      ))}
    </ol>
  );
}
