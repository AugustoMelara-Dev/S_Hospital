import { describe, expect, it } from 'vitest';
import { finiteNumber, formatLempirasReceipt, formatLempirasUI, fromCents, toFloat } from '../lib/money';

describe('money formatting helpers', () => {
  it('formats UI lempiras with period and space', () => {
    expect(formatLempirasUI('1234.5')).toBe('L. 1,234.50');
    expect(formatLempirasUI(0)).toBe('L. 0.00');
    expect(formatLempirasUI(-50)).toBe('- L. 50.00');
  });

  it('formats receipt lempiras with period and space', () => {
    expect(formatLempirasReceipt('1234.5')).toBe('L. 1,234.50');
    expect(formatLempirasReceipt(0)).toBe('L. 0.00');
    expect(formatLempirasReceipt(-50)).toBe('- L. 50.00');
  });

  it('falls back to zero for malformed financial values', () => {
    expect(finiteNumber('monto-danado')).toBe(0);
    expect(formatLempirasUI('NaN')).toBe('L. 0.00');
    expect(formatLempirasReceipt('NaN')).toBe('L. 0.00');
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
