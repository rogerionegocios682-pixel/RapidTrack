import type { Metadata } from 'next';
import Link from 'next/link';
import { Bike, Plus, Receipt, Table2 } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import type { Permission } from '@/lib/auth';
import { listDeliveries, countDeliveries } from '@/lib/repo/deliveries';
import { listActiveCompanies } from '@/lib/repo/companies';
import { listMotoboys } from '@/lib/repo/motoboys';
import { PageHeader } from '@/components/stat-card';
import { DeliveryStatusBadge, EmptyState } from '@/components/ui';
import { ClearFilters, SearchFilter, SelectFilter } from '@/components/page-tools';
import { DeliveryRowActions } from './row-actions';
import { formatMoney, formatDateTime } from '@/lib/format';
import { DELIVERY_STATUS_LABEL, type DeliveryStatus } from '@/lib/types';

export const metadata: Metadata = { title: 'Todas as Corridas' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

const STATUS_ORDER: DeliveryStatus[] = [
  'pending',
  'dispatched',
  'in_progress',
  'delivered',
  'cancelled',
  'customer_not_found',
];

function readParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = searchParams[key];
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export default async function AllDeliveriesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermission('deliveries.view');

  const search = readParam(searchParams, 'q');
  const statusParam = readParam(searchParams, 'status');
  const companyId = readParam(searchParams, 'empresa');
  const motoboyId = readParam(searchParams, 'motoboy');
  const pageParam = Number(readParam(searchParams, 'page') || '1');
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;

  const status =
    statusParam && STATUS_ORDER.includes(statusParam as DeliveryStatus)
      ? (statusParam as DeliveryStatus)
      : undefined;

  const filters = {
    search: search || undefined,
    status: status ?? ('all' as const),
    companyId: companyId || undefined,
    motoboyId: motoboyId || undefined,
  };

  // Busca lista + total em paralelo; o total alimenta a paginação.
  const [rows, total, companies, motoboys] = await Promise.all([
    listDeliveries(
      { ...filters, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE },
      user,
    ),
    countDeliveries(filters, user),
    listActiveCompanies(),
    listMotoboys({ status: 'all' }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const can = (p: Permission) => user.role === 'admin' || user.role === 'operator';

  const buildPageHref = (target: number) => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (status) params.set('status', status);
    if (companyId) params.set('empresa', companyId);
    if (motoboyId) params.set('motoboy', motoboyId);
    if (target > 1) params.set('page', String(target));
    const qs = params.toString();
    return qs ? `?${qs}` : '?';
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Todas as Corridas"
        description={`${total} corrida(s) encontrada(s) com os filtros atuais.`}
        action={
          can('deliveries.create') ? (
            <Link href="/dashboard/corridas/nova" className="btn-primary">
              <Plus className="h-4 w-4" /> NOVA CORRIDA
            </Link>
          ) : undefined
        }
      />

      {/* Filtros */}
      <div className="card card-pad">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchFilter
            placeholder="Buscar por pedido, cliente, empresa ou motoboy..."
            className="w-full lg:max-w-md"
          />
          <div className="flex flex-wrap items-center gap-3">
            <SelectFilter
              paramName="status"
              label="Status"
              allLabel="Todos os status"
              options={STATUS_ORDER.map((s) => ({
                value: s,
                label: DELIVERY_STATUS_LABEL[s],
              }))}
            />
            <SelectFilter
              paramName="empresa"
              label="Empresa"
              allLabel="Todas as empresas"
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
            />
            <SelectFilter
              paramName="motoboy"
              label="Motoboy"
              allLabel="Todos os motoboys"
              options={motoboys.map((m) => ({ value: m.id, label: m.name }))}
            />
            <ClearFilters />
          </div>
        </div>
      </div>

      {/* Lista */}
      <section className="card overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Table2 className="h-8 w-8" />}
            title="Nenhuma corrida encontrada"
            message={
              total === 0 && !search
                ? 'Ainda não há corridas registradas. Crie a primeira em "Nova Corrida".'
                : 'Ajuste os filtros para ver outros resultados.'
            }
            action={
              can('deliveries.create') ? (
                <Link href="/dashboard/corridas/nova" className="btn-primary">
                  <Plus className="h-4 w-4" /> NOVA CORRIDA
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Cliente</th>
                  <th>Empresa</th>
                  <th>Bairro</th>
                  <th>Motoboy</th>
                  <th>Taxa</th>
                  <th>Status</th>
                  <th>Registrada em</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td className="font-semibold text-ink-900">#{d.order_number}</td>
                    <td className="max-w-[200px] truncate" title={d.customer_name}>
                      {d.customer_name}
                    </td>
                    <td className="max-w-[180px] truncate" title={d.company_name}>
                      {d.company_name}
                    </td>
                    <td className="max-w-[160px] truncate" title={d.neighborhood_name}>
                      {d.neighborhood_name}
                      <span className="ml-1 text-xs text-ink-400">
                        ({d.neighborhood_city})
                      </span>
                    </td>
                    <td className="max-w-[160px] truncate">
                      <span className="inline-flex items-center gap-1.5">
                        <Bike className="h-3.5 w-3.5 text-ink-400" />
                        {d.motoboy_name}
                      </span>
                    </td>
                    <td className="whitespace-nowrap font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        <Receipt className="h-3.5 w-3.5 text-ink-400" />
                        {formatMoney(d.fee_cents)}
                      </span>
                    </td>
                    <td>
                      <DeliveryStatusBadge status={d.status} />
                    </td>
                    <td className="whitespace-nowrap text-xs text-ink-500">
                      {formatDateTime(d.created_at)}
                    </td>
                    <td>
                      <DeliveryRowActions
                        delivery={{
                          id: d.id,
                          order_number: d.order_number,
                          status: d.status,
                          company_id: d.company_id,
                          customer_name: d.customer_name,
                          neighborhood_id: d.neighborhood_id,
                          motoboy_id: d.motoboy_id,
                          fee_cents: d.fee_cents,
                          notes: d.notes,
                        }}
                        user={{ role: user.role, motoboy_id: user.motoboy_id }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <footer className="flex items-center justify-between gap-3 border-t border-ink-100 px-4 py-3">
            <p className="text-xs text-ink-500">
              Página {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              {page > 1 && (
                <Link href={buildPageHref(page - 1)} className="btn-secondary btn-sm">
                  Anterior
                </Link>
              )}
              {page < totalPages && (
                <Link href={buildPageHref(page + 1)} className="btn-secondary btn-sm">
                  Próxima
                </Link>
              )}
            </div>
          </footer>
        )}
      </section>
    </div>
  );
}
