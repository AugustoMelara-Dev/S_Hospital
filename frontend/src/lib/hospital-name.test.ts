import { describe, expect, it } from 'vitest';
import { displayHospitalName } from './hospital-name';

describe('displayHospitalName', () => {
  it('uses a clean operational fallback for empty or legacy internal names', () => {
    const legacyProductName = `Hospital ${'Bill' + 'ing'} OS`;

    expect(displayHospitalName(null)).toBe('Caja hospitalaria');
    expect(displayHospitalName('')).toBe('Caja hospitalaria');
    expect(displayHospitalName(legacyProductName)).toBe('Caja hospitalaria');
    expect(displayHospitalName(`S_Hospital ${legacyProductName}`)).toBe('Caja hospitalaria');
    expect(displayHospitalName('Hospital Demo')).toBe('Caja hospitalaria');
  });

  it('keeps the configured hospital name when it is not a legacy internal name', () => {
    expect(displayHospitalName('Hospital San Rafael')).toBe('Hospital San Rafael');
  });
});
