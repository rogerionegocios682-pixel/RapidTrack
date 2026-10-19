import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth';
import { listCompanies } from '@/lib/repo/companies';
import { PageHeader } from '@/components/stat-card';
import { CompaniesClient } from './client';

export const metadata: Metadata = { title: 'Empresas' };
export const dynamic = 'force-dynamic';

function readParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = searchParams[key];
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermission('companies.view');

  const search = readParam(searchParams, 'q');
  const statusParam = readParam(searchParams, 'status');
  const status =
    statusParam === 'active' || statusParam === 'inactive' ? statusParam : 'all';

  const companies = await listCompanies({ search: search || undefined, status });

  const canManage = user.role === 'admin' || user.role === 'operator';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Empresas"
        description="Cadastro das empresas clientes e os bairros atendidos por elas."
      />
      <CompaniesClient
        companies={companies.map((c) => ({
          id: c.id,
          name: c.name,
          trade_name: c.trade_name,
          cnpj: c.cnpj,
          phone: c.phone,
          whatsapp: c.whatsapp,
          email: c.email,
          address: c.address,
          neighborhood: c.neighborhood,
          city: c.city,
          state: c.state,
          status: c.status,
          neighborhoods_count: c.neighborhoods_count,
        }))}
        canManage={canManage}
      />
    </div>
  );
}
