/**
 * Repositório de Bairros.
 */
import { query, queryOne, write, runSql, sqlList, sqlLit, sqlSet } from '@/db';
import { auditRow } from '@/lib/audit';
import { newId, nowIso, clean } from '@/lib/utils';
import type { ActiveStatus, Neighborhood, SessionUser } from '@/lib/types';

export interface NeighborhoodInput {
  name: string;
  city: string;
  state: string;
  status?: ActiveStatus;
}

export interface NeighborhoodListOptions {
  search?: string;
  status?: ActiveStatus | 'all';
}

export async function listNeighborhoods(
  opts: NeighborhoodListOptions = {},
): Promise<(Neighborhood & { companies_count: number })[]> {
  const where: string[] = [];
  const params: string[] = [];

  if (opts.search) {
    where.push('(n.name LIKE ? OR n.city LIKE ?)');
    params.push(`%${opts.search}%`, `%${opts.search}%`);
  }
  if (opts.status && opts.status !== 'all') {
    where.push('n.status = ?');
    params.push(opts.status);
  }

  return query<Neighborhood & { companies_count: number }>(
    `SELECT n.*,
            (SELECT COUNT(*) FROM company_neighborhoods cn WHERE cn.neighborhood_id = n.id) AS companies_count
       FROM neighborhoods n
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY n.status = 'active' DESC, n.name COLLATE NOCASE ASC`,
    params,
  );
}

export async function getNeighborhood(id: string): Promise<Neighborhood | null> {
  return queryOne<Neighborhood>('SELECT * FROM neighborhoods WHERE id = ?', [id]);
}

export async function createNeighborhood(
  input: NeighborhoodInput,
  user: SessionUser,
): Promise<Neighborhood> {
  const id = newId();
  const ts = nowIso();
  const name = clean(input.name, 120);
  const city = clean(input.city, 120);
  const state = clean(input.state, 2).toUpperCase();

  // Checagem amigável ANTES da transação; o índice único do banco é a
  // garantia final. LOWER() mantém a comparação case-insensitive do SQLite.
  const dup = await queryOne<{ id: string }>(
    `SELECT id FROM neighborhoods
      WHERE LOWER(name) = LOWER(?) AND LOWER(city) = LOWER(?) AND LOWER(state) = LOWER(?)
      LIMIT 1`,
    [name, city, state],
  );
  if (dup) {
    throw new Error('Este bairro já está cadastrado para a mesma cidade/UF.');
  }

  await write((db) => {
    runSql(
      db,
      `INSERT INTO neighborhoods (id, name, city, state, status, created_at, updated_at)
       VALUES (${sqlList([
         id,
         name,
         city,
         state,
         input.status === 'inactive' ? 'inactive' : 'active',
         ts,
         ts,
       ])})`,
    );
    auditRow(db, {
      user,
      action: 'create',
      entity: 'neighborhood',
      entityId: id,
      description: `Cadastrou o bairro "${name}" (${city}/${state})`,
    });
  });

  return (await getNeighborhood(id))!;
}

export async function updateNeighborhood(
  id: string,
  input: NeighborhoodInput,
  user: SessionUser,
): Promise<Neighborhood> {
  const existing = await getNeighborhood(id);
  if (!existing) throw new Error('Bairro não encontrado.');

  const name = clean(input.name, 120);
  const city = clean(input.city, 120);
  const state = clean(input.state, 2).toUpperCase();

  const dup = await queryOne<{ id: string }>(
    `SELECT id FROM neighborhoods
      WHERE LOWER(name) = LOWER(?) AND LOWER(city) = LOWER(?)
        AND LOWER(state) = LOWER(?) AND id <> ?
      LIMIT 1`,
    [name, city, state, id],
  );
  if (dup) {
    throw new Error('Já existe outro bairro com este nome na mesma cidade/UF.');
  }

  await write((db) => {
    runSql(
      db,
      `UPDATE neighborhoods SET ${sqlSet({
        name,
        city,
        state,
        status: input.status === 'inactive' ? 'inactive' : 'active',
        updated_at: nowIso(),
      })} WHERE id = ${sqlLit(id)}`,
    );
    auditRow(db, {
      user,
      action: 'update',
      entity: 'neighborhood',
      entityId: id,
      description: `Atualizou o bairro "${name}"`,
    });
  });

  return (await getNeighborhood(id))!;
}

export async function toggleNeighborhoodStatus(
  id: string,
  user: SessionUser,
): Promise<Neighborhood> {
  const nb = await getNeighborhood(id);
  if (!nb) throw new Error('Bairro não encontrado.');
  const next: ActiveStatus = nb.status === 'active' ? 'inactive' : 'active';

  await write((db) => {
    runSql(
      db,
      `UPDATE neighborhoods SET ${sqlSet({ status: next, updated_at: nowIso() })}
        WHERE id = ${sqlLit(id)}`,
    );
    auditRow(db, {
      user,
      action: 'status_change',
      entity: 'neighborhood',
      entityId: id,
      description: `Bairro "${nb.name}" agora está ${next === 'active' ? 'Ativo' : 'Inativo'}`,
    });
  });

  return (await getNeighborhood(id))!;
}

export async function deleteNeighborhood(id: string, user: SessionUser): Promise<void> {
  const nb = await getNeighborhood(id);
  if (!nb) throw new Error('Bairro não encontrado.');

  const linked = await queryOne<{ n: number }>(
    'SELECT COUNT(*) AS n FROM deliveries WHERE neighborhood_id = ?',
    [id],
  );
  if (Number(linked?.n ?? 0) > 0) {
    throw new Error(
      `Este bairro possui ${linked!.n} corrida(s) vinculada(s) e não pode ser excluído. Inative-o em vez disso.`,
    );
  }

  await write((db) => {
    runSql(db, `DELETE FROM neighborhoods WHERE id = ${sqlLit(id)}`);
    auditRow(db, {
      user,
      action: 'delete',
      entity: 'neighborhood',
      entityId: id,
      description: `Excluiu o bairro "${nb.name}"`,
    });
  });
}
