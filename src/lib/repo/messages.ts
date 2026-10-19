/**
 * Comunicação Interna — mensagens, comunicados e avisos.
 * Suporta envio para: um usuário, todos, operadores ou motoboys.
 */
import { query, queryOne, write, runSql, sqlList, sqlLit } from '@/db';
import { auditRow } from '@/lib/audit';
import { newId, nowIso, clean } from '@/lib/utils';
import type {
  InternalMessageRow,
  MessageAudience,
  SessionUser,
  UserRole,
} from '@/lib/types';

export interface SendMessageInput {
  receiver_id?: string | null;
  audience: MessageAudience;
  subject?: string;
  message: string;
  is_announcement?: boolean;
}

/** Converte o público-alvo em uma condição SQL sobre o destinatário. */
function audienceFilter(audience: MessageAudience, userId: string, role: UserRole) {
  switch (audience) {
    case 'all':
      // Visível a todos: destinatário nulo com audience 'all'.
      return { cond: `m.audience = 'all' AND m.receiver_id IS NULL`, params: [] as string[] };
    case 'operators':
      return {
        cond: `m.audience = 'operators' AND m.receiver_id IS NULL`,
        params: [] as string[],
      };
    case 'motoboys':
      return {
        cond: `m.audience = 'motoboys' AND m.receiver_id IS NULL`,
        params: [] as string[],
      };
    case 'user':
    default:
      return {
        cond: `(m.receiver_id = ? OR m.sender_id = ?)`,
        params: [userId, userId],
      };
  }
}

/**
 * Lista as conversas visíveis ao usuário:
 *  - mensagens diretas (enviadas ou recebidas)
 *  - comunicados de grupo compatíveis com o papel do usuário
 *    (todos verão 'all'; operadores não veem 'motoboys' e vice-versa)
 */
export async function listMessages(
  user: SessionUser,
  opts: { onlyUnread?: boolean; search?: string; limit?: number } = {},
): Promise<(InternalMessageRow & { is_read: number })[]> {
  const conds: string[] = [];
  const params: string[] = [];

  const direct = '(m.receiver_id = ? OR m.sender_id = ?)';
  conds.push(direct);
  params.push(user.id, user.id);

  // Comunicados de grupo.
  const audiences: MessageAudience[] = ['all'];
  if (user.role === 'admin') audiences.push('operators', 'motoboys');
  else if (user.role === 'operator') audiences.push('operators');
  else if (user.role === 'motoboy') audiences.push('motoboys');

  conds.push(
    `(m.receiver_id IS NULL AND m.audience IN (${audiences.map(() => '?').join(',')}))`,
  );
  params.push(...audiences);

  let where = `WHERE (${conds.join(' OR ')})`;

  if (opts.onlyUnread) {
    where += ` AND m.read_at IS NULL AND m.sender_id <> ?`;
    params.push(user.id);
  }
  if (opts.search) {
    where += ` AND (m.message LIKE ? OR m.subject LIKE ? OR s.name LIKE ?)`;
    params.push(`%${opts.search}%`, `%${opts.search}%`, `%${opts.search}%`);
  }

  return query<InternalMessageRow & { is_read: number }>(
    `SELECT m.*, s.name AS sender_name, r.name AS receiver_name,
            CASE WHEN m.read_at IS NULL THEN 0 ELSE 1 END AS is_read
       FROM internal_messages m
       JOIN users s ON s.id = m.sender_id
       LEFT JOIN users r ON r.id = m.receiver_id
       ${where}
      ORDER BY m.created_at DESC
      LIMIT ?`,
    [...params, opts.limit ?? 200],
  );
}

/** Contagem de não lidas (usada no badge do menu) — em tempo real via SSE. */
export async function countUnread(user: SessionUser): Promise<number> {
  const audiences: MessageAudience[] = ['all'];
  if (user.role === 'admin') audiences.push('operators', 'motoboys');
  else if (user.role === 'operator') audiences.push('operators');
  else if (user.role === 'motoboy') audiences.push('motoboys');

  const row = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM internal_messages m
      WHERE m.read_at IS NULL
        AND m.sender_id <> ?
        AND (
          m.receiver_id = ?
          OR (m.receiver_id IS NULL AND m.audience IN (${audiences.map(() => '?').join(',')}))
        )`,
    [user.id, user.id, ...audiences],
  );
  return Number(row?.n ?? 0);
}

export async function sendMessage(
  input: SendMessageInput,
  user: SessionUser,
): Promise<string> {
  const text = clean(input.message, 2000);
  if (!text) throw new Error('Escreva a mensagem.');

  if (input.audience === 'user' && !input.receiver_id) {
    throw new Error('Selecione o destinatário.');
  }

  const id = newId();

  // Validado ANTES da transação: sob Postgres o callback de `write` não pode
  // ler resultados (execução síncrona). A checagem é a mesma de antes.
  if (input.audience === 'user') {
    const receiver = await queryOne<{ id: string; status: string }>(
      'SELECT id, status FROM users WHERE id = ?',
      [String(input.receiver_id)],
    );
    if (!receiver) throw new Error('Destinatário não encontrado.');
    if (receiver.status !== 'active') {
      throw new Error('O destinatário está inativo.');
    }
  }

  await write((db) => {
    runSql(
      db,
      `INSERT INTO internal_messages
         (id, sender_id, receiver_id, audience, subject, message, is_announcement, read_at, created_at)
       VALUES (${sqlList([
         id,
         user.id,
         input.audience === 'user' ? input.receiver_id! : null,
         input.audience,
         clean(input.subject, 150) || null,
         text,
         input.is_announcement ? 1 : 0,
         null,
         nowIso(),
       ])})`,
    );

    auditRow(db, {
      user,
      action: 'create',
      entity: 'message',
      entityId: id,
      description: input.is_announcement
        ? `Publicou um comunicado interno`
        : `Enviou uma mensagem interna`,
      metadata: { audience: input.audience, receiver_id: input.receiver_id ?? null },
    });
  });

  return id;
}

/** Marca como lida — só o destinatário pode fazer isso. */
export async function markMessageRead(
  messageId: string,
  user: SessionUser,
): Promise<void> {
  const msg = await queryOne<{ id: string; receiver_id: string | null }>(
    'SELECT id, receiver_id FROM internal_messages WHERE id = ?',
    [messageId],
  );
  if (!msg) throw new Error('Mensagem não encontrada.');
  // Mensagens de grupo são marcadas como lidas por quem as abre.
  if (msg.receiver_id && msg.receiver_id !== user.id) {
    throw new Error('Você não pode alterar esta mensagem.');
  }

  await write((db) => {
    runSql(
      db,
      `UPDATE internal_messages SET read_at = ${sqlLit(nowIso())}
        WHERE id = ${sqlLit(messageId)} AND read_at IS NULL`,
    );
  });
}

/** Marca todas as mensagens visíveis como lidas (ação em massa). */
export async function markAllRead(user: SessionUser): Promise<void> {
  const audiences: MessageAudience[] = ['all'];
  if (user.role === 'admin') audiences.push('operators', 'motoboys');
  else if (user.role === 'operator') audiences.push('operators');
  else if (user.role === 'motoboy') audiences.push('motoboys');

  await write((db) => {
    runSql(
      db,
      `UPDATE internal_messages SET read_at = ${sqlLit(nowIso())}
        WHERE read_at IS NULL AND sender_id <> ${sqlLit(user.id)}
          AND (receiver_id = ${sqlLit(user.id)}
               OR (receiver_id IS NULL AND audience IN (${sqlList(audiences)})))`,
    );
  });
}

export async function deleteMessage(messageId: string, user: SessionUser): Promise<void> {
  const msg = await queryOne<{ id: string; sender_id: string }>(
    'SELECT id, sender_id FROM internal_messages WHERE id = ?',
    [messageId],
  );
  if (!msg) throw new Error('Mensagem não encontrada.');
  if (msg.sender_id !== user.id && user.role !== 'admin') {
    throw new Error('Apenas o remetente ou um administrador pode excluir a mensagem.');
  }

  await write((db) => {
    runSql(db, `DELETE FROM internal_messages WHERE id = ${sqlLit(messageId)}`);
    auditRow(db, {
      user,
      action: 'delete',
      entity: 'message',
      entityId: messageId,
      description: 'Excluiu uma mensagem interna',
    });
  });
}

/** Lista de destinatários disponíveis (para o select de nova mensagem). */
export async function listMessageRecipients(
  user: SessionUser,
): Promise<{ id: string; name: string; role: UserRole }[]> {
  return query<{ id: string; name: string; role: UserRole }>(
    `SELECT id, name, role FROM users
      WHERE status = 'active' AND id <> ?
      ORDER BY name COLLATE NOCASE ASC`,
    [user.id],
  );
}

/** Apenas os comunicados (avisos oficiais). */
export async function listAnnouncements(
  user: SessionUser,
): Promise<InternalMessageRow[]> {
  const audiences: MessageAudience[] = ['all'];
  if (user.role === 'admin') audiences.push('operators', 'motoboys');
  else if (user.role === 'operator') audiences.push('operators');
  else if (user.role === 'motoboy') audiences.push('motoboys');

  return query<InternalMessageRow>(
    `SELECT m.*, s.name AS sender_name, NULL AS receiver_name
       FROM internal_messages m
       JOIN users s ON s.id = m.sender_id
      WHERE m.is_announcement = 1
        AND (m.receiver_id IS NULL AND m.audience IN (${audiences.map(() => '?').join(',')}))
      ORDER BY m.created_at DESC
      LIMIT 100`,
    audiences,
  );
}
