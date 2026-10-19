'use client';

/**
 * Formulário de nova corrida.
 * ---------------------------------------------------------------------------
 * O select de bairros depende da empresa escolhida: quando a empresa muda,
 * chamamos a Server Action `loadCompanyNeighborhoodsAction` que devolve os
 * bairros atendidos e a taxa sugerida. A taxa é preenchida automaticamente
 * (o operador pode ajustar).
 */
import { useEffect, useRef, useState, useTransition } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Plus } from 'lucide-react';
import { createDeliveryAction, loadCompanyNeighborhoodsAction } from '@/app/actions/deliveries';
import { Alert, Field, SelectField, TextArea } from '@/components/form';
import { useToast } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { DELIVERY_STATUS_LABEL, type DeliveryStatus } from '@/lib/types';
import type { ActionResult } from '@/app/actions/guard';

interface Option {
  id: string;
  name: string;
}

interface NeighborhoodOption {
  id: string;
  name: string;
  city: string;
  fee_cents: number | null;
}

const INITIAL_STATUSES: DeliveryStatus[] = ['dispatched', 'pending'];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> SALVANDO...
        </>
      ) : (
        <>
          <Plus className="h-4 w-4" /> REGISTRAR CORRIDA
        </>
      )}
    </button>
  );
}

export function NewDeliveryForm({
  companies,
  motoboys,
}: {
  companies: Option[];
  motoboys: Option[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    createDeliveryAction,
    null,
  );

  const [companyId, setCompanyId] = useState('');
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodOption[]>([]);
  const [fee, setFee] = useState('');
  const [loadingNeighborhoods, startLoad] = useTransition();
  const feeTouched = useRef(false);

  // Carrega os bairros sempre que a empresa muda.
  useEffect(() => {
    if (!companyId) {
      setNeighborhoods([]);
      return;
    }
    startLoad(async () => {
      const res = await loadCompanyNeighborhoodsAction(companyId);
      if (res.ok) setNeighborhoods(res.data ?? []);
      else {
        setNeighborhoods([]);
        toast.error(res.error ?? 'Não foi possível carregar os bairros.');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  // Ao salvar com sucesso, limpa e volta para a listagem.
  useEffect(() => {
    if (state?.ok) {
      toast.success('Corrida registrada com sucesso!');
      router.push('/dashboard/corridas');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const onNeighborhoodChange = (value: string) => {
    const nb = neighborhoods.find((n) => n.id === value);
    if (nb?.fee_cents != null && !feeTouched.current) {
      setFee((nb.fee_cents / 100).toFixed(2).replace('.', ','));
    }
  };

  return (
    <form action={formAction} className="space-y-5">
      {state?.error && <Alert kind="error" message={state.error} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Número do pedido"
          name="order_number"
          placeholder="Ex.: 1024"
          required
          autoFocus
          maxLength={50}
        />
        <Field
          label="Nome do cliente"
          name="customer_name"
          placeholder="Ex.: Maria Souza"
          required
          maxLength={150}
        />

        <div>
          <label htmlFor="company_id" className="label">
            Empresa <span className="text-rose-500">*</span>
          </label>
          <select
            id="company_id"
            name="company_id"
            required
            className="select"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="">Selecione...</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="neighborhood_id" className="label">
            Bairro <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <select
              id="neighborhood_id"
              name="neighborhood_id"
              required
              className="select"
              disabled={!companyId || loadingNeighborhoods}
              onChange={(e) => onNeighborhoodChange(e.target.value)}
            >
              <option value="">
                {!companyId
                  ? 'Selecione a empresa primeiro'
                  : neighborhoods.length === 0
                    ? 'Nenhum bairro vinculado'
                    : 'Selecione...'}
              </option>
              {neighborhoods.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.city})
                  {n.fee_cents != null ? ` — ${formatMoney(n.fee_cents)}` : ''}
                </option>
              ))}
            </select>
            {loadingNeighborhoods && (
              <Loader2 className="absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-400" />
            )}
          </div>
        </div>

        <SelectField
          label="Motoboy"
          name="motoboy_id"
          required
          includeEmpty
          options={motoboys.map((m) => ({ value: m.id, label: m.name }))}
        />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="fee" className="label">
              Taxa de entrega (R$) <span className="text-rose-500">*</span>
            </label>
            <input
              id="fee"
              name="fee"
              type="text"
              inputMode="decimal"
              required
              placeholder="8,50"
              className="input"
              value={fee}
              onChange={(e) => {
                feeTouched.current = true;
                setFee(e.target.value);
              }}
            />
          </div>
          <SelectField
            label="Status inicial"
            name="status"
            defaultValue="dispatched"
            options={INITIAL_STATUSES.map((s) => ({
              value: s,
              label: DELIVERY_STATUS_LABEL[s],
            }))}
          />
        </div>
      </div>

      <TextArea
        label="Observações"
        name="notes"
        placeholder="Instruções de entrega, ponto de referência, etc."
        maxLength={500}
      />

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <button
          type="button"
          className="btn-secondary w-full sm:w-auto"
          onClick={() => router.push('/dashboard/corridas')}
        >
          CANCELAR
        </button>
        <SubmitButton />
      </div>

      <p className="flex items-center gap-1.5 text-xs text-ink-500">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        A corrida entra no sistema e fica disponível em tempo real para o motoboy.
      </p>
    </form>
  );
}
