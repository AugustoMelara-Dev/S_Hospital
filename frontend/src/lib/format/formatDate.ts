/**
 * Date helpers for the cashier UI.
 *
 * The app targets es-HN where the convention is DD/MM/YYYY for the
 * calendar date and HH:mm for the time of day. The backend sends
 * ISO 8601 strings; these helpers keep the rendering consistent
 * across all views.
 */

const MONTHS_SHORT = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];

const MONTHS_LONG = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function formatDate(value: string | Date | null | undefined): string {
  const date = parseDate(value);
  if (date === null) {
    return '-';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

export function formatDateLong(value: string | Date | null | undefined): string {
  const date = parseDate(value);
  if (date === null) {
    return '-';
  }

  return `${date.getDate()} de ${MONTHS_LONG[date.getMonth()]} de ${date.getFullYear()}`;
}

export function formatTime(value: string | Date | null | undefined): string {
  const date = parseDate(value);
  if (date === null) {
    return '-';
  }

  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const date = parseDate(value);
  if (date === null) {
    return '-';
  }

  return `${formatDate(date)} ${formatTime(date)}`;
}

export function formatMonthYear(value: string | Date | null | undefined): string {
  const date = parseDate(value);
  if (date === null) {
    return '-';
  }

  return `${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

function parseDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
