'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Loader2, UserPlus } from 'lucide-react';
import { registerAction } from '@/app/actions/auth';
import { FormAlert } from '@/components/auth-layout';
import type { ActionResult } from '@/app/actions/guard';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Cadastrando...
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4" /> CRIAR CADASTRO
        </>
      )}
    </button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(registerAction, null);

  return (
    <form action={formAction} className="space-y-4">
      {state?.error && <FormAlert kind="error" message={state.error} />}

      <div>
        <label htmlFor="name" className="label">
          Nome completo *
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoFocus
          autoComplete="name"
          placeholder="Ex.: Maria Souza"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="email" className="label">
          E-mail *
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="seu@email.com"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="phone" className="label">
          Telefone
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="(81) 99999-0000"
          className="input"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="password" className="label">
            Senha *
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Mínimo 6 caracteres"
            className="input"
          />
        </div>
        <div>
          <label htmlFor="confirmPassword" className="label">
            Confirmar senha *
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Repita a senha"
            className="input"
          />
        </div>
      </div>

      <p className="rounded-lg bg-ink-50 p-3 text-xs text-ink-500">
        O primeiro usuário cadastrado no sistema torna-se <strong>Administrador</strong>. Os
        demais entram como <strong>Operador</strong> e podem ter o perfil ajustado depois.
      </p>

      <SubmitButton />
    </form>
  );
}
