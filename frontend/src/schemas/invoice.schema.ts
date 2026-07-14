import { z } from 'zod';

export const PATIENT_NAME_MAX_LENGTH = 180;

export const invoiceItemSchema = z.object({
  service_id: z.number().int().positive('Seleccione un servicio'),
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Cantidad inválida')
    .refine((val) => {
      const parsed = parseFloat(val);
      return parsed > 0 && parsed <= 999999.99;
    }, 'La cantidad debe ser mayor que cero y menor que 1,000,000'),
  notes: z.string().nullable().optional(),
});

export const invoiceSchema = z.object({
  patient_name: z.string()
    .trim()
    .min(1, 'Nombre del paciente es requerido')
    .max(PATIENT_NAME_MAX_LENGTH, `Nombre del paciente no puede superar ${PATIENT_NAME_MAX_LENGTH} caracteres`),
  dialysis_prescription: z.boolean().optional(),
  items: z.array(invoiceItemSchema).min(1, 'Agregue al menos un servicio'),
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;
export type InvoiceItemFormData = z.infer<typeof invoiceItemSchema>;
