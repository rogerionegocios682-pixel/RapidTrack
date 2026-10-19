import Link from 'next/link';

/**
 * Card de indicador. Os valores vêm sempre do banco (calculados no servidor).
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'default',
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger' | 'muted';
  href?: string;
}) {
  const tones = {
    default: 'bg-white text-ink-900',
    brand: 'bg-brand-50 text-brand-900 ring-brand-100',
    success: 'bg-emerald-50 text-emerald-900 ring-emerald-100',
    warning: 'bg-accent-400/10 text-ink-900 ring-accent-400/20',
    danger: 'bg-rose-50 text-rose-900 ring-rose-100',
    muted: 'bg-ink-50 text-ink-700 ring-ink-200',
  } as const;

  const iconTones = {
    default: 'bg-ink-100 text-ink-600',
    brand: 'bg-brand-100 text-brand-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-accent-400/20 text-accent-600',
    danger: 'bg-rose-100 text-rose-700',
    muted: 'bg-ink-200 text-ink-600',
  } as const;

  const body = (
    <div
      className={`card h-full p-4 ring-1 ring-inset transition ${tones[tone]} ${href ? 'hover:shadow-pop' : ''
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-ink-500">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-bold leading-none tracking-tight">{value}</p>
          {hint && <p className="mt-1.5 text-xs text-ink-500">{hint}</p>}
        </div>
        {icon && (
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${iconTones[tone]}`}
          >
            {icon}
          </span>
        )}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Cabeçalho de página com título, descrição e ação opcional. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}

/** Bloco com título usado para agrupar conteúdo. */
export function Section({
  title,
  description,
  action,
  children,
  className = '',
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="flex flex-col gap-2 border-b border-ink-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink-900">{title}</h2>}
            {description && <p className="card-sub mt-0.5">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
