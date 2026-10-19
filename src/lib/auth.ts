/**
 * Autenticação e controle de sessão.
 * ---------------------------------------------------------------------------
 * - Sessão assinada (JWT HS256 via `jose`) guardada em cookie HttpOnly,
 *   SameSite=Lax e Secure em produção. O navegador nunca lê o token.
 * - O token carrega apenas { sub, role, name }; os dados sensíveis são
 *   sempre relidos do banco a cada requisição (revogação imediata).
 * - RBAC centralizado: cada server action chama `requirePermission`.
 */
import 'server-only';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { queryOne, write, runSql, sqlList, sqlLit, sqlSet } from '@/db';
import { newId, nowIso, normalizeEmail, hashPassword, verifyPassword } from '@/lib/utils';
import type { SessionUser, User, UserRole } from '@/lib/types';

export const SESSION_COOKIE = 'delivery_os_session';
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 horas

/** Em produção exige SESSION_SECRET; em dev usa fallback determinístico. */
function secretKey(): Uint8Array {
  const secret =
    process.env.SESSION_SECRET ||
    'delivery-os-dev-secret-change-me-in-production-0123456789';
  return new TextEncoder().encode(secret);
}

/* ===========================================================================
 * Sessão
 * ===========================================================================*/

export interface SessionPayload {
  sub: string;
  role: UserRole;
  name: string;
}

export async function createSessionToken(user: User): Promise<string> {
  return new SignJWT({ role: user.role, name: user.name })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function readSessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    if (!payload.sub || !payload.role) return null;
    return {
      sub: String(payload.sub),
      role: payload.role as UserRole,
      name: String(payload.name ?? ''),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(user: User): Promise<void> {
  const token = await createSessionToken(user);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(): void {
  cookies().delete(SESSION_COOKIE);
}

function toSessionUser(user: User): SessionUser {
  const { password_hash: _ignored, ...rest } = user;
  void _ignored;
  return rest;
}

/** Usuário autenticado da requisição atual, ou null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await readSessionToken(token);
  if (!payload) return null;

  // Relê do banco: garante que usuário desativado/removido perca acesso na hora.
  const user = await queryOne<User>('SELECT * FROM users WHERE id = ?', [payload.sub]);
  if (!user || user.status !== 'active') return null;
  return toSessionUser(user);
}

/** Igual a getCurrentUser, mas lança erro se não houver sessão válida. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('Sessão expirada. Faça login novamente.');
  return user;
}

/* ===========================================================================
 * Permissões (RBAC)
 * ===========================================================================*/

export type Permission =
  | 'dashboard.view'
  | 'deliveries.view'
  | 'deliveries.view.all'
  | 'deliveries.create'
  | 'deliveries.update'
  | 'deliveries.change_status'
  | 'deliveries.cancel'
  | 'deliveries.delete'
  | 'companies.view'
  | 'companies.manage'
  | 'motoboys.view'
  | 'motoboys.manage'
  | 'neighborhoods.view'
  | 'neighborhoods.manage'
  | 'fees.view'
  | 'fees.manage'
  | 'reports.view'
  | 'messages.view'
  | 'messages.send'
  | 'announcements.send'
  | 'audit.view'
  | 'users.manage'
  | 'settings.manage';

const ALL_PERMISSIONS: Permission[] = [
  'dashboard.view',
  'deliveries.view',
  'deliveries.view.all',
  'deliveries.create',
  'deliveries.update',
  'deliveries.change_status',
  'deliveries.cancel',
  'deliveries.delete',
  'companies.view',
  'companies.manage',
  'motoboys.view',
  'motoboys.manage',
  'neighborhoods.view',
  'neighborhoods.manage',
  'fees.view',
  'fees.manage',
  'reports.view',
  'messages.view',
  'messages.send',
  'announcements.send',
  'audit.view',
  'users.manage',
  'settings.manage',
];

/** Lista canônica de todas as permissões (usada na matriz de permissões da UI). */
export const PERMISSIONS: Permission[] = ALL_PERMISSIONS;

/** Matriz de permissões por papel. */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ALL_PERMISSIONS,

  // Operador: gestão operacional completa, sem exclusões destrutivas de
  // cadastros nem administração de usuários.
  operator: [
    'dashboard.view',
    'deliveries.view',
    'deliveries.view.all',
    'deliveries.create',
    'deliveries.update',
    'deliveries.change_status',
    'deliveries.cancel',
    'companies.view',
    'companies.manage',
    'motoboys.view',
    'motoboys.manage',
    'neighborhoods.view',
    'neighborhoods.manage',
    'fees.view',
    'fees.manage',
    'reports.view',
    'messages.view',
    'messages.send',
    'announcements.send',
  ],

  // Motoboy: vê apenas as suas próprias corridas e usa a comunicação interna.
  motoboy: [
    'dashboard.view',
    'deliveries.view',
    'deliveries.change_status',
    'messages.view',
    'messages.send',
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * Permissões efetivas de um usuário.
 * ---------------------------------------------------------------------------
 * Regra: se o usuário tem permissões individuais definidas (`permissions`),
 * elas SUBSTITUEM as do papel. Caso contrário, usa-se a matriz do papel.
 * Um override só é considerado válido se for uma lista não vazia de permissões
 * conhecidas — do contrário, cai no papel (evita usuário sem acesso por erro).
 */
export function getEffectivePermissions(user: {
  role: UserRole;
  permissions?: string | null;
}): Permission[] {
  const override = parsePermissions(user.permissions);
  if (override && override.length > 0) return override;
  return ROLE_PERMISSIONS[user.role] ?? [];
}

/** Converte a coluna JSON em uma lista de permissões válidas (ou null). */
export function parsePermissions(raw: string | null | undefined): Permission[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter((p): p is Permission =>
      (ALL_PERMISSIONS as string[]).includes(p),
    );
    return valid.length ? valid : null;
  } catch {
    return null;
  }
}

/** Verifica uma permissão usando as permissões efetivas (override > papel). */
export function userHasPermission(
  user: { role: UserRole; permissions?: string | null },
  permission: Permission,
): boolean {
  return getEffectivePermissions(user).includes(permission);
}

export class AuthError extends Error {
  status = 401;
}
export class ForbiddenError extends Error {
  status = 403;
}

/** Garante sessão + permissão; lança erro padronizado caso contrário. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!userHasPermission(user, permission)) {
    throw new ForbiddenError(
      'Você não tem permissão para executar esta ação.',
    );
  }
  return user;
}

/**
 * Restringe o motoboy aos próprios registros.
 * Devolve um filtro SQL opcional para ser aplicado nas consultas.
 */
export function motoboyScope(user: SessionUser): { sql: string; params: string[] } {
  if (user.role === 'motoboy') {
    if (!user.motoboy_id) return { sql: ' AND 1 = 0', params: [] };
    return { sql: ' AND d.motoboy_id = ?', params: [user.motoboy_id] };
  }
  return { sql: '', params: [] };
}

/* ===========================================================================
 * Login / cadastro / recuperação de senha
 * ===========================================================================*/

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: SessionUser;
}

export async function authenticate(email: string, password: string): Promise<AuthResult> {
  const mail = normalizeEmail(email);
  if (!mail || !password) return { ok: false, error: 'Informe e-mail e senha.' };

  const user = await queryOne<User>('SELECT * FROM users WHERE email = ?', [mail]);

  // Mensagem genérica: não revela se o e-mail existe.
  const genericError = 'E-mail ou senha inválidos.';
  if (!user) {
    // Executa um hash "de mentira" para igualar o tempo de resposta.
    verifyPassword(password, hashPassword('placeholder'));
    return { ok: false, error: genericError };
  }
  if (!verifyPassword(password, user.password_hash)) {
    return { ok: false, error: genericError };
  }
  if (user.status !== 'active') {
    return { ok: false, error: 'Usuário inativo. Procure o administrador.' };
  }

  await write((db) => {
    runSql(
      db,
      `UPDATE users SET ${sqlSet({
        last_login_at: nowIso(),
        updated_at: nowIso(),
      })} WHERE id = ${sqlLit(user.id)}`,
    );
  });

  return { ok: true, user: toSessionUser(user) };
}

/** Cria a solicitação de recuperação e devolve o token em claro (para o link). */
export async function createPasswordReset(email: string): Promise<string | null> {
  const mail = normalizeEmail(email);
  const user = await queryOne<User>('SELECT * FROM users WHERE email = ?', [mail]);
  if (!user || user.status !== 'active') return null;

  const token = newId() + newId().replace(/-/g, '');
  const tokenHash = hashPassword(token); // armazena apenas o hash do token
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min

  await write((db) => {
    // Invalida pedidos anteriores ainda pendentes.
    runSql(
      db,
      `UPDATE password_resets SET used_at = ${sqlLit(nowIso())}
        WHERE user_id = ${sqlLit(user.id)} AND used_at IS NULL`,
    );
    runSql(
      db,
      `INSERT INTO password_resets (id, user_id, token_hash, expires_at, used_at, created_at)
       VALUES (${sqlList([newId(), user.id, tokenHash, expiresAt, null, nowIso()])})`,
    );
  });

  return token;
}

/** Consome o token e troca a senha. */
export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!token) return { ok: false, error: 'Token inválido.' };
  if (newPassword.length < 6)
    return { ok: false, error: 'A senha deve ter ao menos 6 caracteres.' };

  const pending = await hashPasswordLookup(token);
  if (!pending) return { ok: false, error: 'Link de recuperação inválido ou expirado.' };

  await write((db) => {
    runSql(
      db,
      `UPDATE users SET ${sqlSet({
        password_hash: hashPassword(newPassword),
        updated_at: nowIso(),
      })} WHERE id = ${sqlLit(pending.user_id)}`,
    );
    runSql(
      db,
      `UPDATE password_resets SET used_at = ${sqlLit(nowIso())} WHERE id = ${sqlLit(pending.id)}`,
    );
  });

  return { ok: true };
}

interface ResetRow {
  id: string;
  user_id: string;
}

/**
 * Localiza o reset válido comparando o token em claro com cada hash pendente.
 * O número de pedidos pendentes por usuário é sempre ≤ 1 (invalidados antes),
 * então a comparação é barata.
 */
async function hashPasswordLookup(token: string): Promise<ResetRow | null> {
  const { query: queryAll } = await import('@/db');
  const rows = await queryAll<{ id: string; user_id: string; token_hash: string; expires_at: string }>(
    `SELECT id, user_id, token_hash, expires_at
       FROM password_resets
      WHERE used_at IS NULL AND expires_at > ?`,
    [nowIso()],
  );
  for (const row of rows) {
    if (verifyPassword(token, row.token_hash)) {
      return { id: row.id, user_id: row.user_id };
    }
  }
  return null;
}
