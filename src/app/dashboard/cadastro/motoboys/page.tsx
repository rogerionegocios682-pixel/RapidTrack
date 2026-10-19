import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth';
import { listMotoboys } from '@/lib/repo/motoboys';
import type { MotoboyStatus } from '@/lib/types';
import { PageHeader } from '@/components/stat-card';
import { MotoboysClient } from './client';

export const metadata: Metadata = { title: 'Motoboys' };
export const dynamic = 'force-dynamic';

const STATUSES: (MotoboyStatus | 'all')[] = ['all', 'available', 'on_delivery', 'inactive'];

function readParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = searchParams[key];
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export default async function MotoboysPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermission('motoboys.view');

  const search = readParam(searchParams, 'q');
  const statusParam = readParam(searchParams, 'status');
  const status = STATUSES.includes(statusParam as MotoboyStatus)
    ? (statusParam as MotoboyStatus)
    : 'all';

  const motoboys = await listMotoboys({ search: search || undefined, status });
  const canManage = user.role === 'admin' || user.role === 'operator';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Motoboys"
        description="Cadastro e situação dos motoboys da operação."
      />
      <MotoboysClient
        motoboys={motoboys.map((m) => ({
          id: m.id,
          name: m.name,
          cpf: m.cpf,
          phone: m.phone,
          whatsapp: m.whatsapp,
          motorcycle_plate: m.motorcycle_plate,
          motorcycle_model: m.motorcycle_model,
          notes: m.notes,
          status: m.status,
          open_deliveries: m.open_deliveries,
        }))}
        canManage={canManage}
      />
    </div>
  );
}
