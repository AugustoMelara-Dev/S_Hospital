import { describe, expect, it } from 'vitest';
import { invoiceSchema, PATIENT_NAME_MAX_LENGTH } from './invoice.schema';

describe('invoiceSchema', () => {
  it('matches backend patient name length limit', () => {
    const validName = 'A'.repeat(PATIENT_NAME_MAX_LENGTH);
    const invalidName = 'A'.repeat(PATIENT_NAME_MAX_LENGTH + 1);

    expect(invoiceSchema.safeParse({
      patient_name: validName,
      items: [{ service_id: 1, quantity: '1' }],
    }).success).toBe(true);

    const result = invoiceSchema.safeParse({
      patient_name: invalidName,
      items: [{ service_id: 1, quantity: '1' }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.format().patient_name?._errors).toContain('Nombre del paciente no puede superar 180 caracteres');
  });
});
