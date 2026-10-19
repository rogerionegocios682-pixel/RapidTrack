import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthFooterLink, AuthLayout } from '@/components/auth-layout';
import { getCurrentUser } from '@/lib/auth';
import { RegisterForm } from './register-form';

export const metadata: Metadata = { title: 'Novo cadastro' };

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <AuthLayout
      title="Criar novo cadastro"
      subtitle="Preencha os dados para acessar o Delivery_OS."
    >
      <div className="card card-pad">
        <RegisterForm />
        <div className="mt-5">
          <AuthFooterLink
            text="Já possui uma conta?"
            linkText="Entrar"
            href="/login"
          />
        </div>
      </div>
    </AuthLayout>
  );
}
