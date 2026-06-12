import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').max(255),
  active: z.boolean(),
  sort_order: z.number().int().min(0),
});

export const serviceSchema = z.object({
  category_id: z.number().int().positive('Seleccione una categoria'),
  area_id: z.number().int().positive('Seleccione un area'),
  name: z.string().min(1, 'Nombre es requerido').max(255),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Precio invalido'),
  price_change_reason: z.string().max(500).nullable().optional(),
  scan_code: z.string().nullable(),
  barcode: z.string().nullable(),
  qr_code: z.string().nullable(),
  taxable: z.boolean(),
  active: z.boolean(),
  visible_in_billing: z.boolean(),
  is_billable: z.boolean(),
  special_rule_code: z.string().nullable(),
});

export type CategoryFormData = z.infer<typeof categorySchema>;
export type ServiceFormData = z.infer<typeof serviceSchema>;
