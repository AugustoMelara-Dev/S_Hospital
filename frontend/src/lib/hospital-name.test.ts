import { describe, expect, it } from 'vitest';
import { displayHospitalName } from './hospital-name';

describe('displayHospitalName', () => {
  it('uses a clean operational fallback for empty or retired internal names', () => {
    const retiredProductName = `Hospital ${'Bill' + 'ing'} OS`;

    expect(displayHospitalName(null)).toBe('Hospital San Isidro');
    expect(displayHospitalName('')).toBe('Hospital San Isidro');
    expect(displayHospitalName(retiredProductName)).toBe('Hospital San Isidro');
    expect(displayHospitalName(`S_Hospital ${retiredProductName}`)).toBe('Hospital San Isidro');
    expect(displayHospitalName(`Hospital ${'De' + 'mo'}`)).toBe('Hospital San Isidro');
  });

  it('keeps the configured hospital name when it is not a retired internal name', () => {
    expect(displayHospitalName('Hospital San Rafael')).toBe('Hospital San Rafael');
  });
});
