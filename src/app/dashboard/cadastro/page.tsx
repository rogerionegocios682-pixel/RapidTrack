import type { Metadata } from 'next';
import Link from 'next/link';
import { Bike, Building2, ChevronRight, ClipboardList, MapPin, Receipt } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { PageHeader } from '@/components/stat-card';

export const metadata: Metadata = { title: 'Cadastro' };
export const dynamic = 'force-dynamic';

const ITEMS = [
  {
    href: '/dashboard/cadastro/empresas',
    title: 'Empresas',
    description: 'Empresas clientes e bairros atendidos.',
    icon: <Building2 className="h-5 w-5" />,
    permission: 'companies.view' as const,
  },
  {
    href: '/dashboard/cadastro/motoboys',
    title: 'Motoboys',
    description: 'Entregadores e situação atual.',
    icon: <Bike className="h-5 w-5" />,
    permission: 'motoboys.view' as const,
  },
  {
    href: '/dashboard/cadastro/bairros',
    title: 'Bairros',
    description: 'Áreas de entrega disponíveis.',
    icon: <MapPin className="h-5 w-5" />,
    permission: 'neighborhoods.view' as const,
  },
  {
    href: '/dashboard/cadastro/taxas',
    title: 'Taxas',
    description: 'Valores por empresa × bairro.',
    icon: <Receipt className="h-5 w-5" />,
    permission: 'fees.view' as const,
  },
];

export default async function CadastroIndexPage() {
  const user = await requirePermission('companies.view');
  const can = (p: (typeof ITEMS)[number]['permission']) =>
    user.role === 'admin' || user.role === 'operator';

  const visible = ITEMS.filter((i) => can(i.permission));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Cadastro"
        description="Base de dados do sistema: empresas, motoboys, bairros e taxas."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            className="card card-pad flex items-center gap-3 transition hover:shadow-pop"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
              {i.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-900">{i.title}</p>
              <p className="mt-0.5 text-xs text-ink-500">{i.description}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-300" />
          </Link>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="card card-pad flex items-center gap-3 text-sm text-ink-500">
          <ClipboardList className="h-5 w-5" />
          Você não tem permissão para gerenciar cadastros.
        </div>
      )}
    </div>
  );
}
