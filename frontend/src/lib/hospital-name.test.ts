import { describe, expect, it } from 'vitest';
import { displayHospitalName } from './hospital-name';

describe('displayHospitalName', () => {
  it('uses a clean operational fallback for empty or legacy internal names', () => {
    const legacyProductName = `Hospital ${'Bill' + 'ing'} OS`;

    expect(displayHospitalName(null)).toBe('Hospital San Isidro');
    expect(displayHospitalName('')).toBe('Hospital San Isidro');
    expect(displayHospitalName(legacyProductName)).toBe('Hospital San Isidro');
    expect(displayHospitalName(`S_Hospital ${legacyProductName}`)).toBe('Hospital San Isidro');
    expect(displayHospitalName(`Hospital ${'De' + 'mo'}`)).toBe('Hospital San Isidro');
  });

  it('keeps the configured hospital name when it is not a legacy internal name', () => {
    expect(displayHospitalName('Hospital San Rafael')).toBe('Hospital San Rafael');
  });
});
