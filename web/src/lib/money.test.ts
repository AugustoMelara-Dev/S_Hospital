import { describe, expect, it } from 'vitest';
import { centsToInput, formatCents, formatHundredths, formatRateBp, parseMoneyToCents, parseQuantityToHundredths } from './money';

describe('formatCents', () => {
  it('formats lempiras with grouping and two decimals', () => {
    expect(formatCents(123400)).toBe('L 1,234.00');
    expect(formatCents(5)).toBe('L 0.05');
    expect(formatCents(0)).toBe('L 0.00');
    expect(formatCents(123456789)).toBe('L 1,234,567.89');
    expect(formatCents(-500)).toBe('-L 5.00');
  });
  it('never shows L 0.00 for unknown totals', () => {
    expect(formatCents(null)).toBe('No disponible');
    expect(formatCents(undefined)).toBe('No disponible');
  });
  it('rejects floats', () => {
    expect(() => formatCents(12.5)).toThrow();
  });
});

describe('parseMoneyToCents', () => {
  it.each([
    ['1,234.50', 123450],
    ['L 1234.5', 123450],
    ['25', 2500],
    ['0.07', 7],
    ['.5', 50],
    ['  1 000 ', 100000],
    ['0.10', 10],
    ['19.99', 1999],
  ])('%s → %i', (input, cents) => {
    expect(parseMoneyToCents(input)).toBe(cents);
  });
  it.each(['', 'abc', '1.234', '1.2.3', '-5', '.'])('invalid %s → null', (input) => {
    expect(parseMoneyToCents(input)).toBeNull();
  });
  it('avoids float rounding errors', () => {
    // parseFloat('1.15') * 100 = 114.99999999999999
    expect(parseMoneyToCents('1.15')).toBe(115);
    expect(parseMoneyToCents('4.35')).toBe(435);
  });
});

describe('centsToInput / quantities / rates', () => {
  it('round-trips', () => {
    expect(centsToInput(123450)).toBe('1,234.50');
    expect(parseMoneyToCents(centsToInput(123450))).toBe(123450);
    expect(centsToInput(null)).toBe('');
  });
  it('handles hundredths', () => {
    expect(parseQuantityToHundredths('1.5')).toBe(150);
    expect(parseQuantityToHundredths('2')).toBe(200);
    expect(parseQuantityToHundredths('1.255')).toBeNull();
    expect(formatHundredths(150)).toBe('1.5');
    expect(formatHundredths(125)).toBe('1.25');
    expect(formatHundredths(100)).toBe('1');
  });
  it('formats basis points', () => {
    expect(formatRateBp(1500)).toBe('15 %');
    expect(formatRateBp(1850)).toBe('18.5 %');
  });
});
