import { describe, expect, it } from 'vitest';
import { finiteNumber, formatLempiras } from './money';

describe('money formatting helpers', () => {
  it('formats lempiras with deterministic separators', () => {
    expect(formatLempiras('1234.5')).toBe('L. 1,234.50');
    expect(formatLempiras(0)).toBe('L. 0.00');
    expect(formatLempiras(-50)).toBe('- L. 50.00');
  });

  it('falls back to zero for malformed financial values', () => {
    expect(finiteNumber('monto-danado')).toBe(0);
    expect(formatLempiras('NaN')).toBe('L. 0.00');
  });
});
