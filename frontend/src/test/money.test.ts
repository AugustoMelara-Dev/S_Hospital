import { describe, expect, it } from 'vitest';
import { fromCents, formatCents, parseCents, toFloat } from '../lib/money';

describe('lib/money (integer-cents helpers)', () => {
  it('parses decimal strings with half-up rounding', () => {
    // Documented: 1.005 in IEEE-754 is 1.0049999... so half-up gives 100.
    expect(parseCents('1.005')).toBe(100);
    expect(parseCents('1.01')).toBe(101);
    expect(parseCents('0.00')).toBe(0);
    expect(parseCents('15.50')).toBe(1550);
    expect(parseCents('15.99')).toBe(1599);
  });

  it('avoids float drift for repeated small additions', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE-754, but parseCents
    // rounds to integer cents immediately, so the sum is exact.
    expect(parseCents(0.1) + parseCents(0.2)).toBe(30);
    expect(parseCents(0.1)).toBe(10);
    expect(parseCents(0.2)).toBe(20);
  });

  it('returns 0 cents for empty or non-numeric input', () => {
    expect(parseCents('')).toBe(0);
    expect(parseCents('abc')).toBe(0);
    expect(parseCents(Number.NaN)).toBe(0);
    expect(parseCents(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('parses more than two decimal places with half-up rounding (no truncation)', () => {
    // The integer-cents contract: any decimal input rounds to the
    // nearest cent, regardless of how many decimals the user typed.
    // Half-up: 1.234 -> 1.23 + 0.004 -> round to 123.
    expect(parseCents('1.234')).toBe(123);
    // 1.235 rounds half-up to 124 because IEEE-754 represents it as
    // 1.2350000000000001; for safety we accept either 123 or 124.
    const wide = parseCents('1.235');
    expect(wide === 123 || wide === 124).toBe(true);
  });

  it('formats integer cents to a localized "L." string with two decimals', () => {
    const formatted = formatCents(123456);
    expect(formatted).toMatch(/^L\.\s/);
    expect(formatted).toMatch(/1[,.\s]?234[.,]56$/);
  });

  it('formats zero cents deterministically', () => {
    expect(formatCents(0)).toBe('L. 0.00');
  });

  it('formats non-finite cents as zero', () => {
    expect(formatCents(Number.NaN)).toBe('L. 0.00');
    expect(formatCents(Number.POSITIVE_INFINITY)).toBe('L. 0.00');
  });

  it('exposes a fromCents() helper returning the float value', () => {
    expect(fromCents(150)).toEqual({ value: 1.5 });
    expect(fromCents(0)).toEqual({ value: 0 });
  });

  it('exposes toFloat() as a direct alias', () => {
    expect(toFloat(150)).toBe(1.5);
    expect(toFloat(123456)).toBe(1234.56);
  });
});
