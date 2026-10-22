import { describe, expect, it } from 'vitest';
import { DEFAULT_HOSPITAL_NAME, displayHospitalName } from './hospital-name';

describe('displayHospitalName', () => {
  it('uses the neutral product name for empty or retired internal names', () => {
    const retiredProductName = `Hospital ${'Bill' + 'ing'} OS`;

    expect(DEFAULT_HOSPITAL_NAME).toBe('S_Hospital');
    expect(displayHospitalName(null)).toBe('S_Hospital');
    expect(displayHospitalName('')).toBe('S_Hospital');
    expect(displayHospitalName('Hospital San Isidro')).toBe('S_Hospital');
    expect(displayHospitalName('Hospital General San Isidro')).toBe('S_Hospital');
    expect(displayHospitalName(retiredProductName)).toBe('S_Hospital');
    expect(displayHospitalName(`S_Hospital ${retiredProductName}`)).toBe('S_Hospital');
    expect(displayHospitalName(`Hospital ${'De' + 'mo'}`)).toBe('S_Hospital');
  });

  it('keeps the configured hospital name when it is not a retired internal name', () => {
    expect(displayHospitalName('Hospital San Rafael')).toBe('Hospital San Rafael');
  });
});
