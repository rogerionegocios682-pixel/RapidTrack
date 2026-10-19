import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { KeyRound, UserPlus } from 'lucide-react';
import { AuthLayout } from '@/components/auth-layout';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Entrar' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { reset?: string; next?: string };
}) {
  // Já autenticado? Vai direto ao dashboard.
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  const info =
    searchParams.reset === '1'
      ? 'Senha redefinida com sucesso! Faça login com a nova senha.'
      : undefined;

  return (
    <AuthLayout title="Acessar o sistema" subtitle="Entre com suas credenciais para continuar.">
      <div className="card card-pad">
        <LoginForm info={info} />

        <div className="mt-5 space-y-3">
          <Link
            href="/esqueci-senha"
            className="btn-secondary w-full"
          >
            <KeyRound className="h-4 w-4" /> ESQUECI MINHA SENHA
          </Link>

          <Link href="/cadastro" className="btn-secondary w-full">
            <UserPlus className="h-4 w-4" /> NOVO CADASTRO
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
