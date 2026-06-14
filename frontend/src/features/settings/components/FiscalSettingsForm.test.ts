import { describe, expect, it } from 'vitest';

import { sequenceFormSchema } from './FiscalSettingsForm';

describe('sequenceFormSchema', () => {
  it('accepts backend-compatible fiscal prefix and cai lengths', () => {
    const parsed = sequenceFormSchema.safeParse({
      prefix: '000-001-01-LOCAL-CAJA-PRINC',
      cai: 'A'.repeat(128),
      min_number: 1,
      max_number: 99999999,
      valid_until: '2027-12-31',
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects max number lower than min number', () => {
    const parsed = sequenceFormSchema.safeParse({
      prefix: '000-001-01',
      cai: 'CAI-TEST',
      min_number: 100,
      max_number: 99,
      valid_until: '2027-12-31',
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues.some((issue) => issue.path.join('.') === 'max_number')).toBe(true);
  });
});
