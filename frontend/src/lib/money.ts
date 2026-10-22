/**
 * Helpers de presentación por valor decimal.
 *
 * Estos helpers NO son la frontera canónica de dinero en centavos: viven
 * en `lib/moneyCents.ts`. Aquí solo se formatea un valor decimal ya
 * conocido (agregados del servidor, diferencias de caja, KPIs) y se
 * exponen utilidades de conversión centavos → flotante para superficies
 * que aún no migran a centavos enteros.
 *
 * Display policy (DECISIONS.md):
 *  - UI:    "L. 1,234.50"  → formatLempirasUI
 *  - Recibo (institucional): "L. 1,234.50" → formatLempirasReceipt
 *
 * Para dinero en centavos usa SIEMPRE `parseCents`/`formatCents` de
 * `lib/moneyCents.ts`.
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
 * Format money for the cashier UI. Uses "L. 1,234.50" (period and space).
 * Default display function in screens, tables, KPIs, dashboards.
 * Prefer `formatCents` from `lib/moneyCents.ts` when you hold cents.
 */
export function formatLempirasUI(value: number | string | null | undefined, fractionDigits = 2): string {
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
