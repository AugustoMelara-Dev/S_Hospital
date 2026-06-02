/**
 * Currency helpers for the cashier / hospital billing app.
 *
 * The backend is the source of truth for fiscal math. These helpers
 * exist so the UI can render lempiras consistently with the backend
 * (two decimals, dot as the decimal separator, comma as the thousands
 * separator, "L." prefix).
 */

export const LEMPIRA_PREFIX = 'L.';

const AMOUNT_REGEX = /^-?\d+(\.\d+)?$/;

export function formatLempiras(value: string | number | null | undefined): string {
  const numeric = parseAmount(value);

  if (numeric === null) {
    return `${LEMPIRA_PREFIX} 0.00`;
  }

  const [integer, decimal] = numeric.toFixed(2).split('.');
  const signedInteger = integer === '-0' ? '0' : integer;
  const withThousands = signedInteger.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return `${LEMPIRA_PREFIX} ${withThousands}.${decimal}`;
}

export function formatPlainDecimal(value: string | number | null | undefined): string {
  const numeric = parseAmount(value);

  if (numeric === null) {
    return '0.00';
  }

  return numeric.toFixed(2);
}

export function parseAmount(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    if (! Number.isFinite(value)) {
      return null;
    }
    return value;
  }

  const cleaned = value.trim().replace(/,/g, '');

  if (cleaned === '' || ! AMOUNT_REGEX.test(cleaned)) {
    return null;
  }

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}
