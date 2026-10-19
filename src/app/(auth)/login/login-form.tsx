'use client';

import { useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { Eye, EyeOff, Loader2, Lock, LogIn, Mail } from 'lucide-react';
import { loginAction } from '@/app/actions/auth';
import { FormAlert } from '@/components/auth-layout';
import type { ActionResult } from '@/app/actions/guard';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending || disabled}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> Entrando...
        </>
      ) : (
        <>
          <LogIn className="h-4 w-4" /> ENTRAR
        </>
      )}
    </button>
  );
}

export function LoginForm({ info }: { info?: string }) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(loginAction, null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});

  // Erros de validação do front-end.
  const emailError = !email.trim()
    ? 'Informe o seu e-mail.'
    : !EMAIL_RE.test(email.trim())
      ? 'Informe um e-mail válido.'
      : '';
  const passwordError = !password ? 'Informe a sua senha.' : '';

  const hasError = Boolean(emailError || passwordError);
  // Só mostra o erro de um campo depois que o usuário o tocou (evita poluir ao abrir).
  const showEmailError = touched.email && emailError;
  const showPasswordError = touched.password && passwordError;

  return (
    <form
      action={formAction}
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        // Marca todos como tocados e bloqueia o envio se houver erro.
        setTouched({ email: true, password: true });
        if (hasError) e.preventDefault();
      }}
    >
      {info && <FormAlert kind="success" message={info} />}
      {state?.error && <FormAlert kind="error" message={state.error} />}

      <div>
        <label htmlFor="email" className="label">
          E-mail
          <span className="text-rose-500" aria-hidden>
            {' '}*
          </span>
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            aria-required="true"
            aria-label="E-mail"
            autoFocus
            placeholder="seu@email.com"
            className={`input pl-10 ${showEmailError ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/25' : ''}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            aria-invalid={showEmailError ? true : undefined}
          />
        </div>
        {showEmailError && <p className="field-error">{emailError}</p>}
      </div>

      <div>
        <label htmlFor="password" className="label">
          Senha
          <span className="text-rose-500" aria-hidden>
            {' '}*
          </span>
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            aria-required="true"
            aria-label="Senha"
            placeholder="••••••"
            className={`input pl-10 pr-11 ${showPasswordError ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/25' : ''}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, password: true }))}
            aria-invalid={showPasswordError ? true : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-400 transition hover:text-ink-700"
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={showPassword}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {showPasswordError && <p className="field-error">{passwordError}</p>}
      </div>

      <SubmitButton disabled={hasError} />
    </form>
  );
}
