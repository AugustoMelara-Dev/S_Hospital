import { z } from 'zod';

export const invoiceItemSchema = z.object({
  service_id: z.number().int().positive('Seleccione un servicio'),
  quantity: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Cantidad inválida'),
  dialysis_prescription: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

export const invoiceSchema = z.object({
  patient_name: z.string().min(1, 'Nombre del paciente es requerido').max(255),
  items: z.array(invoiceItemSchema).min(1, 'Agregue al menos un servicio'),
});

export type InvoiceFormData = z.infer<typeof invoiceSchema>;
export type InvoiceItemFormData = z.infer<typeof invoiceItemSchema>;