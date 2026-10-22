import { describe, expect, it } from 'vitest';
import { normalizePatientName, cobrarPatientSchema } from './cobrarSchema';

describe('cobrarSchema · solo el nombre del paciente', () => {
  it('exige un nombre no vacío y no añade campos clínicos', () => {
    expect(cobrarPatientSchema.safeParse({ patient_name: '' }).success).toBe(false);
    expect(cobrarPatientSchema.safeParse({ patient_name: '   ' }).success).toBe(false);

    const parsed = cobrarPatientSchema.safeParse({
      patient_name: 'Ana',
      rtn: '0801',
      expediente: 'X',
    } as Record<string, unknown>);

    expect(parsed.success).toBe(true);
    expect(Object.keys(parsed.success ? parsed.data : {})).toEqual(['patient_name']);
  });

  it('acepta tildes, apóstrofos y nombres largos', () => {
    const longName = 'María José O’Connor de la Cruz ' + 'Fernández '.repeat(12);
    const result = cobrarPatientSchema.safeParse({ patient_name: longName.trim() });

    expect(result.success).toBe(true);
  });

  it('normaliza espacios repetidos y recorta extremos sin perder tildes', () => {
    expect(normalizePatientName('  José   Ángel   O\u2019Brien  ')).toBe('José Ángel O’Brien');
  });

  it('rechaza un nombre que supera el límite tras normalizar', () => {
    const result = cobrarPatientSchema.safeParse({ patient_name: 'A'.repeat(181) });

    expect(result.success).toBe(false);
  });
});
