import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { listActiveCompanies } from '@/lib/repo/companies';
import { listActiveMotoboys } from '@/lib/repo/motoboys';
import { PageHeader } from '@/components/stat-card';
import { NewDeliveryForm } from './new-form';

export const metadata: Metadata = { title: 'Nova Corrida' };
export const dynamic = 'force-dynamic';

export default async function NewDeliveryPage() {
  await requirePermission('deliveries.create');

  // Dados para os selects. Os bairros/taxas da empresa são carregados sob
  // demanda conforme a empresa escolhida (ver server action em actions/).
  const [companies, motoboys] = await Promise.all([listActiveCompanies(), listActiveMotoboys()]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Nova Corrida"
        description="Registre uma nova entrega e despache para um motoboy."
        action={
          <Link href="/dashboard/corridas" className="btn-secondary">
            <ArrowLeft className="h-4 w-4" /> VOLTAR
          </Link>
        }
      />

      <div className="card card-pad">
        <NewDeliveryForm
          companies={companies.map((c) => ({ id: c.id, name: c.name }))}
          motoboys={motoboys.map((m) => ({ id: m.id, name: m.name }))}
        />
      </div>
    </div>
  );
}
