/**
 * Utilitários exclusivos do SERVIDOR (Node.js).
 * ---------------------------------------------------------------------------
 * Contém geração de IDs/tokens e hash de senha — APIs de `node:crypto` que NÃO
 * podem ser empacotadas no bundle do cliente.
 *
 * As funções de formatação (dinheiro, datas, sanitização) vivem em
 * `lib/format.ts` e são reexportadas aqui por conveniência, para que o código
 * de servidor continue importando tudo de `@/lib/utils`.
 */
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Reexporta os utilitários isentos de Node (seguros no cliente).
export * from './format';

/* ---------------------------------------------------------------------------
 * IDs e tokens
 * -------------------------------------------------------------------------*/
export function newId(): string {
  return randomUUID();
}

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/* ---------------------------------------------------------------------------
 * Timestamps — sempre em ISO-8601 UTC
 * -------------------------------------------------------------------------*/
export function nowIso(): string {
  return new Date().toISOString();
}

/* ---------------------------------------------------------------------------
 * Senhas — scrypt (nativo do Node, sem dependência compilada)
 * -------------------------------------------------------------------------*/
const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const KEYLEN = 64;

/** Gera o hash no formato `scrypt$N$r$p$salt$hash` (base64). */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_r,
    p: SCRYPT_p,
  });
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_r,
    SCRYPT_p,
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$');
}

/** Verificação em tempo constante — evita ataques de temporização. */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

    const [, n, r, p, saltB64, hashB64] = parts;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(hashB64, 'base64');

    const actual = scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });

    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------------------
 * SQL helpers
 * -------------------------------------------------------------------------*/

/** Escapa curingas de LIKE para buscas literais. */
export function likeEscape(value: string): string {
  return value.replace(/[%_]/g, (m) => `\\${m}`);
}
