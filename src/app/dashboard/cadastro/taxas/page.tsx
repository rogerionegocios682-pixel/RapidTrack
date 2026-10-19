import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth';
import { listFees, listActiveCompanies } from '@/lib/repo/companies';
import { PageHeader } from '@/components/stat-card';
import { FeesClient } from './client';

export const metadata: Metadata = { title: 'Taxas' };
export const dynamic = 'force-dynamic';

function readParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = searchParams[key];
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermission('fees.view');

  const search = readParam(searchParams, 'q');
  const companyId = readParam(searchParams, 'empresa');

  const [fees, companies] = await Promise.all([
    listFees({ search: search || undefined, companyId: companyId || undefined }),
    listActiveCompanies(),
  ]);

  const canManage = user.role === 'admin' || user.role === 'operator';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Taxas"
        description="Valores de entrega por combinação de empresa e bairro."
      />
      <FeesClient
        fees={fees.map((f) => ({
          id: f.id,
          company_id: f.company_id,
          company_name: f.company_name,
          neighborhood_id: f.neighborhood_id,
          neighborhood_name: f.neighborhood_name,
          neighborhood_city: f.neighborhood_city,
          fee_cents: f.fee_cents,
          status: f.status,
        }))}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        canManage={canManage}
      />
    </div>
  );
}
