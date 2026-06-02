import { describe, expect, it } from 'vitest';
import { computeSimpleEstimate, effectiveUnitPriceCents, formatCents, incrementQuantityFromString, isZeroMoney, parseLocalCents, parseQuantityUnits, parseTaxRateBasisPoints } from './posMath';
import type { CartItem } from '../components/InvoiceCart';

function buildCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    service: {
      id: 1,
      name: 'Consulta general',
      price: '150.00',
      taxable: true,
      active: true,
      visible_in_billing: true,
      is_billable: true,
      category_id: 1,
      area_id: null,
      scan_code: null,
      barcode: null,
      qr_code: null,
      slug: 'consulta-general',
      special_rule_code: null,
    },
    quantity: '1.00',
    dialysisPrescription: false,
    ...overrides,
  };
}

describe('posMath', () => {
  it('parses quantity units honoring up to two decimals', () => {
    expect(parseQuantityUnits('1')).toBe(100);
    expect(parseQuantityUnits('1.5')).toBe(150);
    expect(parseQuantityUnits('1.55')).toBe(155);
    expect(parseQuantityUnits('not-a-number')).toBe(0);
  });

  it('formats cents back to a decimal string', () => {
    expect(formatCents(0)).toBe('0.00');
    expect(formatCents(150)).toBe('1.50');
    expect(formatCents(12345)).toBe('123.45');
  });

  it('detects zero amounts safely', () => {
    expect(isZeroMoney('0.00')).toBe(true);
    expect(isZeroMoney('0')).toBe(true);
    expect(isZeroMoney('1.00')).toBe(false);
  });

  it('increments a quantity by one whole unit', () => {
    expect(incrementQuantityFromString('1.00')).toBe('2.00');
    expect(incrementQuantityFromString('1.50')).toBe('2.50');
  });

  it('parses tax rate into basis points', () => {
    expect(parseTaxRateBasisPoints(undefined)).toBe(0);
    expect(parseTaxRateBasisPoints('0')).toBe(0);
    expect(parseTaxRateBasisPoints('15')).toBe(1500);
    expect(parseTaxRateBasisPoints('15.00')).toBe(1500);
    expect(parseTaxRateBasisPoints('not-a-number')).toBe(0);
  });

  it('overrides erythropoietin price when the dialysis prescription flag is on', () => {
    const base = buildCartItem();
    const free = buildCartItem({
      dialysisPrescription: true,
      service: {
        ...buildCartItem().service,
        special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
      },
    });

    expect(effectiveUnitPriceCents(base)).toBe(15000);
    expect(effectiveUnitPriceCents(free)).toBe(0);
  });

  it('parses local money strings into integer cents', () => {
    expect(parseLocalCents('1.50')).toBe(150);
    expect(parseLocalCents('10')).toBe(1000);
  });

  it('computes the cart estimate for a normal service', () => {
    const estimate = computeSimpleEstimate([buildCartItem({ quantity: '2.00' })], '15.00');

    expect(estimate.subtotal).toBe('300.00');
    expect(estimate.tax).toBe('45.00');
    expect(estimate.total).toBe('345.00');
  });

  it('zeros the tax line for non-taxable services', () => {
    const estimate = computeSimpleEstimate([
      buildCartItem({ quantity: '1.00', service: { ...buildCartItem().service, taxable: false } }),
    ], '15.00');

    expect(estimate.subtotal).toBe('150.00');
    expect(estimate.tax).toBe('0.00');
    expect(estimate.total).toBe('150.00');
  });

  it('applies the erythropoietin rule and reports zero total when prescribed', () => {
    const estimate = computeSimpleEstimate(
      [
        buildCartItem({
          quantity: '1.00',
          dialysisPrescription: true,
          service: {
            ...buildCartItem().service,
            special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
          },
        }),
      ],
      '15.00',
    );

    expect(estimate.subtotal).toBe('0.00');
    expect(estimate.tax).toBe('0.00');
    expect(estimate.total).toBe('0.00');
  });
});
