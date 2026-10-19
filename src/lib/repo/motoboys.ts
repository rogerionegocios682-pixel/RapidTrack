/**
 * Repositório de Motoboys.
 */
import { query, queryOne, write, runSql, sqlList, sqlLit, sqlSet } from '@/db';
import { auditRow } from '@/lib/audit';
import { newId, nowIso, clean, cleanDigits } from '@/lib/utils';
import type { Motoboy, MotoboyStatus, SessionUser } from '@/lib/types';

export interface MotoboyInput {
  name: string;
  cpf?: string;
  phone?: string;
  whatsapp?: string;
  motorcycle_plate?: string;
  motorcycle_model?: string;
  notes?: string;
  status?: MotoboyStatus;
}

export interface MotoboyListOptions {
  search?: string;
  status?: MotoboyStatus | 'all';
}

/** Lista motoboys com a contagem de corridas em aberto (para exibição). */
export async function listMotoboys(
  opts: MotoboyListOptions = {},
): Promise<(Motoboy & { open_deliveries: number })[]> {
  const where: string[] = [];
  const params: string[] = [];

  if (opts.search) {
    where.push('(m.name LIKE ? OR m.phone LIKE ? OR m.whatsapp LIKE ? OR m.cpf LIKE ?)');
    const like = `%${opts.search}%`;
    params.push(like, like, like, like);
  }
  if (opts.status && opts.status !== 'all') {
    where.push('m.status = ?');
    params.push(opts.status);
  }

  return query<(Motoboy & { open_deliveries: number })>(
    `SELECT m.*,
            (SELECT COUNT(*) FROM deliveries d
              WHERE d.motoboy_id = m.id
                AND d.status IN ('pending','dispatched','in_progress')) AS open_deliveries
       FROM motoboys m
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY m.status = 'inactive' ASC, m.name COLLATE NOCASE ASC`,
    params,
  );
}

export async function listActiveMotoboys(): Promise<Motoboy[]> {
  return query<Motoboy>(
    `SELECT * FROM motoboys WHERE status <> 'inactive' ORDER BY name COLLATE NOCASE ASC`,
  );
}

export async function getMotoboy(id: string): Promise<Motoboy | null> {
  return queryOne<Motoboy>('SELECT * FROM motoboys WHERE id = ?', [id]);
}

export async function createMotoboy(
  input: MotoboyInput,
  user: SessionUser,
): Promise<Motoboy> {
  const id = newId();
  const ts = nowIso();
  const cpf = input.cpf ? cleanDigits(input.cpf) : null;

  if (cpf) {
    const dup = await queryOne<{ id: string }>('SELECT id FROM motoboys WHERE cpf = ? LIMIT 1', [
      cpf,
    ]);
    if (dup) throw new Error('Já existe um motoboy cadastrado com este CPF.');
  }

  await write((db) => {
    runSql(
      db,
      `INSERT INTO motoboys
         (id, name, cpf, phone, whatsapp, motorcycle_plate, motorcycle_model, notes, status, created_at, updated_at)
       VALUES (${sqlList([
         id,
         clean(input.name, 150),
         cpf,
         clean(input.phone, 30) || null,
         clean(input.whatsapp, 30) || null,
         clean(input.motorcycle_plate, 10).toUpperCase() || null,
         clean(input.motorcycle_model, 80) || null,
         clean(input.notes, 500) || null,
         normalizeStatus(input.status),
         ts,
         ts,
       ])})`,
    );
    auditRow(db, {
      user,
      action: 'create',
      entity: 'motoboy',
      entityId: id,
      description: `Cadastrou o motoboy "${clean(input.name, 150)}"`,
    });
  });

  return (await getMotoboy(id))!;
}

function normalizeStatus(status?: MotoboyStatus): MotoboyStatus {
  return status === 'on_delivery' || status === 'inactive' ? status : 'available';
}

export async function updateMotoboy(
  id: string,
  input: MotoboyInput,
  user: SessionUser,
): Promise<Motoboy> {
  const existing = await getMotoboy(id);
  if (!existing) throw new Error('Motoboy não encontrado.');

  const cpf = input.cpf ? cleanDigits(input.cpf) : null;
  const ts = nowIso();

  if (cpf) {
    const dup = await queryOne<{ id: string }>(
      'SELECT id FROM motoboys WHERE cpf = ? AND id <> ? LIMIT 1',
      [cpf, id],
    );
    if (dup) throw new Error('Já existe outro motoboy cadastrado com este CPF.');
  }

  await write((db) => {
    runSql(
      db,
      `UPDATE motoboys SET ${sqlSet({
        name: clean(input.name, 150),
        cpf,
        phone: clean(input.phone, 30) || null,
        whatsapp: clean(input.whatsapp, 30) || null,
        motorcycle_plate: clean(input.motorcycle_plate, 10).toUpperCase() || null,
        motorcycle_model: clean(input.motorcycle_model, 80) || null,
        notes: clean(input.notes, 500) || null,
        status: normalizeStatus(input.status),
        updated_at: ts,
      })} WHERE id = ${sqlLit(id)}`,
    );
    auditRow(db, {
      user,
      action: 'update',
      entity: 'motoboy',
      entityId: id,
      description: `Atualizou o motoboy "${clean(input.name, 150)}"`,
    });
  });

  return (await getMotoboy(id))!;
}

export async function toggleMotoboyStatus(
  id: string,
  user: SessionUser,
): Promise<Motoboy> {
  const motoboy = await getMotoboy(id);
  if (!motoboy) throw new Error('Motoboy não encontrado.');
  const next: MotoboyStatus = motoboy.status === 'inactive' ? 'available' : 'inactive';

  await write((db) => {
    runSql(
      db,
      `UPDATE motoboys SET ${sqlSet({ status: next, updated_at: nowIso() })}
        WHERE id = ${sqlLit(id)}`,
    );
    auditRow(db, {
      user,
      action: 'status_change',
      entity: 'motoboy',
      entityId: id,
      description: `Motoboy "${motoboy.name}" agora está ${
        next === 'inactive' ? 'Inativo' : 'Disponível'
      }`,
      metadata: { de: motoboy.status, para: next },
    });
  });

  return (await getMotoboy(id))!;
}

export async function deleteMotoboy(id: string, user: SessionUser): Promise<void> {
  const motoboy = await getMotoboy(id);
  if (!motoboy) throw new Error('Motoboy não encontrado.');

  const linked = await queryOne<{ n: number }>(
    'SELECT COUNT(*) AS n FROM deliveries WHERE motoboy_id = ?',
    [id],
  );
  if (Number(linked?.n ?? 0) > 0) {
    throw new Error(
      `Este motoboy possui ${linked!.n} corrida(s) vinculada(s) e não pode ser excluído. Inative-o em vez disso.`,
    );
  }

  await write((db) => {
    // Desvincula usuários de login que apontavam para este motoboy.
    runSql(db, `UPDATE users SET motoboy_id = NULL WHERE motoboy_id = ${sqlLit(id)}`);
    runSql(db, `DELETE FROM motoboys WHERE id = ${sqlLit(id)}`);
    auditRow(db, {
      user,
      action: 'delete',
      entity: 'motoboy',
      entityId: id,
      description: `Excluiu o motoboy "${motoboy.name}"`,
    });
  });
}
