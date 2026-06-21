import { describe, expect, it } from 'vitest';
import { finiteNumber, formatLempirasReceipt, formatLempirasUI } from './money';

describe('money formatting helpers', () => {
  it('formats UI lempiras without period and with space', () => {
    expect(formatLempirasUI('1234.5')).toBe('L 1,234.50');
    expect(formatLempirasUI(0)).toBe('L 0.00');
    expect(formatLempirasUI(-50)).toBe('- L 50.00');
  });

  it('formats receipt lempiras with period and space', () => {
    expect(formatLempirasReceipt('1234.5')).toBe('L. 1,234.50');
    expect(formatLempirasReceipt(0)).toBe('L. 0.00');
    expect(formatLempirasReceipt(-50)).toBe('- L. 50.00');
  });

  it('falls back to zero for malformed financial values', () => {
    expect(finiteNumber('monto-danado')).toBe(0);
    expect(formatLempirasUI('NaN')).toBe('L 0.00');
    expect(formatLempirasReceipt('NaN')).toBe('L. 0.00');
  });
});
