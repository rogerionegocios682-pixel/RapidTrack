/**
 * Repositório de Usuários (perfil, cadastro público e gestão pelo admin).
 */
import { query, queryOne, write, runSql, sqlList, sqlLit, sqlSet } from '@/db';
import { auditRow } from '@/lib/audit';
import { hashPassword } from '@/lib/utils';
import { newId, nowIso, clean, normalizeEmail, cleanDigits } from '@/lib/utils';
import type { SessionUser, User, UserRole, UserStatus } from '@/lib/types';

export interface RegisterInput {
  name: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
}

const MAX_USERS_HINT =
  'Não foi possível concluir o cadastro. Verifique os dados informados.';

/** Valida os dados de cadastro e devolve mensagem de erro, se houver. */
export function validateRegistration(input: RegisterInput): string | null {
  const name = clean(input.name, 150);
  const email = normalizeEmail(input.email);
  const password = String(input.password ?? '');

  if (name.length < 3) return 'Informe seu nome completo.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Informe um e-mail válido.';
  if (input.phone && cleanDigits(input.phone).length < 10)
    return 'Informe um telefone válido com DDD.';
  if (password.length < 6) return 'A senha deve ter ao menos 6 caracteres.';
  if (password !== input.confirmPassword) return 'As senhas não conferem.';
  return null;
}

/**
 * Auto-cadastro. O primeiro usuário do sistema torna-se Administrador;
 * os seguintes entram como Operador (ajustável depois pelo admin).
 */
export async function registerUser(input: RegisterInput): Promise<SessionUser> {
  const error = validateRegistration(input);
  if (error) throw new Error(error);

  const email = normalizeEmail(input.email);
  const name = clean(input.name, 150);
  const id = newId();
  const ts = nowIso();

  let created: User | null = null;

  // Checagens ANTES da transação (o callback de `write` não lê resultados
  // sob Postgres). O e-mail duplicado também é barrado pelo índice único.
  const dup = await queryOne<{ id: string }>(
    'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
    [email],
  );
  if (dup) throw new Error('Este e-mail já está cadastrado.');

  const countRes = await queryOne<{ n: string | number }>('SELECT COUNT(*) AS n FROM users');
  const total = Number(countRes?.n ?? 0);
  const role: UserRole = total === 0 ? 'admin' : 'operator';

  await write((db) => {
    runSql(
      db,
      `INSERT INTO users (id, name, email, phone, password_hash, role, status, motoboy_id, last_login_at, created_at, updated_at)
       VALUES (${sqlList([
         id,
         name,
         email,
         clean(input.phone, 30) || null,
         hashPassword(String(input.password)),
         role,
         'active',
         null,
         null,
         ts,
         ts,
       ])})`,
    );

    auditRow(db, {
      user: { id, name },
      action: 'create',
      entity: 'user',
      entityId: id,
      description: total === 0
        ? `Primeiro usuário criado como Administrador: "${name}"`
        : `Novo usuário cadastrado: "${name}" (Operador)`,
      metadata: { role },
    });

    created = {
      id,
      name,
      email,
      phone: clean(input.phone, 30) || null,
      password_hash: '',
      role,
      status: 'active',
      motoboy_id: null,
      permissions: null,
      last_login_at: null,
      created_at: ts,
      updated_at: ts,
    };
  });

  if (!created) throw new Error(MAX_USERS_HINT);
  const { password_hash: _ph, ...safe } = created as User;
  void _ph;
  return safe;
}

export async function getUser(id: string): Promise<User | null> {
  return queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return queryOne<User>('SELECT * FROM users WHERE email = ?', [normalizeEmail(email)]);
}

export interface ProfileInput {
  name: string;
  phone?: string;
}

export async function updateProfile(
  userId: string,
  input: ProfileInput,
  actor: SessionUser,
): Promise<void> {
  const name = clean(input.name, 150);
  if (name.length < 3) throw new Error('Informe seu nome completo.');

  await write((db) => {
    runSql(
      db,
      `UPDATE users SET ${sqlSet({
        name,
        phone: clean(input.phone, 30) || null,
        updated_at: nowIso(),
      })} WHERE id = ${sqlLit(userId)}`,
    );
    auditRow(db, {
      user: actor,
      action: 'update',
      entity: 'user',
      entityId: userId,
      description: 'Atualizou o próprio perfil',
    });
  });
}

/** Troca de senha exigindo a senha atual (evita sequestro de sessão). */
export async function changeOwnPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
  actor: SessionUser,
): Promise<void> {
  if (newPassword.length < 6) throw new Error('A nova senha deve ter ao menos 6 caracteres.');
  if (newPassword !== confirmPassword) throw new Error('As senhas não conferem.');

  const user = await getUser(userId);
  if (!user) throw new Error('Usuário não encontrado.');

  const { verifyPassword } = await import('@/lib/utils');
  if (!verifyPassword(currentPassword, user.password_hash)) {
    throw new Error('A senha atual está incorreta.');
  }

  await write((db) => {
    runSql(
      db,
      `UPDATE users SET ${sqlSet({
        password_hash: hashPassword(newPassword),
        updated_at: nowIso(),
      })} WHERE id = ${sqlLit(userId)}`,
    );
    auditRow(db, {
      user: actor,
      action: 'update',
      entity: 'user',
      entityId: userId,
      description: 'Alterou a própria senha',
    });
  });
}

/* ---------------------------------------------------------------------------
 * Gestão de usuários (somente Administrador)
 * -------------------------------------------------------------------------*/

export interface UserListRow extends Omit<User, 'password_hash'> {
  motoboy_name: string | null;
}

export async function listUsers(): Promise<UserListRow[]> {
  return query<UserListRow>(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.status, u.motoboy_id,
            u.permissions, u.last_login_at, u.created_at, u.updated_at,
            m.name AS motoboy_name
       FROM users u
       LEFT JOIN motoboys m ON m.id = u.motoboy_id
      ORDER BY u.role ASC, u.name COLLATE NOCASE ASC`,
  );
}

/** Busca um usuário pelo id (com o hash da senha). */
export async function getUserById(id: string): Promise<User | null> {
  return queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
}

/**
 * Atualiza as permissões individuais de um usuário.
 * `permissions = null` remove o override e volta a valer o papel.
 * Um usuário não pode alterar as próprias permissões (evita auto-promoção).
 */
export async function updateUserPermissions(
  userId: string,
  permissions: string[] | null,
  actor: SessionUser,
): Promise<void> {
  if (userId === actor.id) {
    throw new Error('Você não pode alterar as suas próprias permissões.');
  }
  const user = await getUser(userId);
  if (!user) throw new Error('Usuário não encontrado.');

  const value = permissions && permissions.length ? JSON.stringify(permissions) : null;

  await write((db) => {
    runSql(
      db,
      `UPDATE users SET ${sqlSet({
        permissions: value,
        updated_at: nowIso(),
      })} WHERE id = ${sqlLit(userId)}`,
    );
    auditRow(db, {
      user: actor,
      action: 'update',
      entity: 'user',
      entityId: userId,
      description: value
        ? `Definiu ${permissions!.length} permissão(ões) para "${user.name}"`
        : `Restaurou as permissões do papel para "${user.name}"`,
      metadata: { permissions: value },
    });
  });
}

/**
 * Cria um novo usuário (uso administrativo).
 * Não cria administradores automaticamente: o papel padrão é 'operator'
 * e o usuário nasce sem permissões operacionais além do que o papel concede.
 */
export async function createUserByAdmin(
  input: {
    name: string;
    email: string;
    phone?: string;
    password: string;
    role: UserRole;
    status: UserStatus;
    motoboy_id?: string | null;
    permissions?: string[] | null;
  },
  actor: SessionUser,
): Promise<SessionUser> {
  const email = normalizeEmail(input.email);
  const name = clean(input.name, 150);

  if (name.length < 3) throw new Error('Informe o nome completo.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.');
  if (input.password.length < 6) throw new Error('A senha deve ter ao menos 6 caracteres.');

  const dup = await queryOne<{ id: string }>(
    'SELECT id FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1',
    [email],
  );
  if (dup) throw new Error('Este e-mail já está cadastrado.');

  const id = newId();
  const ts = nowIso();
  const permissions =
    input.permissions && input.permissions.length ? JSON.stringify(input.permissions) : null;

  await write((db) => {
    runSql(
      db,
      `INSERT INTO users (id, name, email, phone, password_hash, role, status, motoboy_id, permissions, last_login_at, created_at, updated_at)
       VALUES (${sqlList([
         id,
         name,
         email,
         clean(input.phone, 30) || null,
         hashPassword(input.password),
         input.role,
         input.status,
         input.role === 'motoboy' ? input.motoboy_id ?? null : null,
         permissions,
         null,
         ts,
         ts,
       ])})`,
    );
    auditRow(db, {
      user: actor,
      action: 'create',
      entity: 'user',
      entityId: id,
      description: `Criou o usuário "${name}" (${input.role})`,
      metadata: { role: input.role, status: input.status },
    });
  });

  return {
    id,
    name,
    email,
    phone: clean(input.phone, 30) || null,
    role: input.role,
    status: input.status,
    motoboy_id: input.role === 'motoboy' ? input.motoboy_id ?? null : null,
    permissions,
    last_login_at: null,
    created_at: ts,
    updated_at: ts,
  };
}

/**
 * Atualiza os dados cadastrais de um usuário (nome, e-mail, telefone, papel,
 * situação e vínculo com motoboy) sem mexer nas permissões individuais.
 */
export async function updateUserDetails(
  userId: string,
  input: {
    name: string;
    email: string;
    phone?: string;
    role: UserRole;
    status: UserStatus;
    motoboy_id?: string | null;
  },
  actor: SessionUser,
): Promise<void> {
  const user = await getUser(userId);
  if (!user) throw new Error('Usuário não encontrado.');
  if (userId === actor.id && input.status === 'inactive') {
    throw new Error('Você não pode desativar o seu próprio usuário.');
  }

  const name = clean(input.name, 150);
  const email = normalizeEmail(input.email);
  if (name.length < 3) throw new Error('Informe o nome completo.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.');

  const dup = await queryOne<{ id: string }>(
    'SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id <> ? LIMIT 1',
    [email, userId],
  );
  if (dup) throw new Error('Já existe outro usuário com este e-mail.');

  await write((db) => {
    runSql(
      db,
      `UPDATE users SET ${sqlSet({
        name,
        email,
        phone: clean(input.phone, 30) || null,
        role: input.role,
        status: input.status,
        motoboy_id: input.role === 'motoboy' ? input.motoboy_id ?? null : null,
        updated_at: nowIso(),
      })} WHERE id = ${sqlLit(userId)}`,
    );
    auditRow(db, {
      user: actor,
      action: 'update',
      entity: 'user',
      entityId: userId,
      description: `Atualizou o usuário "${name}"`,
      metadata: { role: input.role, status: input.status },
    });
  });
}

export async function updateUserRoleAndStatus(
  userId: string,
  input: { role: UserRole; status: UserStatus; motoboy_id?: string | null },
  actor: SessionUser,
): Promise<void> {
  if (userId === actor.id && input.status === 'inactive') {
    throw new Error('Você não pode desativar o seu próprio usuário.');
  }
  const user = await getUser(userId);
  if (!user) throw new Error('Usuário não encontrado.');

  await write((db) => {
    runSql(
      db,
      `UPDATE users SET ${sqlSet({
        role: input.role,
        status: input.status,
        motoboy_id: input.role === 'motoboy' ? input.motoboy_id ?? null : null,
        updated_at: nowIso(),
      })} WHERE id = ${sqlLit(userId)}`,
    );
    auditRow(db, {
      user: actor,
      action: 'update',
      entity: 'user',
      entityId: userId,
      description: `Alterou o usuário "${user.name}" para ${input.role}/${input.status}`,
      metadata: { role: input.role, status: input.status },
    });
  });
}
