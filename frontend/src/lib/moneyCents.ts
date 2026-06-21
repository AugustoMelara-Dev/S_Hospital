/**
 * Money helpers that round-trip between decimal strings (e.g. "15.00"),
 * integer cents (e.g. 1500) and formatted lempiras.
 *
 * Display policy (locked in DECISIONS.md):
 *  - UI:    "L 1,234.50" → formatLempirasUIFromCents
 *  - Receipt (institutional): "L. 1,234.50" → formatLempirasFromCents
 *
 * The backend is the source of truth for fiscal math. These helpers exist
 * so the UI can preview values consistently with the backend rounding
 * (HALF_AWAY_FROM_ZERO) and reject malformed input before sending it.
 */

import { finiteNumber, formatLempirasReceipt, formatLempirasUI } from './money';

export { formatLempirasReceipt, formatLempirasUI, finiteNumber } from './money';

const CENTS_REGEX = /^\d+(\.\d{1,2})?$/;

export function parseCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }

    return Math.round(value * 100);
  }

  const trimmed = value.trim();

  if (trimmed === '') {
    return null;
  }

  if (!CENTS_REGEX.test(trimmed)) {
    return null;
  }

  return Math.round(Number(trimmed) * 100);
}

export function parsePositiveCents(value: string | number | null | undefined): number | null {
  const cents = parseCents(value);

  if (cents === null || cents <= 0) {
    return null;
  }

  return cents;
}

export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return '0.00';
  }

  const safe = Math.trunc(cents);

  return formatLempirasUI(safe / 100).replace(/^L\s*/, '');
}

/**
 * Receipt / PDF format. "L. 1,234.50" with period and space.
 */
export function formatLempirasFromCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return 'L. 0.00';
  }

  return formatLempirasReceipt(Math.trunc(cents) / 100);
}

/**
 * UI format. "L 1,234.50" without period.
 */
export function formatLempirasUIFromCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return 'L 0.00';
  }

  return formatLempirasUI(Math.trunc(cents) / 100);
}

export function parseQuantityUnits(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = typeof value === 'number' ? value : Number(value);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return Math.round(numeric * 100) / 100;
}

export function formatQuantity(units: number | string | null | undefined, fractionDigits = 2): string {
  return finiteNumber(units).toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
