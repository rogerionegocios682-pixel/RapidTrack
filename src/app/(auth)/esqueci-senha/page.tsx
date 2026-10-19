import type { Metadata } from 'next';
import { AuthFooterLink, AuthLayout } from '@/components/auth-layout';
import { ForgotForm } from './forgot-form';

export const metadata: Metadata = { title: 'Recuperar senha' };

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Esqueci minha senha"
      subtitle="Informe seu e-mail para receber o procedimento de recuperação."
    >
      <div className="card card-pad">
        <ForgotForm />
        <div className="mt-5">
          <AuthFooterLink text="Lembrou a senha?" linkText="Entrar" href="/login" />
        </div>
      </div>
    </AuthLayout>
  );
}
