import { formatCents as formatCentsFromHelpers, parseCents as parseCentsFromHelpers } from '../../../lib/moneyCents';
import type { CartItem } from '../components/InvoiceCart';

const QUANTITY_REGEX = /^\d+(\.\d{1,2})?$/;

export function parseQuantityUnits(value: string): number {
  if (!QUANTITY_REGEX.test(value)) {
    return 0;
  }

  const [integer, decimal = '00'] = value.split('.');
  return Number(integer) * 100 + Number(decimal.padEnd(2, '0').slice(0, 2));
}

export function parseMoneyCents(value: string): number {
  const [integer, decimal = '00'] = value.split('.');
  return Number(integer) * 100 + Number(decimal.padEnd(2, '0').slice(0, 2));
}

export function formatCents(cents: number): string {
  return formatCentsFromHelpers(cents);
}

export function isZeroMoney(value: string): boolean {
  return parseCentsFromHelpers(value) === 0;
}

export function incrementQuantityFromString(value: string): string {
  return formatCentsFromHelpers(parseQuantityUnits(value) + 100);
}

export function parseTaxRateBasisPoints(taxRate?: string): number {
  const parsed = Number(taxRate ?? 0);

  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
}

export function effectiveUnitPriceCents(item: CartItem): number {
  if (
    item.dialysisPrescription &&
    item.service.special_rule_code === 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION'
  ) {
    return 0;
  }

  return parseCentsFromHelpers(item.service.price) ?? 0;
}

export interface InvoiceEstimate {
  subtotal: string;
  tax: string;
  total: string;
}

export function computeSimpleEstimate(items: CartItem[], taxRate?: string): InvoiceEstimate {
  const rateBasisPoints = parseTaxRateBasisPoints(taxRate);
  let subtotal = 0;
  let tax = 0;

  for (const item of items) {
    const quantity = parseQuantityUnits(item.quantity);
    const lineSubtotal = Math.trunc((effectiveUnitPriceCents(item) * quantity) / 100);
    subtotal += lineSubtotal;

    if (item.service.taxable && rateBasisPoints > 0) {
      tax += Math.round((lineSubtotal * rateBasisPoints) / 10_000);
    }
  }

  return {
    subtotal: formatCents(subtotal),
    tax: formatCents(tax),
    total: formatCents(subtotal + tax),
  };
}

export function parseLocalCents(value: string): number {
  return parseMoneyCents(value);
}
