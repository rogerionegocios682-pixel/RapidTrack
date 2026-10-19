/**
 * Repositório de Empresas + vínculo Empresa×Bairro + Taxas.
 */
import { query, queryOne, write, runSql, sqlList, sqlLit, sqlSet } from '@/db';
import { auditRow } from '@/lib/audit';
import { newId, nowIso, clean, cleanDigits } from '@/lib/utils';
import type {
  Company,
  CompanyNeighborhood,
  DeliveryFee,
  Neighborhood,
  SessionUser,
} from '@/lib/types';

export interface CompanyInput {
  name: string;
  trade_name?: string;
  cnpj?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  status?: 'active' | 'inactive';
}

export interface CompanyListOptions {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
}

/** Lista empresas com contagem de bairros atendidos, correndo opcionalmente por busca. */
export async function listCompanies(opts: CompanyListOptions = {}): Promise<
  (Company & { neighborhoods_count: number })[]
> {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (opts.search) {
    where.push('(c.name LIKE ? OR c.trade_name LIKE ? OR c.cnpj LIKE ?)');
    const like = `%${opts.search}%`;
    params.push(like, like, like);
  }
  if (opts.status && opts.status !== 'all') {
    where.push('c.status = ?');
    params.push(opts.status);
  }

  const sql = `
    SELECT c.*,
           (SELECT COUNT(*) FROM company_neighborhoods cn WHERE cn.company_id = c.id) AS neighborhoods_count
      FROM companies c
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY c.status = 'active' DESC, c.name COLLATE NOCASE ASC`;
  return query(sql, params);
}

/** Empresas ativas — usadas no formulário de nova corrida. */
export async function listActiveCompanies(): Promise<Company[]> {
  return query<Company>(
    `SELECT * FROM companies WHERE status = 'active' ORDER BY name COLLATE NOCASE ASC`,
  );
}

export async function getCompany(id: string): Promise<Company | null> {
  return queryOne<Company>('SELECT * FROM companies WHERE id = ?', [id]);
}

export async function createCompany(
  input: CompanyInput,
  user: SessionUser,
): Promise<Company> {
  const id = newId();
  const ts = nowIso();
  const cnpj = input.cnpj ? cleanDigits(input.cnpj) : null;

  // Checagem de duplicidade ANTES da transação (friendly error). O índice
  // único do banco continua sendo a garantia final.
  if (cnpj) {
    const dup = await queryOne<{ id: string }>('SELECT id FROM companies WHERE cnpj = ? LIMIT 1', [
      cnpj,
    ]);
    if (dup) throw new Error('Já existe uma empresa cadastrada com este CNPJ.');
  }

  await write((db) => {
    runSql(
      db,
      `INSERT INTO companies
         (id, name, trade_name, cnpj, phone, whatsapp, email, address, neighborhood, city, state, status, created_at, updated_at)
       VALUES (${sqlList([
         id,
         clean(input.name, 150),
         clean(input.trade_name, 150) || null,
         cnpj,
         clean(input.phone, 30) || null,
         clean(input.whatsapp, 30) || null,
         clean(input.email, 150) || null,
         clean(input.address, 250) || null,
         clean(input.neighborhood, 120) || null,
         clean(input.city, 120) || null,
         clean(input.state, 2).toUpperCase() || null,
         input.status === 'inactive' ? 'inactive' : 'active',
         ts,
         ts,
       ])})`,
    );
    auditRow(db, {
      user,
      action: 'create',
      entity: 'company',
      entityId: id,
      description: `Cadastrou a empresa "${clean(input.name, 150)}"`,
    });
  });

  return (await getCompany(id))!;
}

export async function updateCompany(
  id: string,
  input: CompanyInput,
  user: SessionUser,
): Promise<Company> {
  const existing = await getCompany(id);
  if (!existing) throw new Error('Empresa não encontrada.');

  const cnpj = input.cnpj ? cleanDigits(input.cnpj) : null;
  const ts = nowIso();

  // Checagem de duplicidade ANTES da transação (friendly error).
  if (cnpj) {
    const dup = await queryOne<{ id: string }>(
      'SELECT id FROM companies WHERE cnpj = ? AND id <> ? LIMIT 1',
      [cnpj, id],
    );
    if (dup) throw new Error('Já existe outra empresa cadastrada com este CNPJ.');
  }

  await write((db) => {
    runSql(
      db,
      `UPDATE companies SET ${sqlSet({
        name: clean(input.name, 150),
        trade_name: clean(input.trade_name, 150) || null,
        cnpj,
        phone: clean(input.phone, 30) || null,
        whatsapp: clean(input.whatsapp, 30) || null,
        email: clean(input.email, 150) || null,
        address: clean(input.address, 250) || null,
        neighborhood: clean(input.neighborhood, 120) || null,
        city: clean(input.city, 120) || null,
        state: clean(input.state, 2).toUpperCase() || null,
        status: input.status === 'inactive' ? 'inactive' : 'active',
        updated_at: ts,
      })} WHERE id = ${sqlLit(id)}`,
    );
    auditRow(db, {
      user,
      action: 'update',
      entity: 'company',
      entityId: id,
      description: `Atualizou a empresa "${clean(input.name, 150)}"`,
      metadata: { antes: existing.name, depois: clean(input.name, 150) },
    });
  });

  return (await getCompany(id))!;
}

export async function toggleCompanyStatus(
  id: string,
  user: SessionUser,
): Promise<Company> {
  const company = await getCompany(id);
  if (!company) throw new Error('Empresa não encontrada.');
  const next = company.status === 'active' ? 'inactive' : 'active';

  await write((db) => {
    runSql(
      db,
      `UPDATE companies SET ${sqlSet({ status: next, updated_at: nowIso() })}
        WHERE id = ${sqlLit(id)}`,
    );
    auditRow(db, {
      user,
      action: 'status_change',
      entity: 'company',
      entityId: id,
      description: `Empresa "${company.name}" agora está ${next === 'active' ? 'Ativa' : 'Inativa'}`,
      metadata: { de: company.status, para: next },
    });
  });

  return (await getCompany(id))!;
}

/** Exclui empresa, bloqueando se houver corridas vinculadas (integridade). */
export async function deleteCompany(id: string, user: SessionUser): Promise<void> {
  const company = await getCompany(id);
  if (!company) throw new Error('Empresa não encontrada.');

  const linked = await queryOne<{ n: number }>(
    'SELECT COUNT(*) AS n FROM deliveries WHERE company_id = ?',
    [id],
  );
  if (Number(linked?.n ?? 0) > 0) {
    throw new Error(
      `Esta empresa possui ${linked!.n} corrida(s) vinculada(s) e não pode ser excluída. Inative-a em vez disso.`,
    );
  }

  await write((db) => {
    // company_neighborhoods e delivery_fees caem por ON DELETE CASCADE.
    runSql(db, `DELETE FROM companies WHERE id = ${sqlLit(id)}`);
    auditRow(db, {
      user,
      action: 'delete',
      entity: 'company',
      entityId: id,
      description: `Excluiu a empresa "${company.name}"`,
    });
  });
}

/* ---------------------------------------------------------------------------
 * Empresa × Bairros atendidos
 * -------------------------------------------------------------------------*/

export async function listCompanyNeighborhoods(
  companyId: string,
): Promise<(Neighborhood & { link_id: string })[]> {
  return query<Neighborhood & { link_id: string }>(
    `SELECT n.*, cn.id AS link_id
       FROM company_neighborhoods cn
       JOIN neighborhoods n ON n.id = cn.neighborhood_id
      WHERE cn.company_id = ?
      ORDER BY n.name COLLATE NOCASE ASC`,
    [companyId],
  );
}

export async function addCompanyNeighborhood(
  companyId: string,
  neighborhoodId: string,
  user: SessionUser,
): Promise<void> {
  const dup = await queryOne<{ id: string }>(
    'SELECT id FROM company_neighborhoods WHERE company_id = ? AND neighborhood_id = ?',
    [companyId, neighborhoodId],
  );
  if (dup) throw new Error('Este bairro já está vinculado à empresa.');

  await write((db) => {
    runSql(
      db,
      `INSERT INTO company_neighborhoods (id, company_id, neighborhood_id, created_at)
       VALUES (${sqlList([newId(), companyId, neighborhoodId, nowIso()])})`,
    );
    auditRow(db, {
      user,
      action: 'create',
      entity: 'company_neighborhood',
      entityId: companyId,
      description: 'Vinculou um bairro à empresa',
      metadata: { company_id: companyId, neighborhood_id: neighborhoodId },
    });
  });
}

/** Remove o vínculo. Também remove a taxa (empresa+bairro), se existir. */
export async function removeCompanyNeighborhood(
  companyId: string,
  neighborhoodId: string,
  user: SessionUser,
): Promise<void> {
  await write((db) => {
    runSql(
      db,
      `DELETE FROM company_neighborhoods
        WHERE company_id = ${sqlLit(companyId)} AND neighborhood_id = ${sqlLit(neighborhoodId)}`,
    );
    runSql(
      db,
      `DELETE FROM delivery_fees
        WHERE company_id = ${sqlLit(companyId)} AND neighborhood_id = ${sqlLit(neighborhoodId)}`,
    );
    auditRow(db, {
      user,
      action: 'delete',
      entity: 'company_neighborhood',
      entityId: companyId,
      description: 'Desvinculou um bairro da empresa',
      metadata: { company_id: companyId, neighborhood_id: neighborhoodId },
    });
  });
}

/**
 * Vincula VÁRIOS bairros a uma empresa numa única transação.
 * -------------------------------------------------------------------------
 * Diferente de chamar `addCompanyNeighborhood` em loop (cada chamada abre sua
 * própria transação e força uma gravação do banco inteiro), aqui tudo acontece
 * num único `write()`, o que mantém a operação rápida mesmo com muitos bairros.
 *
 * Devolve a quantidade de vínculos novos criados; bairros já vinculados são
 * ignorados silenciosamente.
 */
export async function addCompanyNeighborhoodsBulk(
  companyId: string,
  neighborhoodIds: string[],
  user: SessionUser,
): Promise<number> {
  const ids = Array.from(new Set(neighborhoodIds.filter(Boolean)));
  if (ids.length === 0) return 0;

  const existing = await listCompanyNeighborhoods(companyId);
  const linkedIds = new Set(existing.map((n) => n.id));
  const toAdd = ids.filter((id) => !linkedIds.has(id));
  if (toAdd.length === 0) return 0;

  await write((db) => {
    for (const neighborhoodId of toAdd) {
      runSql(
        db,
        `INSERT OR IGNORE INTO company_neighborhoods (id, company_id, neighborhood_id, created_at)
         VALUES (${sqlList([newId(), companyId, neighborhoodId, nowIso()])})`,
      );
    }
    auditRow(db, {
      user,
      action: 'create',
      entity: 'company_neighborhood',
      entityId: companyId,
      description: `Vinculou ${toAdd.length} bairro(s) à empresa`,
      metadata: { company_id: companyId, neighborhood_ids: toAdd },
    });
  });

  return toAdd.length;
}

/** Bairros vinculados a uma empresa (usado no select de nova corrida). */
export async function listNeighborhoodsForCompany(
  companyId: string,
): Promise<(Neighborhood & { fee_cents: number | null })[]> {
  return query<Neighborhood & { fee_cents: number | null }>(
    `SELECT n.*, df.fee_cents
       FROM company_neighborhoods cn
       JOIN neighborhoods n ON n.id = cn.neighborhood_id
       LEFT JOIN delivery_fees df
              ON df.company_id = cn.company_id
             AND df.neighborhood_id = cn.neighborhood_id
             AND df.status = 'active'
      WHERE cn.company_id = ? AND n.status = 'active'
      ORDER BY n.name COLLATE NOCASE ASC`,
    [companyId],
  );
}

/* ---------------------------------------------------------------------------
 * Taxas (Empresa + Bairro -> valor)
 * -------------------------------------------------------------------------*/

export interface FeeRow extends DeliveryFee {
  company_name: string;
  neighborhood_name: string;
  neighborhood_city: string;
}

export async function listFees(opts: { companyId?: string; search?: string } = {}): Promise<
  FeeRow[]
> {
  const where: string[] = [];
  const params: string[] = [];
  if (opts.companyId) {
    where.push('df.company_id = ?');
    params.push(opts.companyId);
  }
  if (opts.search) {
    where.push('(c.name LIKE ? OR n.name LIKE ?)');
    params.push(`%${opts.search}%`, `%${opts.search}%`);
  }

  return query<FeeRow>(
    `SELECT df.*, c.name AS company_name, n.name AS neighborhood_name, n.city AS neighborhood_city
       FROM delivery_fees df
       JOIN companies c ON c.id = df.company_id
       JOIN neighborhoods n ON n.id = df.neighborhood_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY c.name COLLATE NOCASE ASC, n.name COLLATE NOCASE ASC`,
    params,
  );
}

/** Consulta a taxa sugerida para Empresa + Bairro. */
export async function getSuggestedFee(
  companyId: string,
  neighborhoodId: string,
): Promise<number | null> {
  const row = await queryOne<{ fee_cents: number }>(
    `SELECT fee_cents FROM delivery_fees
      WHERE company_id = ? AND neighborhood_id = ? AND status = 'active'`,
    [companyId, neighborhoodId],
  );
  return row ? Number(row.fee_cents) : null;
}

/**
 * Cria ou atualiza a taxa (upsert). Garante que o vínculo Empresa×Bairro
 * exista, criando-o automaticamente.
 */
export async function upsertFee(
  input: {
    company_id: string;
    neighborhood_id: string;
    fee_cents: number;
    status?: 'active' | 'inactive';
  },
  user: SessionUser,
): Promise<void> {
  if (input.fee_cents < 0) throw new Error('O valor da taxa não pode ser negativo.');

  // Leituras feitas ANTES da transação (o callback de `write` não lê
  // resultados sob Postgres, pois é síncrono).
  const existing = await queryOne<{ id: string }>(
    'SELECT id FROM delivery_fees WHERE company_id = ? AND neighborhood_id = ?',
    [input.company_id, input.neighborhood_id],
  );
  const link = await queryOne<{ id: string }>(
    'SELECT id FROM company_neighborhoods WHERE company_id = ? AND neighborhood_id = ?',
    [input.company_id, input.neighborhood_id],
  );

  const ts = nowIso();
  const status = input.status === 'inactive' ? 'inactive' : 'active';
  const id = existing ? existing.id : newId();

  await write((db) => {
    if (existing) {
      runSql(
        db,
        `UPDATE delivery_fees SET ${sqlSet({
          fee_cents: input.fee_cents,
          status,
          updated_at: ts,
        })} WHERE id = ${sqlLit(id)}`,
      );
    } else {
      runSql(
        db,
        `INSERT INTO delivery_fees (id, company_id, neighborhood_id, fee_cents, status, created_at, updated_at)
         VALUES (${sqlList([
           id,
           input.company_id,
           input.neighborhood_id,
           input.fee_cents,
           status,
           ts,
           ts,
         ])})`,
      );
    }

    // Garante o vínculo Empresa×Bairro (necessário para a corrida).
    if (!link) {
      runSql(
        db,
        `INSERT INTO company_neighborhoods (id, company_id, neighborhood_id, created_at)
         VALUES (${sqlList([newId(), input.company_id, input.neighborhood_id, ts])})`,
      );
    }

    auditRow(db, {
      user,
      action: existing ? 'update' : 'create',
      entity: 'fee',
      entityId: id,
      description: 'Configurou taxa de entrega',
      metadata: {
        company_id: input.company_id,
        neighborhood_id: input.neighborhood_id,
        fee_cents: input.fee_cents,
      },
    });
  });
}

export async function deleteFee(id: string, user: SessionUser): Promise<void> {
  await write((db) => {
    runSql(db, `DELETE FROM delivery_fees WHERE id = ${sqlLit(id)}`);
    auditRow(db, {
      user,
      action: 'delete',
      entity: 'fee',
      entityId: id,
      description: 'Excluiu configuração de taxa',
    });
  });
}
