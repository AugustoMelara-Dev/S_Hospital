import { describe, expect, it } from 'vitest';
import {
  formatDecimalQuantity,
  formatLempirasFromCents,
  formatLempirasUIFromCents,
  formatQuantityUnits,
  parseCents,
  parsePositiveCents,
  parseQuantityUnits,
  toExchangeDecimal,
} from './moneyCents';

describe('moneyCents helpers (frontera canónica)', () => {
  it('parses exchange decimals to integer cents', () => {
    expect(parseCents('0')).toBe(0);
    expect(parseCents('0.00')).toBe(0);
    expect(parseCents('15')).toBe(1500);
    expect(parseCents('15.00')).toBe(1500);
    expect(parseCents('15.5')).toBe(1550);
    expect(parseCents('15.99')).toBe(1599);
    expect(parseCents('1029.25')).toBe(102925);
    expect(parseCents('10000.00')).toBe(1000000);
  });

  it('rounds to nearest cent using HALF_AWAY_FROM_ZERO', () => {
    expect(parseCents('0.01')).toBe(1);
    expect(parseCents('0.02')).toBe(2);
    expect(parseCents('0.03')).toBe(3);
  });

  it('rejects malformed or localized money instead of coercing it to zero', () => {
    expect(parseCents('')).toBe(null);
    expect(parseCents('   ')).toBe(null);
    expect(parseCents('abc')).toBe(null);
    expect(parseCents('1.234')).toBe(null);
    expect(parseCents('-1')).toBe(null);
    expect(parseCents('1,029.25')).toBe(null); // coma de miles: texto localizado
    expect(parseCents('L 1,029.25')).toBe(null);
    expect(parseCents(null)).toBe(null);
    expect(parseCents(undefined)).toBe(null);
    expect(parseCents(Number.NaN)).toBe(null);
  });

  it('parsePositiveCents rejects zero and negative', () => {
    expect(parsePositiveCents('0')).toBe(null);
    expect(parsePositiveCents('-1')).toBe(null);
    expect(parsePositiveCents('5.00')).toBe(500);
  });

  it('toExchangeDecimal serializes cents back to a plain decimal', () => {
    expect(toExchangeDecimal(0)).toBe('0.00');
    expect(toExchangeDecimal(1)).toBe('0.01');
    expect(toExchangeDecimal(102925)).toBe('1029.25');
    expect(toExchangeDecimal(1000000)).toBe('10000.00');
  });

  it('formatLempirasUIFromCents is the single UI formatter', () => {
    expect(formatLempirasUIFromCents(0)).toBe('L. 0.00');
    expect(formatLempirasUIFromCents(1)).toBe('L. 0.01');
    expect(formatLempirasUIFromCents(99999)).toBe('L. 999.99');
    expect(formatLempirasUIFromCents(100000)).toBe('L. 1,000.00');
    expect(formatLempirasUIFromCents(102925)).toBe('L. 1,029.25');
    expect(formatLempirasUIFromCents(1000000)).toBe('L. 10,000.00');
    expect(formatLempirasUIFromCents(104650)).toBe('L. 1,046.50');
    expect(formatLempirasUIFromCents(10000)).toBe('L. 100.00');
  });

  it('returns null for unavailable money instead of L 0.00', () => {
    expect(formatLempirasUIFromCents(null)).toBe(null);
    expect(formatLempirasUIFromCents(undefined)).toBe(null);
    expect(formatLempirasUIFromCents(Number.NaN)).toBe(null);
    expect(formatLempirasUIFromCents(Number.POSITIVE_INFINITY)).toBe(null);
  });

  it('formatLempirasFromCents keeps the institutional receipt contract', () => {
    expect(formatLempirasFromCents(0)).toBe('L. 0.00');
    expect(formatLempirasFromCents(1234)).toBe('L. 12.34');
    expect(formatLempirasFromCents(-5000)).toBe('- L. 50.00');
  });

  it('parseQuantityUnits returns integer hundredths and rejects non-positive input', () => {
    expect(parseQuantityUnits('1')).toBe(100);
    expect(parseQuantityUnits('1.5')).toBe(150);
    expect(parseQuantityUnits('1.55')).toBe(155);
    expect(parseQuantityUnits(2)).toBe(200);
    expect(parseQuantityUnits('0')).toBe(null);
    expect(parseQuantityUnits('-1')).toBe(null);
    expect(parseQuantityUnits('abc')).toBe(null);
    expect(parseQuantityUnits(null)).toBe(null);
  });

  it('formatQuantityUnits renders canonical hundredths', () => {
    expect(formatQuantityUnits(100)).toBe('1.00');
    expect(formatQuantityUnits(150)).toBe('1.50');
    expect(formatQuantityUnits(0)).toBe('0.00');
    expect(formatQuantityUnits(null)).toBe('');
  });

  it('formatDecimalQuantity is the server-aggregate display helper', () => {
    expect(formatDecimalQuantity(1)).toBe('1.00');
    expect(formatDecimalQuantity(1.5)).toBe('1.50');
    expect(formatDecimalQuantity('2.25')).toBe('2.25');
    expect(formatDecimalQuantity(null)).toBe('');
    expect(formatDecimalQuantity('monto-danado')).toBe('');
  });
});
