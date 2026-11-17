/** Dates are always presented in Honduras business time (UTC-6, no DST). */
export const BUSINESS_TZ = 'America/Tegucigalpa';
const LOCALE = 'es-HN';

type DateInput = string | number | Date;

function toDate(value: DateInput): Date {
  if (value instanceof Date) return value;
  // Date-only strings ("2026-11-17") must not shift a day: anchor at noon HN.
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00-06:00`);
  }
  return new Date(value);
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let f = fmtCache.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, { timeZone: BUSINESS_TZ, ...options });
    fmtCache.set(key, f);
  }
  return f;
}

function parts(value: DateInput): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of fmt('parts', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(toDate(value))) {
    out[p.type] = p.value;
  }
  return out;
}

/** "17/11/2026" */
export function formatDate(value: DateInput): string {
  const p = parts(value);
  return `${p.day}/${p.month}/${p.year}`;
}

/** "07:02" (24 h) */
export function formatTime(value: DateInput): string {
  const p = parts(value);
  return `${p.hour}:${p.minute}`;
}

/** "17/11/2026 07:02" */
export function formatDateTime(value: DateInput): string {
  return `${formatDate(value)} ${formatTime(value)}`;
}

/** "martes, 17 de noviembre de 2026" */
export function formatLongDate(value: DateInput): string {
  return fmt('long', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(toDate(value));
}

/** ISO date (YYYY-MM-DD) for "today" in Honduras. */
export function todayISO(now: Date = new Date()): string {
  const p = parts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Adds days to a YYYY-MM-DD string. */
export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
