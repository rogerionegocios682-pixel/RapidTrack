import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth';
import { listMessages, listMessageRecipients } from '@/lib/repo/messages';
import { PageHeader } from '@/components/stat-card';
import { MessagesClient } from './client';

export const metadata: Metadata = { title: 'Mensagens' };
export const dynamic = 'force-dynamic';

function readParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const v = searchParams[key];
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requirePermission('messages.view');

  const search = readParam(searchParams, 'q');
  const onlyUnread = readParam(searchParams, 'naolidas') === '1';

  const [messages, recipients] = await Promise.all([
    listMessages(user, { search: search || undefined, onlyUnread }),
    listMessageRecipients(user),
  ]);

  const canSend = user.role === 'admin' || user.role === 'operator' || user.role === 'motoboy';

  return (
    <div className="space-y-5">
      <PageHeader
        title="Comunicação Interna"
        description="Mensagens diretas e avisos entre a equipe da operação."
      />
      <MessagesClient
        currentUserId={user.id}
        canSend={canSend}
        canAnnounce={user.role === 'admin' || user.role === 'operator'}
        recipients={recipients}
        messages={messages.map((m) => ({
          id: m.id,
          sender_id: m.sender_id,
          sender_name: m.sender_name,
          receiver_name: m.receiver_name,
          audience: m.audience,
          subject: m.subject,
          message: m.message,
          is_announcement: m.is_announcement,
          is_read: m.is_read,
          created_at: m.created_at,
        }))}
      />
    </div>
  );
}
