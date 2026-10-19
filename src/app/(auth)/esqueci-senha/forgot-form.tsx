'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Loader2, MailCheck, Send } from 'lucide-react';
import { forgotPasswordAction } from '@/app/actions/auth';
import { FormAlert } from '@/components/auth-layout';
import Link from 'next/link';
import type { ActionResult } from '@/app/actions/guard';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
        </>
      ) : (
        <>
          <Send className="h-4 w-4" /> ENVIAR PROCEDIMENTO
        </>
      )}
    </button>
  );
}

export function ForgotForm() {
  const [state, formAction] = useFormState<ActionResult<{ link?: string }> | null, FormData>(
    forgotPasswordAction,
    null,
  );

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border-emerald-200 bg-emerald-50 p-4">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div className="text-sm text-emerald-800">
            <p className="font-semibold">Procedimento de recuperação iniciado.</p>
            <p className="mt-1 text-emerald-700">
              Se o e-mail informado estiver cadastrado, você receberá as instruções para
              criar uma nova senha. O link é válido por 30 minutos.
            </p>
          </div>
        </div>

        {/* Em desenvolvimento o link é exibido para permitir testar o fluxo. */}
        {state.data?.link && (
          <div className="rounded-lg border-brand-200 bg-brand-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              Ambiente de desenvolvimento — link gerado
            </p>
            <Link
              href={state.data.link}
              className="mt-1 block break-all text-sm font-medium text-brand-700 underline hover:text-brand-800"
            >
              {state.data.link}
            </Link>
            <p className="mt-2 text-xs text-brand-600">
              Em produção este link seria enviado por e-mail.
            </p>
          </div>
        )}

        <Link href="/login" className="btn-secondary w-full">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <FormAlert kind="error" message={state.error} />}

      <div>
        <label htmlFor="email" className="label">
          E-mail cadastrado
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoFocus
          autoComplete="email"
          placeholder="seu@email.com"
          className="input"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
