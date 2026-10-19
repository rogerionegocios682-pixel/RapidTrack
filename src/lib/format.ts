/**
 * Utilitários de formatação — SEGUROS PARA O CLIENTE.
 * ---------------------------------------------------------------------------
 * Este módulo não importa nada de Node (`node:crypto`, `node:fs` etc.), então
 * pode ser usado tanto em Server Components quanto em Client Components.
 * A geração de IDs, hashing de senha e leitura de arquivos ficam em
 * `lib/server-utils.ts` (exclusivo do servidor).
 */

/* ---------------------------------------------------------------------------
 * Dinheiro — valores em centavos (inteiros), evita erro de ponto flutuante
 * -------------------------------------------------------------------------*/
export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format((cents || 0) / 100);
}

/** Converte entrada do usuário ("8,50", "R$ 12.00", "8.5") em centavos. */
export function parseMoneyToCents(input: string | number): number {
  if (typeof input === 'number') return Math.round(input * 100);
  const cleaned = String(input)
    .replace(/[^\d.,-]/g, '')
    .trim();
  if (!cleaned) return 0;

  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized = cleaned;

  if (lastComma > -1 && lastDot > -1) {
    // O separador decimal é o que aparece por último.
    normalized =
      lastComma > lastDot
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '');
  } else if (lastComma > -1) {
    normalized = cleaned.replace(',', '.');
  }

  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

/* ---------------------------------------------------------------------------
 * Datas — persistidas em ISO-8601 UTC, exibidas em pt-BR (America/Sao_Paulo)
 * -------------------------------------------------------------------------*/

/** Data (YYYY-MM-DD) no fuso America/Sao_Paulo — usada para agrupar "hoje". */
export function localDateKey(d: Date | string = new Date()): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  // en-CA devolve exatamente YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return `${formatDate(iso)} ${formatTime(iso)}`;
}

/** Converte "YYYY-MM-DD" em "DD/MM/YYYY" sem envolver fuso horário. */
export function formatDayKey(dateKey: string): string {
  if (!dateKey || dateKey.length < 10) return dateKey;
  const [y, m, d] = dateKey.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Adiciona dias a uma data (usado no cálculo de períodos). */
export function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * Intervalo UTC [start, end) correspondente a um dia local (America/Sao_Paulo).
 * Usado para filtrar `created_at` (UTC) por dia local.
 */
export function dayRangeIso(dateKey: string): { start: string; end: string } {
  // São Paulo é UTC-3 (sem horário de verão desde 2019).
  const [y, m, d] = dateKey.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 3, 0, 0, 0));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

/* ---------------------------------------------------------------------------
 * Sanitização de entrada (sem dependências de Node)
 * -------------------------------------------------------------------------*/

/** Remove caracteres de controle e limita o tamanho (defesa contra injeção). */
export function clean(value: unknown, maxLen = 500): string {
  if (value === null || value === undefined) return '';
  return String(value)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export function cleanDigits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '');
}

export function normalizeEmail(value: unknown): string {
  return clean(value, 200).toLowerCase();
}

/* ---------------------------------------------------------------------------
 * Documentos e contatos — máscaras de exibição e validação real
 * -------------------------------------------------------------------------*/

/** Formata um CPF (11 dígitos) como `000.000.000-00`. */
export function maskCpf(value: string): string {
  return cleanDigits(value)
    .slice(0, 11)
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

/**
 * Mascara um CPF para exibição parcial (LGPD): `***.***.123-**`.
 * Se não houver 11 dígitos, devolve a máscara totalmente oculta.
 */
export function maskCpfRedacted(cpf: string): string {
  const digits = cleanDigits(cpf);
  if (digits.length !== 11) return '***.***.***-**';
  return `***.***.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

/** Formata um CNPJ (14 dígitos) como `00.000.000/0000-00`. */
export function maskCnpj(value: string): string {
  return cleanDigits(value)
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/** Formata telefone com DDD: `(00) 0000-0000` (fixo) ou `(00) 00000-0000` (celular). */
export function maskPhone(value: string): string {
  const digits = cleanDigits(value).slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

/** Formata um CEP (8 dígitos) como `00000-000`. */
export function maskCep(value: string): string {
  return cleanDigits(value)
    .slice(0, 8)
    .replace(/^(\d{5})(\d)/, '$1-$2');
}

/** Valida CPF com dígitos verificadores (rejeita sequências repetidas). */
export function isValidCpf(cpf: string): boolean {
  const digits = cleanDigits(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcDigit = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(digits.charAt(i)) * (len + 1 - i);
    const rest = 11 - (sum % 11);
    return rest >= 10 ? 0 : rest;
  };

  return calcDigit(9) === Number(digits.charAt(9)) && calcDigit(10) === Number(digits.charAt(10));
}

/** Valida CNPJ com dígitos verificadores (rejeita sequências repetidas). */
export function isValidCnpj(cnpj: string): boolean {
  const digits = cleanDigits(cnpj);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calcDigit = (len: number): number => {
    const weights = len === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(digits.charAt(i)) * weights[i];
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };

  return calcDigit(12) === Number(digits.charAt(12)) && calcDigit(13) === Number(digits.charAt(13));
}
