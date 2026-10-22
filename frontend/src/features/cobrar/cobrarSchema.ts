import { z } from 'zod';
import { PATIENT_NAME_MAX_LENGTH } from '@/schemas/invoice.schema';

export { PATIENT_NAME_MAX_LENGTH };

/**
 * Normaliza el nombre del paciente conservando tildes y apóstrofos.
 * Colapsa espacios repetidos y recorta extremos. El backend sigue siendo la
 * autoridad de validación; esto solo evita ruido en la captura.
 */
export function normalizePatientName(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/**
 * Contrato de captura del paciente en Cobrar: SOLO el nombre.
 * No hay RTN, contacto, expediente, edad, seguro ni selección previa.
 */
export const cobrarPatientSchema = z.object({
  patient_name: z
    .string()
    .max(400, `Nombre del paciente no puede superar ${PATIENT_NAME_MAX_LENGTH} caracteres`)
    .refine(
      (value) => normalizePatientName(value).length > 0,
      'Ingrese el nombre del paciente.',
    )
    .refine(
      (value) => normalizePatientName(value).length <= PATIENT_NAME_MAX_LENGTH,
      `Nombre del paciente no puede superar ${PATIENT_NAME_MAX_LENGTH} caracteres`,
    ),
});

export type CobrarPatientFormData = z.infer<typeof cobrarPatientSchema>;
