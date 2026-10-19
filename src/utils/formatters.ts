/**
 * Utility functions for formatting and validating Brazilian standards (Delivery OS)
 */

export function formatCurrency(value: number): string {
  if (isNaN(value) || value === null || value === undefined) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(dateString: string | Date | undefined): string {
  if (!dateString) return '--/--/----';
  const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(d.getTime())) {
    // If it's already YYYY-MM-DD
    if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    return String(dateString);
  }
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Recife',
  }).format(d);
}

export function formatDateTime(dateString: string | Date | undefined): string {
  if (!dateString) return '--/--/---- --:--';
  const d = typeof dateString === 'string' ? new Date(dateString) : dateString;
  if (isNaN(d.getTime())) return String(dateString);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Recife',
  }).format(d);
}

export function formatTime(timeOrDate: string | Date | undefined): string {
  if (!timeOrDate) return '--:--';
  if (typeof timeOrDate === 'string' && /^\d{2}:\d{2}/.test(timeOrDate)) {
    return timeOrDate.slice(0, 5);
  }
  const d = typeof timeOrDate === 'string' ? new Date(timeOrDate) : timeOrDate;
  if (isNaN(d.getTime())) return String(timeOrDate);
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Recife',
  }).format(d);
}

export function getTodayOperationalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getCurrentShift(): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'Manhã';
  if (hour >= 12 && hour < 18) return 'Almoço / Tarde';
  if (hour >= 18 && hour < 24) return 'Noite';
  return 'Madrugada';
}

export function maskCpf(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 11);
  return cleaned
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function maskCpfRedacted(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, '');
  if (cleaned.length !== 11) return '***.***.***-**';
  return `***.***.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
}

export function validateCpf(cpf: string): boolean {
  if (!cpf) return false;
  const clean = cpf.replace(/\D/g, '');
  // Validates that it has 11 numeric digits
  return clean.length === 11;
}

export function maskCnpj(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 14);
  return cleaned
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function validateCnpj(cnpj: string): boolean {
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(clean)) return false;
  return true;
}

export function maskPhone(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 11);
  if (cleaned.length <= 10) {
    return cleaned
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return cleaned
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

export function maskCep(value: string): string {
  const cleaned = value.replace(/\D/g, '').slice(0, 8);
  return cleaned.replace(/^(\d{5})(\d)/, '$1-$2');
}
