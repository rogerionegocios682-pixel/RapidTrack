/**
 * Auditoria — registra operações importantes em `audits`.
 * Gravado na MESMA transação da operação quando possível, para que nunca
 * exista alteração sem rastro.
 */
import type { Tx } from '@/db';
import { query, runSql, sqlList } from '@/db';
import { newId, nowIso } from '@/lib/utils';
import type { Audit, SessionUser } from '@/lib/types';

export interface AuditInput {
  user: Pick<SessionUser, 'id' | 'name'> | null;
  action: string;
  entity: string;
  entityId?: string | null;
  description?: string;
  metadata?: Record<string, unknown>;
}

/** Versão para uso dentro de uma transação já aberta (`write`). */
export function auditRow(db: Tx, input: AuditInput): void {
  runSql(
    db,
    `INSERT INTO audits (id, user_id, user_name, action, entity, entity_id, description, metadata, created_at)
     VALUES (${sqlList([
       newId(),
       input.user?.id ?? null,
       input.user?.name ?? 'sistema',
       input.action,
       input.entity,
       input.entityId ?? null,
       input.description ?? null,
       input.metadata ? JSON.stringify(input.metadata) : null,
       nowIso(),
     ])})`,
  );
}

export async function listAudits(limit = 200, userId?: string): Promise<Audit[]> {
  if (userId) {
    return query<Audit>(
      `SELECT * FROM audits WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      [userId, limit],
    );
  }
  return query<Audit>(`SELECT * FROM audits ORDER BY created_at DESC LIMIT ?`, [limit]);
}
