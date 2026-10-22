/**
 * Formato y validación de tasas de impuesto (H-15).
 *
 * El backend guarda `percentage` como decimal de dos cifras ("15.00") y es la
 * única autoridad del cálculo. Aquí sólo se normaliza lo que el usuario escribe
 * y se presenta sin inventar tasas.
 */

export const TAX_REASON_MIN_LENGTH = 5;
export const TAX_REASON_MAX_LENGTH = 255;
export const TAX_RATE_NAME_MAX_LENGTH = 60;

/** "15", "15,5" y "15.50" se guardan como "15.00" / "15.50". */
export function normalizeTaxPercentage(value: string): string | null {
  const normalized = value.trim().replace(',', '.');
  if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(normalized)) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 99.99) return null;

  return parsed.toFixed(2);
}

/** "15.00" → "15 %"; "7.50" → "7.5 %". Un valor corrupto no se disfraza. */
export function formatTaxPercentage(value: string): string {
  const normalized = value.trim().replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return '—';

  const text = parsed.toFixed(2).replace(/\.?0+$/, '');
  return `${text} %`;
}

/** `null`/0 % = exento; nunca se muestra "0 % de ISV" como si gravara. */
export function taxRateIsExempt(rate: { percentage: string }): boolean {
  const parsed = Number(rate.percentage);
  return !Number.isFinite(parsed) || parsed === 0;
}

export function taxRateReasonError(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < TAX_REASON_MIN_LENGTH) {
    return `Indique al menos ${TAX_REASON_MIN_LENGTH} caracteres explicando el motivo.`;
  }
  if (trimmed.length > TAX_REASON_MAX_LENGTH) {
    return `El motivo no puede superar ${TAX_REASON_MAX_LENGTH} caracteres.`;
  }
  return null;
}
