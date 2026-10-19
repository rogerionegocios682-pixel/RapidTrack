'use client';

/**
 * Comunicação interna (client).
 * ---------------------------------------------------------------------------
 * Compositor (mensagem direta ou comunicado) + lista de mensagens com ações
 * de marcar como lida e excluir. O envio usa Server Action com useFormState.
 */
import { useEffect, useState, useTransition } from 'react';
import { useFormState } from 'react-dom';
import { useRouter } from 'next/navigation';
import { CheckCheck, Megaphone, MessageSquarePlus, Send, Trash2, Users } from 'lucide-react';
import { Alert, SubmitButton, TextArea, Field } from '@/components/form';
import { Modal, EmptyState } from '@/components/ui';
import { ConfirmActionButton, SearchFilter } from '@/components/page-tools';
import {
  deleteMessageAction,
  markAllReadAction,
  markMessageReadAction,
  sendMessageAction,
} from '@/app/actions/app';
import { formatDateTime } from '@/lib/format';
import { ROLE_LABEL, type MessageAudience, type UserRole } from '@/lib/types';

interface Recipient {
  id: string;
  name: string;
  role: UserRole;
}

interface MessageRow {
  id: string;
  sender_id: string;
  sender_name: string;
  receiver_name: string | null;
  audience: MessageAudience;
  subject: string | null;
  message: string;
  is_announcement: number;
  is_read: number;
  created_at: string;
}

const AUDIENCE_LABEL: Record<MessageAudience, string> = {
  user: 'Direta',
  all: 'Todos',
  operators: 'Operadores',
  motoboys: 'Motoboys',
};

export function MessagesClient({
  currentUserId,
  canSend,
  canAnnounce,
  recipients,
  messages,
}: {
  currentUserId: string;
  canSend: boolean;
  canAnnounce: boolean;
  recipients: Recipient[];
  messages: MessageRow[];
}) {
  const router = useRouter();
  const [composeOpen, setComposeOpen] = useState(false);
  const [audience, setAudience] = useState<MessageAudience>('user');
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [state, formAction] = useFormState(sendMessageAction, null);
  const [isPending, startTransition] = useTransition();

  // Fecha o modal e atualiza a lista quando a mensagem é enviada.
  useEffect(() => {
    if (state?.ok) {
      setComposeOpen(false);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const closeCompose = () => {
    setComposeOpen(false);
    setAudience('user');
    setIsAnnouncement(false);
  };

  const markAll = () => {
    startTransition(async () => {
      await markAllReadAction();
      router.refresh();
    });
  };

  return (
    <>
      <div className="card card-pad">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <SearchFilter
            placeholder="Buscar por assunto, texto ou remetente..."
            className="w-full lg:max-w-md"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={markAll}
              disabled={isPending}
              className="btn-secondary btn-sm"
            >
              <CheckCheck className="h-4 w-4" /> MARCAR TODAS COMO LIDAS
            </button>
            {canSend && (
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => setComposeOpen(true)}
              >
                <MessageSquarePlus className="h-4 w-4" /> NOVA MENSAGEM
              </button>
            )}
          </div>
        </div>
      </div>

      <section className="card overflow-hidden">
        {messages.length === 0 ? (
          <EmptyState
            icon={<MessageSquarePlus className="h-8 w-8" />}
            title="Nenhuma mensagem"
            message="Não há mensagens ou comunicados no momento."
            action={
              canSend ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setComposeOpen(true)}
                >
                  <MessageSquarePlus className="h-4 w-4" /> NOVA MENSAGEM
                </button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-ink-100">
            {messages.map((m) => {
              const mine = m.sender_id === currentUserId;
              const unread = !mine && m.is_read === 0;
              return (
                <li
                  key={m.id}
                  className={`flex flex-col gap-2 p-4 transition sm:flex-row sm:items-start ${unread ? 'bg-brand-50/40' : ''
                    }`}
                >
                  <span
                    className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg ${m.is_announcement
                        ? 'bg-accent-400/20 text-accent-600'
                        : unread
                          ? 'bg-brand-100 text-brand-700'
                          : 'bg-ink-100 text-ink-500'
                      }`}
                  >
                    {m.is_announcement ? (
                      <Megaphone className="h-4 w-4" />
                    ) : (
                      <Users className="h-4 w-4" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink-900">
                        {m.subject || (m.is_announcement ? 'Comunicado' : 'Mensagem')}
                      </p>
                      {m.is_announcement === 1 && (
                        <span className="badge bg-accent-400/15 text-accent-600 ring-accent-400/30">
                          Comunicado
                        </span>
                      )}
                      {m.audience !== 'user' && (
                        <span className="badge bg-ink-100 text-ink-600 ring-ink-200">
                          {AUDIENCE_LABEL[m.audience]}
                        </span>
                      )}
                      {unread && (
                        <span className="badge bg-brand-600 text-white ring-brand-600">Nova</span>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-ink-600">{m.message}</p>
                    <p className="mt-1.5 text-xs text-ink-400">
                      {mine ? 'Você' : m.sender_name}
                      {m.receiver_name ? ` → ${m.receiver_name}` : ''} · {formatDateTime(m.created_at)}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {unread && (
                      <button
                        type="button"
                        className="btn-ghost btn-sm text-xs"
                        onClick={() =>
                          startTransition(async () => {
                            await markMessageReadAction(m.id);
                            router.refresh();
                          })
                        }
                      >
                        <CheckCheck className="h-4 w-4" /> Lida
                      </button>
                    )}
                    {(mine || canAnnounce) && (
                      <ConfirmActionButton
                        action={() => deleteMessageAction(m.id)}
                        confirmTitle="Excluir mensagem"
                        confirmMessage="Excluir esta mensagem? Esta ação não pode ser desfeita."
                        successMessage="Mensagem excluída."
                        className="btn-ghost btn-sm p-1.5 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </ConfirmActionButton>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Compositor */}
      <Modal
        open={composeOpen}
        onClose={closeCompose}
        title={isAnnouncement ? 'Novo comunicado' : 'Nova mensagem'}
        subtitle="Envie uma mensagem direta ou um comunicado para um grupo."
      >
        <form action={formAction} className="space-y-4">
          {state?.error && <Alert kind="error" message={state.error} />}

          {canAnnounce && (
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input
                type="checkbox"
                name="is_announcement"
                checked={isAnnouncement}
                onChange={(e) => {
                  setIsAnnouncement(e.target.checked);
                  if (e.target.checked && audience === 'user') setAudience('all');
                }}
                className="h-4 w-4 rounded border-ink-300 text-brand-600"
              />
              Publicar como comunicado (aviso oficial, aparece para o grupo escolhido)
            </label>
          )}

          <div>
            <label htmlFor="audience" className="label">
              Destinatário
            </label>
            <select
              id="audience"
              name="audience"
              className="select"
              value={audience}
              onChange={(e) => setAudience(e.target.value as MessageAudience)}
              disabled={isAnnouncement}
            >
              <option value="user">Um usuário específico</option>
              <option value="all">Todos</option>
              <option value="operators">Operadores</option>
              <option value="motoboys">Motoboys</option>
            </select>
          </div>

          {audience === 'user' && (
            <div>
              <label htmlFor="receiver_id" className="label">
                Para <span className="text-rose-500">*</span>
              </label>
              <select id="receiver_id" name="receiver_id" className="select" required>
                <option value="">Selecione...</option>
                {recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({ROLE_LABEL[r.role]})
                  </option>
                ))}
              </select>
            </div>
          )}

          <Field label="Assunto" name="subject" maxLength={150} placeholder="Opcional" />
          <TextArea
            label="Mensagem"
            name="message"
            required
            rows={5}
            maxLength={2000}
            placeholder="Escreva sua mensagem..."
          />

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary w-full sm:w-auto" onClick={closeCompose}>
              Cancelar
            </button>
            <SubmitButton
              label={isAnnouncement ? 'Publicar comunicado' : 'Enviar mensagem'}
              pendingLabel="Enviando..."
              className="btn-primary w-full sm:w-auto"
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
