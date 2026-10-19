'use client';

/**
 * Componentes reutilizáveis das páginas do dashboard.
 * ---------------------------------------------------------------------------
 * Reúnem os padrões que se repetem nas telas de listagem (busca, filtros,
 * ações destrutivas com confirmação) para que cada página cuide apenas do
 * conteúdo específico.
 */
import { useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Search } from 'lucide-react';
import { useConfirm, useToast } from '@/components/ui';
import type { ActionResult } from '@/app/actions/guard';

/**
 * Busca com atraso (debounce) que reflete o termo na URL (`?q=`).
 * Manter o filtro na URL permite recarregar/compartilhar a tela filtrada.
 */
export function SearchFilter({
  placeholder = 'Buscar...',
  paramName = 'q',
  className = '',
}: {
  placeholder?: string;
  paramName?: string;
  className?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(paramName) ?? '');
  const [isPending, startTransition] = useTransition();

  // Sincroniza quando a URL muda por outro motivo (ex.: link "limpar filtros").
  useEffect(() => {
    setValue(params.get(paramName) ?? '');
  }, [params, paramName]);

  useEffect(() => {
    const current = params.get(paramName) ?? '';
    if (value === current) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set(paramName, value.trim());
      else next.delete(paramName);
      next.delete('page');
      startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }));
    }, 350);

    return () => clearTimeout(timer);
  }, [value, params, paramName, router]);

  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="input pl-9"
      />
      {isPending && (
        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-400" />
      )}
    </div>
  );
}

/**
 * Filtro de seleção que grava o valor na URL. `options` já vem prontas do
 * servidor (ex.: lista de empresas), evitando consultas no cliente.
 */
export function SelectFilter({
  paramName,
  label,
  options,
  allLabel = 'Todos',
}: {
  paramName: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const current = params.get(paramName) ?? '';

  const onChange = (value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(paramName, value);
    else next.delete(paramName);
    next.delete('page');
    startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }));
  };

  return (
    <label className="flex items-center gap-2 text-xs font-medium text-ink-600">
      <span className="hidden whitespace-nowrap sm:inline">{label}</span>
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={`select w-auto min-w-[140px] py-2 text-sm ${isPending ? 'opacity-60' : ''}`}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Botão "limpar filtros" — limpa os parâmetros de busca da URL. */
export function ClearFilters() {
  const router = useRouter();
  const params = useSearchParams();
  if (!params.toString()) return null;

  return (
    <button
      type="button"
      onClick={() => router.replace('?', { scroll: false })}
      className="text-xs font-medium text-brand-600 hover:text-brand-700 hover:underline"
    >
      Limpar filtros
    </button>
  );
}

/**
 * Executa uma server action destrutiva com confirmação e feedback.
 * Recebe a função já vinculada ao id (ex.: `() => deleteCompanyAction(id)`).
 */
export function ConfirmActionButton({
  action,
  confirmTitle,
  confirmMessage,
  confirmLabel = 'Excluir',
  successMessage,
  className = 'btn-danger btn-sm',
  children,
}: {
  action: () => Promise<ActionResult<unknown>>;
  confirmTitle: string;
  confirmMessage: string;
  confirmLabel?: string;
  successMessage?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const confirm = useConfirm();
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onClick = async () => {
    const ok = await confirm({
      title: confirmTitle,
      message: confirmMessage,
      confirmLabel,
      danger: true,
    });
    if (!ok) return;

    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        if (successMessage) toast.success(successMessage);
        router.refresh();
      } else {
        toast.error(res.error ?? 'Não foi possível concluir a operação.');
      }
    });
  };

  return (
    <button type="button" onClick={onClick} disabled={isPending} className={className}>
      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}

/** Botão que executa uma action simples (ex.: alternar status) e exibe o retorno. */
export function PlainActionButton({
  action,
  successMessage,
  className = 'btn-secondary btn-sm',
  children,
}: {
  action: () => Promise<ActionResult<unknown>>;
  successMessage?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const toast = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        if (successMessage) toast.success(successMessage);
        router.refresh();
      } else {
        toast.error(res.error ?? 'Não foi possível concluir a operação.');
      }
    });
  };

  return (
    <button type="button" onClick={onClick} disabled={isPending} className={className}>
      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : children}
    </button>
  );
}
