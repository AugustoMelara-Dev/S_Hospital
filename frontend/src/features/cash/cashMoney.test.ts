import { describe, expect, it } from 'vitest';
import { cashAmountCents, formatCashCents, formatSignedCashCents } from './cashMoney';

describe('cashAmountCents', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty string', ''],
    ['blank string', '   '],
    ['malformed text', 'monto-danado'],
    ['NaN text', 'NaN'],
    ['localized money', 'L 10.00'],
    ['thousands separator', '1,029.25'],
  ])('returns null (never 0) for %s', (_label, value) => {
    expect(cashAmountCents(value as string | null | undefined)).toBeNull();
  });

  it('converts a decimal exchange amount to integer cents', () => {
    expect(cashAmountCents('1029.25')).toBe(102925);
    expect(cashAmountCents('5')).toBe(500);
    expect(cashAmountCents('0.05')).toBe(5);
  });

  it('keeps a legitimate zero as zero', () => {
    expect(cashAmountCents('0.00')).toBe(0);
    expect(cashAmountCents(0)).toBe(0);
  });
});

describe('formatCashCents', () => {
  it('shows the missing-value label instead of L 0.00 when absent or malformed', () => {
    expect(formatCashCents(null)).toBe('No disponible');
    expect(formatCashCents(undefined)).toBe('No disponible');
    expect(formatCashCents(Number.NaN)).toBe('No disponible');
  });

  it('formats present cents and preserves legitimate zero', () => {
    expect(formatCashCents(102925)).toBe('L. 1,029.25');
    expect(formatCashCents(0)).toBe('L. 0.00');
  });
});

describe('formatSignedCashCents', () => {
  it('derives the human sign from cents', () => {
    expect(formatSignedCashCents(-500)).toBe('- L. 5.00');
    expect(formatSignedCashCents(500)).toBe('+ L. 5.00');
    expect(formatSignedCashCents(0)).toBe('L. 0.00');
  });

  it('returns the missing-value label when the difference cannot be computed', () => {
    expect(formatSignedCashCents(null)).toBe('No disponible');
    expect(formatSignedCashCents(undefined)).toBe('No disponible');
    expect(formatSignedCashCents(Number.NaN)).toBe('No disponible');
  });
});
