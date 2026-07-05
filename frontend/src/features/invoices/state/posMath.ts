/**
 * @deprecated since v1.0.0-rc.4; use backend-computed totals from
 * InvoiceResource. This module is kept only as a re-export shim for
 * any consumer still importing it. The backend is the source of truth
 * for fiscal math (subtotal, tax, total). New code should call the
 * backend and trust the response — do not recompute totals in the
 * browser.
 *
 * Re-exports live in `lib/money.ts` (non-nullable, integer-cents) and
 * `lib/moneyCents.ts` (nullable variants for form input). Import from
 * those modules directly in new code.
 */
import {
  formatCents as formatCentsFromMoneyCents,
  parseCents as parseCentsFromMoneyCents,
} from '../../../lib/moneyCents';
import type { CartItem } from '../components/InvoiceCart';

const QUANTITY_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * @deprecated since v1.0.0-rc.4. Use `parseCents` from `lib/money.ts`
 * for the integer-cents variant or `lib/moneyCents.ts` for the nullable
 * form-input variant.
 */
export function parseQuantityUnits(value: string): number {
  if (!QUANTITY_REGEX.test(value)) {
    return 0;
  }

  const [integer, decimal = '00'] = value.split('.');
  return Number(integer) * 100 + Number(decimal.padEnd(2, '0').slice(0, 2));
}

/**
 * @deprecated since v1.0.0-rc.4. Use `parseCents` from `lib/money.ts`.
 */
export function parseMoneyCents(value: string): number {
  const [integer, decimal = '00'] = value.split('.');
  return Number(integer) * 100 + Number(decimal.padEnd(2, '0').slice(0, 2));
}

/**
 * @deprecated since v1.0.0-rc.4. Use `formatCents` from
 * `lib/moneyCents.ts` directly.
 */
export function formatCents(cents: number): string {
  return formatCentsFromMoneyCents(cents);
}

/**
 * @deprecated since v1.0.0-rc.4. Use `parseCents` from
 * `lib/moneyCents.ts` for form input.
 */
export function isZeroMoney(value: string): boolean {
  return parseCentsFromMoneyCents(value) === 0;
}

/**
 * @deprecated since v1.0.0-rc.4. Use the reducer's own helper or call
 * the backend cart endpoint.
 */
export function incrementQuantityFromString(value: string): string {
  return formatCentsFromMoneyCents(parseQuantityUnits(value) + 100);
}

/**
 * @deprecated since v1.0.0-rc.4. Tax math is computed by the backend.
 */
export function parseTaxRateBasisPoints(taxRate?: string): number {
  const parsed = Number(taxRate ?? 0);

  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
}

/**
 * @deprecated since v1.0.0-rc.4. The erythropoietin rule is applied
 * server-side; do not branch on it in the browser.
 */
export function effectiveUnitPriceCents(item: CartItem): number {
  if (
    item.dialysisPrescription &&
    item.service.special_rule_code === 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION'
  ) {
    return 0;
  }

  const parsed = parseCentsFromMoneyCents(item.service.price);

  return parsed ?? 0;
}

export interface InvoiceEstimate {
  subtotal: string;
  tax: string;
  total: string;
}

/**
 * @deprecated since v1.0.0-rc.4. Backend-computed totals from
 * `InvoiceResource` are the source of truth. This stub remains for
 * backward compatibility only and returns the previous client-side
 * estimate. New callers must stop using it and consume the totals
 * returned by the backend.
 */
export function computeSimpleEstimate(items: CartItem[], taxRate?: string): InvoiceEstimate {
  const rateBasisPoints = parseTaxRateBasisPoints(taxRate);
  let subtotal = 0;
  let taxableSubtotal = 0;

  for (const item of items) {
    const quantity = parseQuantityUnits(item.quantity);
    const lineSubtotal = Math.trunc(((effectiveUnitPriceCents(item) * quantity) + 50) / 100);
    subtotal += lineSubtotal;

    if (isTaxableForPreview(item) && rateBasisPoints > 0) {
      taxableSubtotal += lineSubtotal;
    }
  }

  const tax = Math.trunc(((taxableSubtotal * rateBasisPoints) + 5000) / 10_000);

  return {
    subtotal: formatCentsFromMoneyCents(subtotal),
    tax: formatCentsFromMoneyCents(tax),
    total: formatCentsFromMoneyCents(subtotal + tax),
  };
}

function isTaxableForPreview(item: CartItem): boolean {
  return item.service.taxable
    && item.service.special_rule_code !== 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';
}

/**
 * @deprecated since v1.0.0-rc.4. Use `parseCents` from `lib/money.ts`.
 */
export function parseLocalCents(value: string): number {
  return parseMoneyCents(value);
}

// `parseCents` is intentionally NOT re-exported here. The original
// local `parseCents` was a thin wrapper that delegated to
// `parseCentsFromMoneyCents`; consumers should now import that helper
// from `lib/moneyCents.ts` (or `parseCents` from `lib/money.ts` for
// the integer-cents variant) directly.
