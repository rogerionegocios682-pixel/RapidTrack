'use client';

/**
 * Botão + modal para publicar um comunicado.
 * Envia com `is_announcement=on` e audience de grupo (todos/operadores/motoboys).
 */
import { useEffect, useState } from 'react';
import { useFormState } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import { Alert, Field, SubmitButton, TextArea } from '@/components/form';
import { Modal } from '@/components/ui';
import { sendMessageAction } from '@/app/actions/app';

export function AnnouncementComposer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(sendMessageAction, null);

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <Megaphone className="h-4 w-4" /> NOVO COMUNICADO
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo comunicado"
        subtitle="Um aviso oficial visível para todo o grupo escolhido."
        size="md"
      >
        <form action={formAction} className="space-y-4">
          {state?.error && <Alert kind="error" message={state.error} />}
          <input type="hidden" name="is_announcement" value="on" />

          <div>
            <label htmlFor="audience" className="label">
              Público <span className="text-rose-500">*</span>
            </label>
            <select id="audience" name="audience" className="select" defaultValue="all">
              <option value="all">Todos</option>
              <option value="operators">Operadores</option>
              <option value="motoboys">Motoboys</option>
            </select>
          </div>

          <Field label="Título" name="subject" required maxLength={150} />
          <TextArea label="Conteúdo" name="message" required rows={5} maxLength={2000} />

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <SubmitButton
              label="Publicar comunicado"
              pendingLabel="Publicando..."
              className="btn-primary w-full sm:w-auto"
            />
          </div>
        </form>
      </Modal>
    </>
  );
}
