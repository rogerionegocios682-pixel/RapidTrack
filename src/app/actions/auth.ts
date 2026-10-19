'use server';

import { redirect } from 'next/navigation';
import {
  authenticate,
  clearSessionCookie,
  createPasswordReset,
  resetPasswordWithToken,
  setSessionCookie,
} from '@/lib/auth';
import { registerUser, validateRegistration } from '@/lib/repo/users';
import { write } from '@/db';
import { auditRow } from '@/lib/audit';
import { clean, normalizeEmail } from '@/lib/utils';
import { guard, type ActionResult } from './guard';

export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const email = normalizeEmail(formData.get('email'));
  const password = String(formData.get('password') ?? '');

  const result = await guard(async () => {
    const auth = await authenticate(email, password);
    if (!auth.ok || !auth.user) throw new Error(auth.error ?? 'Falha no login.');

    await setSessionCookie({ ...auth.user, password_hash: '' });

    // Registra o login na auditoria.
    await write((db) => {
      auditRow(db, {
        user: { id: auth.user!.id, name: auth.user!.name },
        action: 'login',
        entity: 'user',
        entityId: auth.user!.id,
        description: `Login realizado por ${auth.user!.email}`,
      });
    });

    return auth.user;
  });

  if (!result.ok) return result;
  redirect('/dashboard');
  // `redirect` lança internamente; o return abaixo satisfaz o tipo de retorno.
  return { ok: true };
}

export async function registerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const input = {
    name: clean(formData.get('name'), 150),
    email: normalizeEmail(formData.get('email')),
    phone: clean(formData.get('phone'), 30),
    password: String(formData.get('password') ?? ''),
    confirmPassword: String(formData.get('confirmPassword') ?? ''),
  };

  const validationError = validateRegistration(input);
  if (validationError) return { ok: false, error: validationError };

  const result = await guard(async () => {
    const user = await registerUser(input);
    await setSessionCookie({ ...user, password_hash: '' });
    return user;
  });

  if (!result.ok) return result;
  redirect('/dashboard');
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  clearSessionCookie();
  redirect('/login');
}

/**
 * Recuperação de senha.
 * Não revela se o e-mail existe (evita enumeração de usuários).
 * Em desenvolvimento, devolve o link diretamente para permitir o teste
 * do fluxo completo; em produção o link seria enviado por e-mail.
 */
export async function forgotPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<{ link?: string }>> {
  const email = normalizeEmail(formData.get('email'));
  if (!email) return { ok: false, error: 'Informe seu e-mail.' };

  return guard(async () => {
    const token = await createPasswordReset(email);
    // Resposta sempre igual, exista ou não o e-mail.
    if (!token) return { link: undefined };

    const link = `/redefinir-senha?token=${encodeURIComponent(token)}`;
    if (process.env.NODE_ENV !== 'production') {
      console.info('[recuperação de senha] link gerado para %s: %s', email, link);
    }
    return { link: process.env.NODE_ENV === 'production' ? undefined : link };
  });
}

export async function resetPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirmPassword = String(formData.get('confirmPassword') ?? '');

  if (password !== confirmPassword) return { ok: false, error: 'As senhas não conferem.' };

  const result = await guard(async () => {
    const res = await resetPasswordWithToken(token, password);
    if (!res.ok) throw new Error(res.error ?? 'Falha ao redefinir a senha.');
    return true;
  });

  if (!result.ok) return result;
  redirect('/login?reset=1');
  return { ok: true };
}

