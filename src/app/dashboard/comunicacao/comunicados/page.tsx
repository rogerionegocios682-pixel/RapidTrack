import type { Metadata } from 'next';
import { Megaphone } from 'lucide-react';
import { requirePermission } from '@/lib/auth';
import { listAnnouncements } from '@/lib/repo/messages';
import { PageHeader } from '@/components/stat-card';
import { EmptyState } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { AnnouncementComposer } from './composer';

export const metadata: Metadata = { title: 'Comunicados' };
export const dynamic = 'force-dynamic';

export default async function AnnouncementsPage() {
  const user = await requirePermission('messages.view');
  const announcements = await listAnnouncements(user);
  const canAnnounce = user.role === 'admin' || user.role === 'operator';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Comunicados"
        description="Avisos oficiais publicados para a equipe."
        action={canAnnounce ? <AnnouncementComposer /> : undefined}
      />

      {announcements.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Megaphone className="h-8 w-8" />}
            title="Nenhum comunicado publicado"
            message={
              canAnnounce
                ? 'Publique um comunicado para informar toda a equipe de uma só vez.'
                : 'Ainda não há comunicados para você.'
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <article key={a.id} className="card card-pad">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-accent-400/20 text-accent-600">
                  <Megaphone className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-ink-900">
                    {a.subject || 'Comunicado'}
                  </h2>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">{a.message}</p>
                  <p className="mt-2 text-xs text-ink-400">
                    Por {a.sender_name} · {formatDateTime(a.created_at)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
