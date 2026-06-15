import { z } from 'zod';

export const invoiceItemSchema = z.object({
  service_id: z.number().int().positive('Seleccione un servicio'),
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Cantidad inválida')
    .refine((val) => {
      const parsed = parseFloat(val);
      return parsed > 0 && parsed <= 999999.99;
    }, 'La cantidad debe ser mayor que cero y menor que 1,000,000'),
  dialysis_prescription: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export const invoiceSchema = z.object({
  patient_name: z.string().min(1, 'Nombre del paciente es requerido').max(255),
  dialysis_prescription: z.boolean().optional(),
  items: z.array(invoiceItemSchema).min(1, 'Agregue al menos un servicio'),
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;
export type InvoiceItemFormData = z.infer<typeof invoiceItemSchema>;