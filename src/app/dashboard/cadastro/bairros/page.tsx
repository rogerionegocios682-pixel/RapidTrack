import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth';
import { listNeighborhoods } from '@/lib/repo/neighborhoods';
import { PageHeader } from '@/components/stat-card';
import { NeighborhoodsClient } from './client';

export const metadata: Metadata = { title: 'Bairros' };
export const dynamic = 'force-dynamic';

function readParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = searchParams[key];
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export default async function NeighborhoodsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermission('neighborhoods.view');

  const search = readParam(searchParams, 'q');
  const statusParam = readParam(searchParams, 'status');
  const status = statusParam === 'active' || statusParam === 'inactive' ? statusParam : 'all';

  const neighborhoods = await listNeighborhoods({ search: search || undefined, status });
  const canManage = user.role === 'admin' || user.role === 'operator';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bairros"
        description="Áreas de entrega atendidas — base para vínculos com empresas e taxas."
      />
      <NeighborhoodsClient
        neighborhoods={neighborhoods.map((n) => ({
          id: n.id,
          name: n.name,
          city: n.city,
          state: n.state,
          status: n.status,
          companies_count: n.companies_count,
        }))}
        canManage={canManage}
      />
    </div>
  );
}
