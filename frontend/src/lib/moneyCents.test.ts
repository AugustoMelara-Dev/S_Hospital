import { describe, expect, it } from 'vitest';
import {
  formatCents,
  formatLempirasFromCents,
  formatQuantity,
  parseCents,
  parseCentsOrZero,
  parsePositiveCents,
  parseQuantityUnits,
  parseSignedCents,
  parseSignedCentsOrZero,
} from './moneyCents';

describe('moneyCents helpers', () => {
  it('parses decimal strings to integer cents', () => {
    expect(parseCents('0')).toBe(0);
    expect(parseCents('0.00')).toBe(0);
    expect(parseCents('15')).toBe(1500);
    expect(parseCents('15.00')).toBe(1500);
    expect(parseCents('15.5')).toBe(1550);
    expect(parseCents('15.99')).toBe(1599);
  });

  it('rounds to nearest cent using HALF_AWAY_FROM_ZERO', () => {
    expect(parseCents('0.01')).toBe(1);
    expect(parseCents('0.02')).toBe(2);
    expect(parseCents('0.03')).toBe(3);
  });

  it('rejects malformed input', () => {
    expect(parseCents('')).toBe(null);
    expect(parseCents('   ')).toBe(null);
    expect(parseCents('abc')).toBe(null);
    expect(parseCents('1.234')).toBe(null);
    expect(parseCents('-1')).toBe(null);
    expect(parseCents(null)).toBe(null);
    expect(parseCents(undefined)).toBe(null);
    expect(parseCents(Number.NaN)).toBe(null);
  });

  it('parsePositiveCents rejects zero and negative', () => {
    expect(parsePositiveCents('0')).toBe(null);
    expect(parsePositiveCents('-1')).toBe(null);
    expect(parsePositiveCents('5.00')).toBe(500);
  });

  it('formatCents produces canonical decimal strings', () => {
    expect(formatCents(0)).toBe('0.00');
    expect(formatCents(1500)).toBe('15.00');
    expect(formatCents(1550)).toBe('15.50');
    expect(formatCents(null)).toBe('0.00');
    expect(formatCents(undefined)).toBe('0.00');
  });

  it('formatLempirasFromCents produces prefixed strings', () => {
    expect(formatLempirasFromCents(0)).toBe('L. 0.00');
    expect(formatLempirasFromCents(1234)).toBe('L. 12.34');
  });

  it('parseQuantityUnits rejects non-positive and parses two decimals', () => {
    expect(parseQuantityUnits('1')).toBe(1);
    expect(parseQuantityUnits('1.5')).toBe(1.5);
    expect(parseQuantityUnits('0')).toBe(null);
    expect(parseQuantityUnits('-1')).toBe(null);
    expect(parseQuantityUnits('abc')).toBe(null);
  });

  it('formatQuantity respects fractionDigits', () => {
    expect(formatQuantity(1)).toBe('1.00');
    expect(formatQuantity(1.5)).toBe('1.50');
    expect(formatQuantity(0)).toBe('0.00');
    expect(formatQuantity(null)).toBe('0.00');
  });

  it('parseSignedCents accepts negative values', () => {
    expect(parseSignedCents('-1')).toBe(-100);
    expect(parseSignedCents('-1.50')).toBe(-150);
    expect(parseSignedCents('-0.01')).toBe(-1);
    expect(parseSignedCents('1.00')).toBe(100);
    expect(parseSignedCents('abc')).toBe(null);
    expect(parseSignedCents('')).toBe(null);
  });

  it('parseCentsOrZero falls back to zero on invalid input', () => {
    expect(parseCentsOrZero('15.50')).toBe(1550);
    expect(parseCentsOrZero('abc')).toBe(0);
    expect(parseCentsOrZero(null)).toBe(0);
    expect(parseCentsOrZero(undefined)).toBe(0);
  });

  it('parseSignedCentsOrZero handles negatives safely', () => {
    expect(parseSignedCentsOrZero('-1.50')).toBe(-150);
    expect(parseSignedCentsOrZero('invalid')).toBe(0);
    expect(parseSignedCentsOrZero(null)).toBe(0);
  });
});
