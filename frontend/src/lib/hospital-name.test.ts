import { describe, expect, it } from 'vitest';
import { displayHospitalName } from './hospital-name';

describe('displayHospitalName', () => {
  it('uses a clean operational fallback for empty or legacy internal names', () => {
    expect(displayHospitalName(null)).toBe('Caja hospitalaria');
    expect(displayHospitalName('')).toBe('Caja hospitalaria');
    expect(displayHospitalName('Hospital Billing OS')).toBe('Caja hospitalaria');
    expect(displayHospitalName('S_Hospital Billing OS')).toBe('Caja hospitalaria');
  });

  it('keeps the configured hospital name when it is not a legacy internal name', () => {
    expect(displayHospitalName('Hospital San Rafael')).toBe('Hospital San Rafael');
  });
});
