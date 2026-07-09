import { describe, expect, it } from 'vitest';
import {
  INSTITUTIONAL_PAPER_OPTIONS,
  isLegacyThermalPaper,
  normalizeInstitutionalPaper,
} from './paperPolicy';

describe('institutional receipt paper policy', () => {
  it('offers only the three institutional paper choices', () => {
    expect(INSTITUTIONAL_PAPER_OPTIONS).toEqual([
      { value: 'letter', label: 'Carta' },
      { value: 'half_letter', label: 'Media carta' },
      { value: 'a5', label: 'A5' },
    ]);
  });

  it('falls back safely and identifies historical thermal values', () => {
    expect(normalizeInstitutionalPaper('ticket-roll')).toBe('half_letter');
    expect(normalizeInstitutionalPaper('80mm')).toBe('half_letter');
    expect(isLegacyThermalPaper('80mm')).toBe(true);
    expect(isLegacyThermalPaper('58mm')).toBe(true);
    expect(isLegacyThermalPaper('letter')).toBe(false);
  });
});
