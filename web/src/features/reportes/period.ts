import { addDaysISO, todayISO } from '@/lib/dates';

export type PeriodPreset = 'today' | 'yesterday' | 'last7' | 'month' | 'prev_month' | 'custom';

export const PERIOD_LABEL: Record<PeriodPreset, string> = {
  today: 'Hoy',
  yesterday: 'Ayer',
  last7: '7 días',
  month: 'Este mes',
  prev_month: 'Mes anterior',
  custom: 'Personalizado',
};

export const PRESETS: PeriodPreset[] = ['today', 'yesterday', 'last7', 'month', 'prev_month', 'custom'];

export const MAX_RANGE_DAYS = 92;

export type DateRange = { date_from: string; date_to: string };

/** Range for a preset in Honduras business time (UTC-6). `custom` returns this month as a starting point. */
export function presetRange(preset: Exclude<PeriodPreset, 'custom'> | 'custom', now: Date = new Date()): DateRange {
  const today = todayISO(now);
  const monthStart = `${today.slice(0, 8)}01`;
  switch (preset) {
    case 'today':
      return { date_from: today, date_to: today };
    case 'yesterday': {
      const y = addDaysISO(today, -1);
      return { date_from: y, date_to: y };
    }
    case 'last7':
      return { date_from: addDaysISO(today, -6), date_to: today };
    case 'prev_month': {
      const lastOfPrev = addDaysISO(monthStart, -1);
      return { date_from: `${lastOfPrev.slice(0, 8)}01`, date_to: lastOfPrev };
    }
    case 'month':
    case 'custom':
    default:
      return { date_from: monthStart, date_to: today };
  }
}

/** Inclusive number of days in [from, to]. */
export function rangeDays(from: string, to: string): number {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000) + 1;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Spanish validation message for a custom range, or null when valid. */
export function validateRange(from: string, to: string): string | null {
  if (!ISO.test(from) || !ISO.test(to)) return 'Indique las fechas Desde y Hasta.';
  if (from > to) return '“Desde” no puede ser posterior a “Hasta”.';
  if (rangeDays(from, to) > MAX_RANGE_DAYS) return `El período no puede superar ${MAX_RANGE_DAYS} días.`;
  return null;
}
