import { describe, expect, it } from 'vitest';
import {
  arqueoReady,
  arqueoTotal,
  DIFFERENCE_LABEL,
  denominationSubtotal,
  differenceCents,
  differenceKind,
  EMPTY_ARQUEO,
  parseCount,
  toBreakdown,
} from './arqueo';

describe('arqueo math', () => {
  it('multiplies bills by denomination in integer cents', () => {
    expect(denominationSubtotal(500, 3)).toBe(150_000);
    expect(denominationSubtotal(1, 7)).toBe(700);
    expect(denominationSubtotal(20, undefined)).toBe(0);
  });

  it('adds every denomination plus coins', () => {
    const state = { counts: { 500: 2, 200: 1, 100: 3, 50: 1, 20: 2, 10: 1, 5: 1, 2: 2, 1: 3 }, coinsCents: 75 };
    // 1000 + 200 + 300 + 50 + 40 + 10 + 5 + 4 + 3 = 1612 lempiras + 0.75
    expect(arqueoTotal(state)).toBe(161_275);
  });

  it('builds the close breakdown with only non-zero bills and sums to the total', () => {
    const state = { counts: { 500: 2, 100: 0, 5: 4 }, coinsCents: 50 };
    const b = toBreakdown(state);
    expect(b).toEqual({ bills: { '500': 2, '5': 4 }, coins_cents: 50 });
    const sum = Object.entries(b.bills).reduce((s, [d, n]) => s + Number(d) * 100 * (n ?? 0), 0) + b.coins_cents;
    expect(sum).toBe(arqueoTotal(state));
  });

  it('labels the difference as counted − expected', () => {
    expect(differenceCents(100_000, 150_000)).toBe(-50_000);
    expect(DIFFERENCE_LABEL[differenceKind(-50_000)]).toBe('Faltante');
    expect(DIFFERENCE_LABEL[differenceKind(1)]).toBe('Sobrante');
    expect(DIFFERENCE_LABEL[differenceKind(0)]).toBe('Cuadra');
  });

  it('requires a non-zero count or an explicit zero confirmation', () => {
    expect(arqueoReady(EMPTY_ARQUEO)).toBe(false);
    expect(arqueoReady({ ...EMPTY_ARQUEO, confirmedZero: true })).toBe(true);
    expect(arqueoReady({ counts: { 1: 1 }, coinsCents: null, confirmedZero: false })).toBe(true);
  });

  it('parses counts as whole numbers only', () => {
    expect(parseCount('12')).toBe(12);
    expect(parseCount('')).toBeUndefined();
    expect(parseCount('1.5')).toBeNull();
    expect(parseCount('-2')).toBeNull();
  });
});
