'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { KeyRound, Loader2 } from 'lucide-react';
import { resetPasswordAction } from '@/app/actions/auth';
import { FormAlert } from '@/components/auth-layout';
import type { ActionResult } from '@/app/actions/guard';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
        </>
      ) : (
        <>
          <KeyRound className="h-4 w-4" /> SALVAR NOVA SENHA
        </>
      )}
    </button>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(
    resetPasswordAction,
    null,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <FormAlert kind="error" message={state.error} />}

      <input type="hidden" name="token" value={token} />

      <div>
        <label htmlFor="password" className="label">
          Nova senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoFocus
          autoComplete="new-password"
          placeholder="Mínimo 6 caracteres"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="label">
          Confirmar nova senha
        </label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="Repita a nova senha"
          className="input"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
