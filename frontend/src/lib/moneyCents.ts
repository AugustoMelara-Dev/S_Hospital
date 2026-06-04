/**
 * Money helpers that round-trip between decimal strings (e.g. "15.00"),
 * integer cents (e.g. 1500) and formatted lempiras (e.g. "L. 15.00").
 *
 * The backend is the source of truth for fiscal math. These helpers exist
 * so the UI can preview values consistently with the backend rounding
 * (HALF_AWAY_FROM_ZERO) and reject malformed input before sending it.
 */

import { finiteNumber, formatLempiras } from './money';

const CENTS_REGEX = /^\d+(\.\d{1,2})?$/;
const SIGNED_CENTS_REGEX = /^-?\d+(\.\d{1,2})?$/;

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

export function parseSignedCents(value: string | number | null | undefined): number | null {
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

  if (trimmed === '' || !SIGNED_CENTS_REGEX.test(trimmed)) {
    return null;
  }

  return Math.round(Number(trimmed) * 100);
}

export function parseCentsOrZero(value: string | number | null | undefined): number {
  return parseCents(value) ?? 0;
}

export function parseSignedCentsOrZero(value: string | number | null | undefined): number {
  return parseSignedCents(value) ?? 0;
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

  return formatLempiras(safe / 100).replace(/^L\.\s*/, '');
}

export function formatLempirasFromCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) {
    return 'L. 0.00';
  }

  return formatLempiras(Math.trunc(cents) / 100);
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
