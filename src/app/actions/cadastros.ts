'use server';

import { requirePermission } from '@/lib/auth';
import {
  createCompany,
  updateCompany,
  toggleCompanyStatus,
  deleteCompany,
  addCompanyNeighborhood,
  addCompanyNeighborhoodsBulk,
  removeCompanyNeighborhood,
  listCompanyNeighborhoods,
} from '@/lib/repo/companies';
import {
  createMotoboy,
  updateMotoboy,
  toggleMotoboyStatus,
  deleteMotoboy,
} from '@/lib/repo/motoboys';
import {
  createNeighborhood,
  updateNeighborhood,
  toggleNeighborhoodStatus,
  deleteNeighborhood,
  listNeighborhoods,
} from '@/lib/repo/neighborhoods';
import { upsertFee, deleteFee } from '@/lib/repo/companies';
import { clean, cleanDigits, parseMoneyToCents } from '@/lib/utils';
import { guard, type ActionResult } from './guard';

const REVALIDATE = ['/dashboard/cadastro'];

function str(fd: FormData, key: string, max = 200): string {
  return clean(fd.get(key), max);
}

/* ============================ EMPRESAS ================================= */

export async function saveCompanyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const id = str(formData, 'id', 60);
    const user = await requirePermission('companies.manage');

    const input = {
      name: str(formData, 'name', 150),
      trade_name: str(formData, 'trade_name', 150),
      cnpj: cleanDigits(formData.get('cnpj')),
      phone: str(formData, 'phone', 30),
      whatsapp: str(formData, 'whatsapp', 30),
      email: str(formData, 'email', 150),
      address: str(formData, 'address', 250),
      neighborhood: str(formData, 'neighborhood', 120),
      city: str(formData, 'city', 120),
      state: str(formData, 'state', 2),
      status: (str(formData, 'status', 10) === 'inactive' ? 'inactive' : 'active') as
        | 'active'
        | 'inactive',
    };

    if (!input.name) throw new Error('Informe o nome da empresa.');
    if (input.cnpj && input.cnpj.length !== 14)
      throw new Error('O CNPJ deve conter 14 dígitos.');
    if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))
      throw new Error('Informe um e-mail válido.');

    return id ? updateCompany(id, input, user) : createCompany(input, user);
  }, { revalidate: REVALIDATE });
}

export async function toggleCompanyAction(id: string): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('companies.manage');
    return toggleCompanyStatus(id, user);
  }, { revalidate: REVALIDATE });
}

export async function deleteCompanyAction(id: string): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('companies.manage');
    await deleteCompany(id, user);
    return true;
  }, { revalidate: REVALIDATE });
}

export async function addCompanyNeighborhoodAction(
  companyId: string,
  neighborhoodId: string,
): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('companies.manage');
    if (!companyId || !neighborhoodId) throw new Error('Selecione um bairro.');
    await addCompanyNeighborhood(companyId, neighborhoodId, user);
    return true;
  }, { revalidate: REVALIDATE });
}

export async function removeCompanyNeighborhoodAction(
  companyId: string,
  neighborhoodId: string,
): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('companies.manage');
    await removeCompanyNeighborhood(companyId, neighborhoodId, user);
    return true;
  }, { revalidate: REVALIDATE });
}

/**
 * Vincula vários bairros a uma empresa de uma só vez.
 * Ignora silenciosamente os bairros que já estejam vinculados e devolve a
 * quantidade efetivamente vinculada em `data.count`.
 */
export async function addCompanyNeighborhoodsBulkAction(
  companyId: string,
  neighborhoodIds: string[],
): Promise<ActionResult<{ count: number }>> {
  return guard(async () => {
    const user = await requirePermission('companies.manage');
    const ids = Array.from(new Set(neighborhoodIds.filter(Boolean)));
    if (!companyId || ids.length === 0) throw new Error('Selecione ao menos um bairro.');

    const count = await addCompanyNeighborhoodsBulk(companyId, ids, user);
    return { count };
  }, { revalidate: REVALIDATE });
}

/**
 * Dados para a tela de vínculo de bairros de uma empresa:
 * os bairros já vinculados e os disponíveis para vincular.
 */
export async function loadCompanyNeighborhoodsAdminAction(companyId: string): Promise<
  ActionResult<{
    linked: { id: string; name: string; city: string; state: string }[];
    available: { id: string; name: string; city: string; state: string }[];
  }>
> {
  return guard(async () => {
    await requirePermission('companies.view');
    if (!companyId) return { linked: [], available: [] };

    const [linked, all] = await Promise.all([
      listCompanyNeighborhoods(companyId),
      listNeighborhoods({ status: 'active' }),
    ]);

    const linkedIds = new Set(linked.map((n) => n.id));
    const toOption = (n: { id: string; name: string; city: string; state: string }) => ({
      id: n.id,
      name: n.name,
      city: n.city,
      state: n.state,
    });

    return {
      linked: linked.map(toOption),
      available: all.filter((n) => !linkedIds.has(n.id)).map(toOption),
    };
  });
}

/* ============================ MOTOBOYS ================================= */

export async function saveMotoboyAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const id = str(formData, 'id', 60);
    const user = await requirePermission('motoboys.manage');

    const input = {
      name: str(formData, 'name', 150),
      cpf: cleanDigits(formData.get('cpf')),
      phone: str(formData, 'phone', 30),
      whatsapp: str(formData, 'whatsapp', 30),
      motorcycle_plate: str(formData, 'motorcycle_plate', 10),
      motorcycle_model: str(formData, 'motorcycle_model', 80),
      notes: str(formData, 'notes', 500),
      status: str(formData, 'status', 20) as 'available' | 'on_delivery' | 'inactive',
    };

    if (!input.name) throw new Error('Informe o nome completo do motoboy.');
    if (input.cpf && input.cpf.length !== 11) throw new Error('O CPF deve conter 11 dígitos.');

    return id ? updateMotoboy(id, input, user) : createMotoboy(input, user);
  }, { revalidate: REVALIDATE });
}

export async function toggleMotoboyAction(id: string): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('motoboys.manage');
    return toggleMotoboyStatus(id, user);
  }, { revalidate: REVALIDATE });
}

export async function deleteMotoboyAction(id: string): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('motoboys.manage');
    await deleteMotoboy(id, user);
    return true;
  }, { revalidate: REVALIDATE });
}

/* ============================ BAIRROS ================================== */

export async function saveNeighborhoodAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const id = str(formData, 'id', 60);
    const user = await requirePermission('neighborhoods.manage');

    const input = {
      name: str(formData, 'name', 120),
      city: str(formData, 'city', 120),
      state: str(formData, 'state', 2),
      status: (str(formData, 'status', 10) === 'inactive' ? 'inactive' : 'active') as
        | 'active'
        | 'inactive',
    };

    if (!input.name) throw new Error('Informe o nome do bairro.');
    if (!input.city) throw new Error('Informe a cidade.');
    if (input.state.length !== 2) throw new Error('Informe a UF com 2 letras (ex.: PE).');

    return id ? updateNeighborhood(id, input, user) : createNeighborhood(input, user);
  }, { revalidate: REVALIDATE });
}

export async function toggleNeighborhoodAction(id: string): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('neighborhoods.manage');
    return toggleNeighborhoodStatus(id, user);
  }, { revalidate: REVALIDATE });
}

export async function deleteNeighborhoodAction(id: string): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('neighborhoods.manage');
    await deleteNeighborhood(id, user);
    return true;
  }, { revalidate: REVALIDATE });
}

/* ============================== TAXAS ================================== */

export async function saveFeeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('fees.manage');

    const companyId = str(formData, 'company_id', 60);
    const neighborhoodId = str(formData, 'neighborhood_id', 60);
    const feeInput = String(formData.get('fee') ?? '');
    const feeCents = parseMoneyToCents(feeInput);

    if (!companyId) throw new Error('Selecione a empresa.');
    if (!neighborhoodId) throw new Error('Selecione o bairro.');
    if (!feeInput.trim()) throw new Error('Informe o valor da taxa.');
    if (feeCents <= 0) throw new Error('O valor da taxa deve ser maior que zero.');

    await upsertFee(
      {
        company_id: companyId,
        neighborhood_id: neighborhoodId,
        fee_cents: feeCents,
        status: str(formData, 'status', 10) === 'inactive' ? 'inactive' : 'active',
      },
      user,
    );
    return true;
  }, { revalidate: REVALIDATE });
}

export async function deleteFeeAction(id: string): Promise<ActionResult> {
  return guard(async () => {
    const user = await requirePermission('fees.manage');
    await deleteFee(id, user);
    return true;
  }, { revalidate: REVALIDATE });
}
