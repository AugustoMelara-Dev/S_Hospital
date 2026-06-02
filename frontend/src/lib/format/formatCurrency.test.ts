import { describe, expect, it } from 'vitest';
import { formatLempiras, formatPlainDecimal, parseAmount } from './formatCurrency';

describe('formatCurrency', () => {
  describe('formatLempiras', () => {
    it('renders the lempiras prefix and two decimals', () => {
      expect(formatLempiras(0)).toBe('L. 0.00');
      expect(formatLempiras(1)).toBe('L. 1.00');
      expect(formatLempiras(1.5)).toBe('L. 1.50');
    });

    it('inserts a thousands separator for amounts >= 1,000', () => {
      expect(formatLempiras(1500)).toBe('L. 1,500.00');
      expect(formatLempiras(1234567.89)).toBe('L. 1,234,567.89');
    });

    it('accepts a string input and rejects malformed values', () => {
      expect(formatLempiras('1500.5')).toBe('L. 1,500.50');
      expect(formatLempiras('1,500.50')).toBe('L. 1,500.50');
      expect(formatLempiras('not-a-number')).toBe('L. 0.00');
    });

    it('treats null and undefined as zero', () => {
      expect(formatLempiras(null)).toBe('L. 0.00');
      expect(formatLempiras(undefined)).toBe('L. 0.00');
    });
  });

  describe('formatPlainDecimal', () => {
    it('returns the decimal string without the currency prefix', () => {
      expect(formatPlainDecimal(0)).toBe('0.00');
      expect(formatPlainDecimal('12.5')).toBe('12.50');
    });
  });

  describe('parseAmount', () => {
    it('parses plain and comma-separated numbers', () => {
      expect(parseAmount('1,500.50')).toBe(1500.5);
      expect(parseAmount('1500.50')).toBe(1500.5);
    });

    it('returns null on invalid input', () => {
      expect(parseAmount('abc')).toBeNull();
      expect(parseAmount(null)).toBeNull();
      expect(parseAmount(undefined)).toBeNull();
    });
  });
});
