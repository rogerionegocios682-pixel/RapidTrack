import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/types';
import { PageHeader } from '@/components/stat-card';
import { formatDateTime } from '@/lib/format';
import { ProfileForms } from './forms';

export const metadata: Metadata = { title: 'Meu Perfil' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Meu Perfil" description="Atualize seus dados e troque a senha de acesso." />

      <section className="card card-pad">
        <div className="flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-600 text-xl font-bold uppercase text-white">
            {user.name.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink-900">{user.name}</p>
            <p className="truncate text-sm text-ink-500">{user.email}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-400">
              <span className="badge bg-brand-50 text-brand-700 ring-brand-200">
                {ROLE_LABEL[user.role]}
              </span>
              {user.last_login_at && <span>Último acesso: {formatDateTime(user.last_login_at)}</span>}
            </p>
          </div>
        </div>
      </section>

      <ProfileForms name={user.name} phone={user.phone ?? ''} />
    </div>
  );
}
