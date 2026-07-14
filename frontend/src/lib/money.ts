/**
 * Money helpers. All math lives in integer cents; use this helper for
 * any user input parsing or display formatting. The backend is the
 * source of truth for fiscal totals (see InvoiceResource). The frontend
 * uses these helpers to:
 *  - parse user-typed amounts from the cashier UI without float drift
 *  - format integer cents into a display string with the right prefix
 *  - hand cents to/from the backend without losing precision
 *
 * Display policy (locked in DECISIONS.md):
 *  - UI:    "L 1,234.50"  → formatLempirasUI / formatLempirasUIFromCents
 *  - Receipt (institutional): "L. 1,234.50" → formatLempirasReceipt
 *
 * Half-up rounding is used for `parseCents` to keep totals consistent
 * with the server-side PHP rounding (HALF_AWAY_FROM_ZERO).
 */

export function finiteNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Format money for the official institutional receipt / PDF.
 * Uses "L. 1,234.50" (period and space) — the only place where this
 * variant is allowed. Keep the receipt sober and official.
 */
export function formatLempirasReceipt(value: number | string | null | undefined, fractionDigits = 2): string {
  const num = finiteNumber(value);
  const formatted = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  if (num < 0) {
    return `- L. ${formatted}`;
  }

  return `L. ${formatted}`;
}

/**
 * Format money for the cashier UI. Uses "L 1,234.50" (no period).
 * Default display function in screens, tables, KPIs, dashboards.
 */
export function formatLempirasUI(value: number | string | null | undefined, fractionDigits = 2): string {
  const num = finiteNumber(value);
  const formatted = Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

  if (num < 0) {
    return `- L ${formatted}`;
  }

  return `L ${formatted}`;
}

/**
 * Stable monetary parser used by callers that still reference
 * `formatLempiras`; treat it as the receipt format to keep the
 * preview / institutional surfaces intact.
 *
 * @deprecated prefer formatLempirasUI for UI or formatLempirasReceipt
 *             for the official receipt.
 */
export const formatLempiras = formatLempirasReceipt;

const CENTS_REGEX = /^-?\d+(\.\d+)?$/;

export function parseCents(value: string | number): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.round(value * 100);
  }

  const trimmed = value.trim();

  if (trimmed === '' || !CENTS_REGEX.test(trimmed)) {
    return 0;
  }

  return Math.round(Number(trimmed) * 100);
}

export function formatCents(cents: number, locale: string = 'es-HN'): string {
  if (!Number.isFinite(cents)) {
    return 'L. 0.00';
  }

  const safe = Math.trunc(cents);
  const value = Math.abs(safe) / 100;

  let formatted = '';
  try {
    formatted = value.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    formatted = value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (safe < 0) {
    return `- L. ${formatted}`;
  }

  return `L. ${formatted}`;
}

/**
 * Returns the float value of the given integer cents. Use only for
 * display or for fields that the backend accepts as a stringified
 * decimal (e.g. "15.00"). Never use the result for arithmetic — keep
 * math in cents.
 */
export function fromCents(cents: number): { value: number } {
  return { value: Math.trunc(cents) / 100 };
}

/**
 * Alias of `fromCents(cents).value`. Provided for readability at call
 * sites that want to be explicit about converting cents to a float for
 * display only.
 */
export function toFloat(cents: number): number {
  return Math.trunc(cents) / 100;
}
