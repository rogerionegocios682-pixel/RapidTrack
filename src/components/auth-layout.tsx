import Link from 'next/link';
import { Car, ShieldCheck, Zap, BarChart3 } from 'lucide-react';

/**
 * Moldura visual das telas de autenticação (login, cadastro, recuperação).
 * Painel de marca à esquerda (desktop) + conteúdo à direita.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* Painel de marca */}
      <aside className="relative hidden w-[45%] flex-col justify-between overflow-hidden bg-ink-950 p-10 text-white lg:flex xl:w-[42%]">
        {/* Gradiente de fundo */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-brand-700 via-ink-950 to-ink-950"
          aria-hidden
        />
        <div
          className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-500/25 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-accent-500/15 blur-3xl"
          aria-hidden
        />

        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
              <Car className="h-6 w-6" />
            </span>
            <div>
              <p className="text-lg font-bold tracking-tight">DELIVERY_OS</p>
              <p className="text-xs text-white/60">Gestão de Entregas e Motoboys</p>
            </div>
          </div>
        </div>

        <div className="relative space-y-8">
          <div>
            <h2 className="text-3xl font-bold leading-tight tracking-tight xl:text-4xl">
              Controle total da sua
              <br />
              operação de delivery.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
              Despache corridas, acompanhe motoboys, gerencie empresas clientes e feche
              relatórios financeiros — tudo em tempo real, de qualquer dispositivo.
            </p>
          </div>

          <ul className="space-y-4">
            {[
              { icon: <Zap className="h-4 w-4" />, text: 'Sincronização em tempo real entre computador e celular' },
              { icon: <BarChart3 className="h-4 w-4" />, text: 'Relatórios por motoboy, empresa e período' },
              { icon: <ShieldCheck className="h-4 w-4" />, text: 'Permissões por perfil e auditoria de operações' },
            ].map((f) => (
              <li key={f.text} className="flex items-start gap-3 text-sm text-white/80">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  {f.icon}
                </span>
                <span className="pt-1">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/40">
          © {new Date().getFullYear()} Delivery_OS — Sistema de Gestão de Entregas
        </p>
      </aside>

      {/* Conteúdo */}
      <main className="flex flex-1 items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-md">
          {/* Marca no mobile */}
          <div className="mb-8 flex-col items-center gap-2 text-center lg:hidden">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white shadow-pop">
              <Car className="h-6 w-6" />
            </span>
            <div>
              <p className="text-base font-bold tracking-tight text-ink-900">DELIVERY_OS</p>
              <p className="text-xs text-ink-500">Sistema de Gestão de Entregas e Motoboys</p>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-ink-900">{title}</h1>
            <p className="mt-1.5 text-sm text-ink-500">{subtitle}</p>
          </div>

          {children}

          <p className="mt-6 text-center text-xs text-ink-400 lg:hidden">
            Delivery_OS · Sistema de Gestão de Entregas
          </p>
        </div>
      </main>
    </div>
  );
}

export function AuthFooterLink({
  text,
  linkText,
  href,
}: {
  text: string;
  linkText: string;
  href: string;
}) {
  return (
    <p className="text-center text-sm text-ink-500">
      {text}{' '}
      <Link href={href} className="font-semibold text-brand-600 hover:text-brand-700 hover:underline">
        {linkText}
      </Link>
    </p>
  );
}

/** Alerta de erro/sucesso reutilizado nos formulários de autenticação. */
export function FormAlert({ kind, message }: { kind: 'error' | 'success' | 'info'; message: string }) {
  const styles = {
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-brand-200 bg-brand-50 text-brand-800',
  };
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border p-3 text-sm font-medium ${styles[kind]}`}
    >
      {message}
    </div>
  );
}
