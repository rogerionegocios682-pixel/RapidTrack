'use client';

/**
 * Componentes de formulário reutilizáveis.
 * ---------------------------------------------------------------------------
 * `CrudModal` abre um modal com um formulário ligado a uma Server Action e
 * trata o estado de envio (useFormState/useFormStatus), exibindo o erro
 * devolvido pela action sem derrubar a página.
 */
import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { Modal, useToast } from '@/components/ui';
import { maskCep, maskCnpj, maskCpf, maskPhone } from '@/lib/format';
import type { ActionResult } from '@/app/actions/guard';

/** Alerta em linha para mensagens de erro/sucesso dentro de formulários. */
export function Alert({
  kind,
  message,
}: {
  kind: 'error' | 'success' | 'info';
  message: string;
}) {
  const styles = {
    error: 'border-rose-200 bg-rose-50 text-rose-800',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    info: 'border-brand-200 bg-brand-50 text-brand-800',
  } as const;
  const Icon = kind === 'success' ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${styles[kind]}`} role="alert">
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="flex-1 font-medium">{message}</p>
    </div>
  );
}

/** Botão de envio que se desabilita e mostra progresso enquanto a action roda. */
export function SubmitButton({
  label,
  pendingLabel = 'Salvando...',
  className = 'btn-primary',
}: {
  label: string;
  pendingLabel?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> {pendingLabel}
        </>
      ) : (
        label
      )}
    </button>
  );
}

type FormAction = (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;

/**
 * Modal com formulário. `children` recebe os campos; o estado do modal é
 * controlado pelo pai (abrir/fechar), e ao ter sucesso o modal fecha e a
 * lista é atualizada.
 */
export function CrudModal({
  open,
  onClose,
  title,
  subtitle,
  action,
  successMessage,
  size = 'md',
  children,
  submitLabel = 'Salvar',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  action: FormAction;
  successMessage?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  children: React.ReactNode;
  submitLabel?: string;
}) {
  const [state, formAction] = useFormState<ActionResult | null, FormData>(action, null);
  const toast = useToast();
  const [wasOpen, setWasOpen] = useState(open);

  // Quando o modal é reaberto, descarta o erro da tentativa anterior.
  useEffect(() => {
    if (open && !wasOpen) setWasOpen(true);
    if (!open && wasOpen) setWasOpen(false);
  }, [open, wasOpen]);

  useEffect(() => {
    if (state?.ok && open) {
      if (successMessage) toast.success(successMessage);
      onClose();
      setWasOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} size={size}>
      <form action={formAction} className="space-y-4">
        {state?.error && <Alert kind="error" message={state.error} />}
        {children}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary w-full sm:w-auto" onClick={onClose}>
            Cancelar
          </button>
          <SubmitButton label={submitLabel} className="btn-primary w-full sm:w-auto" />
        </div>
      </form>
    </Modal>
  );
}

/** Campo de texto padrão com rótulo. */
export function Field({
  label,
  name,
  defaultValue,
  placeholder,
  type = 'text',
  required,
  hint,
  maxLength,
  autoFocus,
  className = '',
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  placeholder?: string;
  type?: string;
  required?: boolean;
  hint?: string;
  maxLength?: number;
  autoFocus?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        autoFocus={autoFocus}
        className="input"
      />
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

/**
 * Campo de texto com máscara aplicada em tempo real (CPF, CNPJ, telefone, CEP).
 * O valor é enviado com a máscara; o backend normaliza com `cleanDigits`.
 */
export function MaskedField({
  label,
  name,
  mask,
  defaultValue,
  placeholder,
  required,
  hint,
  className = '',
}: {
  label: string;
  name: string;
  mask: 'cpf' | 'cnpj' | 'phone' | 'cep';
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  className?: string;
}) {
  const maskers = { cpf: maskCpf, cnpj: maskCnpj, phone: maskPhone, cep: maskCep } as const;
  const [value, setValue] = useState(() =>
    defaultValue ? maskers[mask](String(defaultValue)) : '',
  );

  return (
    <div className={className}>
      <label htmlFor={name} className="label">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(maskers[mask](e.target.value))}
        placeholder={placeholder}
        required={required}
        className="input"
      />
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

/** Área de texto com rótulo. */
export function TextArea({
  label,
  name,
  defaultValue,
  placeholder,
  required,
  rows = 3,
  maxLength,
  className = '',
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  maxLength?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <textarea
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        required={required}
        rows={rows}
        maxLength={maxLength}
        className="textarea"
      />
    </div>
  );
}

/** Seleção com rótulo. `options` vêm prontas do servidor. */
export function SelectField({
  label,
  name,
  options,
  defaultValue,
  required,
  includeEmpty,
  emptyLabel = 'Selecione...',
  hint,
  className = '',
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string | null;
  required?: boolean;
  includeEmpty?: boolean;
  emptyLabel?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        required={required}
        className="select"
      >
        {includeEmpty && <option value="">{emptyLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}
