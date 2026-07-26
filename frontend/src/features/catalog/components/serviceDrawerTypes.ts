import { z } from 'zod';

export const SPECIAL_RULE_ERYTHROPOIETIN = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';
export const MIN_CHANGE_REASON_LENGTH = 5;

export const serviceSchema = z.object({
  category_id: z.number().min(1, 'Seleccione una categoria'),
  area_id: z.number().min(1, 'Seleccione un area'),
  name: z.string().trim().min(1, 'El nombre es requerido'),
  price: z.string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Precio debe ser un numero valido')
    .refine((value) => (priceCents(value) ?? 0) > 0, 'Precio debe ser mayor que cero'),
  price_change_reason: z.string().max(500, 'Motivo maximo 500 caracteres').nullable().optional(),
  tax_change_reason: z.string().max(500, 'Motivo maximo 500 caracteres').nullable().optional(),
  availability_change_reason: z.string().max(500, 'Motivo maximo 500 caracteres').nullable().optional(),
  scan_code: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  qr_code: z.string().nullable().optional(),
  taxable: z.boolean(),
  active: z.boolean(),
  visible_in_billing: z.boolean(),
  is_billable: z.boolean(),
});

export type ServiceFormData = z.infer<typeof serviceSchema>;

export const defaultServiceFormValues: ServiceFormData = {
  category_id: 0,
  area_id: 0,
  name: '',
  price: '0.00',
  price_change_reason: null,
  tax_change_reason: null,
  availability_change_reason: null,
  scan_code: null,
  barcode: null,
  qr_code: null,
  taxable: true,
  active: true,
  visible_in_billing: true,
  is_billable: true,
};

export function priceCents(value: string): number | null {
  const match = value.trim().match(/^(\d+)(?:\.(\d{1,2}))?$/);

  if (!match) {
    return null;
  }

  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
}
