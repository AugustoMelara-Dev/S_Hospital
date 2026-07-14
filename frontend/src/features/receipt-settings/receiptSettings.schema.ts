import { z } from 'zod';

export const receiptInstitutionSchema = z.object({
  hospital_name: z.string().min(1, 'El nombre del hospital es requerido').max(255),
  rtn: z.string().max(32).optional().nullable(),
  address: z.string().max(255).optional().nullable(),
  slogan: z.string().max(255).optional().nullable(),
  government_line: z.string().max(120).optional().nullable(),
  secretariat_line: z.string().max(160).optional().nullable(),
  receipt_location: z.string().max(160).optional().nullable(),
  receipt_footer_text: z.string().max(255).optional().nullable(),
  receipt_template_mode: z.literal('institutional'),
});

export const receiptSeriesSchema = z.object({
  series: z.string().min(1, 'La serie es requerida').max(32),
  prefix: z.string().min(1, 'El prefijo es requerido').max(32),
  number_format: z.string().min(1).max(80),
  min_number: z.number().int().min(1),
  max_number: z.number().int().min(1),
  current_number: z.number().int().min(0),
  range_authorization: z.string().max(128).optional().nullable(),
  legal_text: z.string().max(2000).optional().nullable(),
  receipt_number_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  active: z.boolean(),
  reprint_behavior: z.enum(['audit_only', 'require_reason']),
  void_behavior: z.literal('permission_reason_audit'),
}).superRefine((data, ctx) => {
  if (data.max_number < data.min_number) {
    ctx.addIssue({
      code: 'custom',
      path: ['max_number'],
      message: 'El numero final debe ser mayor o igual al inicial.',
    });
  }

  if (data.active) {
    const next = data.current_number + 1;
    if (next < data.min_number || next > data.max_number) {
      ctx.addIssue({
        code: 'custom',
        path: ['current_number'],
        message: 'El siguiente correlativo debe quedar dentro del rango.',
      });
    }
  }
});

export const receiptProfileSchema = z.object({
  copies_mode: z.enum(['original_only', 'original_first', 'original_first_second']),
  show_copy_legend: z.boolean(),
  show_physical_seal_space: z.boolean(),
  use_logo: z.boolean(),
  active: z.boolean(),
  is_global_default: z.boolean(),
});

export type ReceiptInstitutionForm = z.infer<typeof receiptInstitutionSchema>;
export type ReceiptSeriesForm = z.infer<typeof receiptSeriesSchema>;
export type ReceiptProfileForm = z.infer<typeof receiptProfileSchema>;
