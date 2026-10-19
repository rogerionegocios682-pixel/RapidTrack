import type { Metadata } from 'next';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { AuthLayout } from '@/components/auth-layout';
import { ResetForm } from './reset-form';

export const metadata: Metadata = { title: 'Redefinir senha' };

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? '';

  if (!token) {
    return (
      <AuthLayout
        title="Link inválido"
        subtitle="Este link de recuperação está incompleto ou expirado."
      >
        <div className="card card-pad space-y-4">
          <div className="flex items-start gap-3 rounded-lg border-rose-200 bg-rose-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            <p className="text-sm text-rose-800">
              Não encontramos um token de recuperação válido. Solicite um novo link.
            </p>
          </div>
          <Link href="/esqueci-senha" className="btn-primary w-full">
            Solicitar novo link
          </Link>
          <Link href="/login" className="btn-secondary w-full">
            Voltar para o login
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Criar nova senha"
      subtitle="Defina uma nova senha para acessar o Delivery_OS."
    >
      <div className="card card-pad">
        <ResetForm token={token} />
        <div className="mt-5">
          <Link href="/login" className="btn-secondary w-full">
            Voltar para o login
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
