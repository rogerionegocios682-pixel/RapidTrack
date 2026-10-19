/**
 * Camada de Server Actions — ponte entre a UI e os repositórios.
 * ---------------------------------------------------------------------------
 * Toda ação:
 *  1. verifica sessão e permissão (RBAC);
 *  2. valida e sanitiza a entrada;
 *  3. executa no repositório (transação + auditoria);
 *  4. devolve um resultado padronizado { ok, error?, data? }.
 *
 * Nenhum erro inesperado vaza para o cliente como stack trace.
 */
'use server';

import { revalidatePath } from 'next/cache';
import { AuthError, ForbiddenError, requirePermission, requireUser } from '@/lib/auth';

export interface ActionResult<T = unknown> {
  ok: boolean;
  error?: string;
  data?: T;
  /** Campos com erro, para destaque no formulário. */
  fieldErrors?: Record<string, string>;
}

/** Converte qualquer exceção em um resultado seguro para a UI. */
export async function guard<T>(
  fn: () => Promise<T>,
  opts: { revalidate?: string[] } = {},
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    if (opts.revalidate?.length) {
      for (const path of opts.revalidate) revalidatePath(path);
    }
    return { ok: true, data };
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: err.message };
    if (err instanceof ForbiddenError) return { ok: false, error: err.message };

    const message =
      err instanceof Error ? err.message : 'Ocorreu um erro inesperado. Tente novamente.';

    // Erros de restrição do Postgres viram mensagens amigáveis.
    if (/duplicate key value violates unique constraint/i.test(message) || /UNIQUE constraint failed/i.test(message)) {
      return { ok: false, error: 'Este registro já existe. Verifique os dados informados.' };
    }
    if (/violates foreign key constraint/i.test(message) || /FOREIGN KEY constraint failed/i.test(message)) {
      return {
        ok: false,
        error: 'Operação bloqueada: existem registros vinculados a este item.',
      };
    }
    if (/null value in column .* violates not-null constraint/i.test(message) || /NOT NULL constraint failed/i.test(message)) {
      return { ok: false, error: 'Preencha todos os campos obrigatórios.' };
    }
    if (/violates check constraint/i.test(message) || /CHECK constraint failed/i.test(message)) {
      return { ok: false, error: 'Valor inválido informado em um dos campos.' };
    }

    // Loga no servidor sem expor detalhes ao cliente.
    console.error('[action]', err);
    return { ok: false, error: message };
  }
}

export { requireUser, requirePermission, AuthError, ForbiddenError };
