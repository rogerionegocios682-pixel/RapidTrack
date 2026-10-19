'use client';

/**
 * Formulários de perfil: dados pessoais e troca de senha.
 * Cada um usa useFormState com sua própria Server Action.
 */
import { useEffect } from 'react';
import { useFormState } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Alert, Field, SubmitButton } from '@/components/form';
import { Section } from '@/components/stat-card';
import { useToast } from '@/components/ui';
import { changePasswordAction, updateProfileAction } from '@/app/actions/app';

export function ProfileForms({ name, phone }: { name: string; phone: string }) {
  const router = useRouter();
  const toast = useToast();

  const [profileState, profileAction] = useFormState(updateProfileAction, null);
  const [passwordState, passwordAction] = useFormState(changePasswordAction, null);

  useEffect(() => {
    if (profileState?.ok) {
      toast.success('Dados atualizados.');
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileState]);

  useEffect(() => {
    if (passwordState?.ok) {
      toast.success('Senha alterada com sucesso.');
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passwordState]);

  return (
    <div className="space-y-5">
      <Section title="Dados pessoais" description="Nome exibido e telefone de contato.">
        <form action={profileAction} className="space-y-4 p-4 sm:p-5">
          {profileState?.error && <Alert kind="error" message={profileState.error} />}
          <Field label="Nome completo" name="name" defaultValue={name} required maxLength={150} />
          <Field
            label="Telefone"
            name="phone"
            defaultValue={phone}
            maxLength={30}
            placeholder="(00) 00000-0000"
          />
          <div className="flex justify-end">
            <SubmitButton label="Salvar dados" className="btn-primary" />
          </div>
        </form>
      </Section>

      <Section
        title="Alterar senha"
        description="Confirme a senha atual para definir uma nova."
      >
        <form action={passwordAction} className="space-y-4 p-4 sm:p-5">
          {passwordState?.error && <Alert kind="error" message={passwordState.error} />}
          <Field label="Senha atual" name="currentPassword" type="password" required />
          <Field
            label="Nova senha"
            name="newPassword"
            type="password"
            required
            hint="Ao menos 6 caracteres."
          />
          <Field label="Confirmar nova senha" name="confirmPassword" type="password" required />
          <div className="flex justify-end">
            <SubmitButton label="Alterar senha" className="btn-primary" />
          </div>
        </form>
      </Section>
    </div>
  );
}
