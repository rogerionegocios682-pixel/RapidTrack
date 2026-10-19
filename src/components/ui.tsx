'use client';

/**
 * Componentes de UI compartilhados: toasts, modal de confirmação,
 * badges de status, estado vazio e indicador de tempo real.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X, Wifi, WifiOff } from 'lucide-react';
import {
  DELIVERY_STATUS_COLOR,
  DELIVERY_STATUS_LABEL,
  MOTOBOY_STATUS_COLOR,
  MOTOBOY_STATUS_LABEL,
  type DeliveryStatus,
  type MotoboyStatus,
} from '@/lib/types';

/* ============================== TOASTS ================================= */

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastCtx {
  push: (kind: ToastKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const api = useMemo<ToastCtx>(
    () => ({
      push,
      success: (m) => push('success', m),
      error: (m) => push('error', m),
      info: (m) => push('info', m),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex-col items-center gap-2 p-3 sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-auto sm:items-end"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm animate-slide-in items-start gap-3 rounded-xl border p-3 shadow-pop ${t.kind === 'success'
                ? 'border-emerald-200 bg-emerald-50'
                : t.kind === 'error'
                  ? 'border-rose-200 bg-rose-50'
                  : 'border-brand-200 bg-brand-50'
              }`}
          >
            {t.kind === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            ) : t.kind === 'error' ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
            ) : (
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
            )}
            <p
              className={`flex-1 text-sm font-medium ${t.kind === 'success'
                  ? 'text-emerald-800'
                  : t.kind === 'error'
                    ? 'text-rose-800'
                    : 'text-brand-800'
                }`}
            >
              {t.message}
            </p>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="rounded p-0.5 text-ink-400 hover:bg-white/60 hover:text-ink-700"
              aria-label="Fechar aviso"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>.');
  return ctx;
}

/* ========================= CONFIRMAÇÃO ================================= */

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

const ConfirmContext = createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null);

/** Substitui o window.confirm() por um modal acessível e estilizado. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  );

  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div className="w-full max-w-md animate-fade-in rounded-t-2xl bg-white p-5 shadow-pop sm:rounded-2xl">
            <div className="flex items-start gap-3">
              <span
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${state.danger ? 'bg-rose-100' : 'bg-brand-100'
                  }`}
              >
                <AlertTriangle
                  className={`h-5 w-5 ${state.danger ? 'text-rose-600' : 'text-brand-600'}`}
                />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="confirm-title" className="text-base font-semibold text-ink-900">
                  {state.title}
                </h2>
                <p className="mt-1 text-sm text-ink-600">{state.message}</p>
              </div>
            </div>
            <div className="mt-5 flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn-secondary w-full sm:w-auto"
                onClick={() => close(false)}
              >
                {state.cancelLabel ?? 'Cancelar'}
              </button>
              <button
                type="button"
                autoFocus
                className={`${state.danger ? 'btn-danger' : 'btn-primary'} w-full sm:w-auto`}
                onClick={() => close(true)}
              >
                {state.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm deve ser usado dentro de <ConfirmProvider>.');
  return ctx;
}

/* ============================= BADGES ================================== */

export function DeliveryStatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <span className={`badge ${DELIVERY_STATUS_COLOR[status]}`}>
      {DELIVERY_STATUS_LABEL[status]}
    </span>
  );
}

export function MotoboyStatusBadge({ status }: { status: MotoboyStatus }) {
  return (
    <span className={`badge ${MOTOBOY_STATUS_COLOR[status]}`}>
      {MOTOBOY_STATUS_LABEL[status]}
    </span>
  );
}

export function ActiveStatusBadge({ status }: { status: 'active' | 'inactive' }) {
  return (
    <span
      className={`badge ${status === 'active'
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          : 'bg-ink-100 text-ink-600 ring-ink-200'
        }`}
    >
      {status === 'active' ? 'Ativa' : 'Inativa'}
    </span>
  );
}

/* ========================= ESTADOS VAZIOS =============================== */

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 text-ink-300">{icon}</div>}
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      {message && <p className="max-w-md text-sm text-ink-500">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/* ==================== INDICADOR DE TEMPO REAL ========================== */

export function RealtimeIndicator({ status }: { status: 'connecting' | 'online' | 'offline' }) {
  const map = {
    online: { label: 'Tempo real', cls: 'text-emerald-600 bg-emerald-50 ring-emerald-200', Icon: Wifi },
    connecting: { label: 'Conectando', cls: 'text-ink-500 bg-ink-100 ring-ink-200', Icon: Loader2 },
    offline: { label: 'Offline', cls: 'text-rose-600 bg-rose-50 ring-rose-200', Icon: WifiOff },
  } as const;
  const { label, cls, Icon } = map[status];

  return (
    <span
      className={`badge ${cls}`}
      title={
        status === 'online'
          ? 'Sincronização em tempo real ativa'
          : status === 'connecting'
            ? 'Estabelecendo conexão...'
            : 'Sem conexão — tentando reconectar'
      }
    >
      <Icon className={`h-3.5 w-3.5 ${status === 'connecting' ? 'animate-spin' : ''}`} />
      <span className="hidden sm:inline">{label}</span>
    </span>
  );
}

/* ============================== MODAL ================================== */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  } as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/50 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`flex max-h-[92vh] w-full ${widths[size]} animate-fade-in flex-col rounded-t-2xl bg-white shadow-pop sm:rounded-2xl`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-ink-100 p-4 sm:p-5">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-ink-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
