import { z } from 'zod';

export const receiptProfileSchema = z.object({
  copies_mode: z.enum(['original_only', 'original_first', 'original_first_second']),
  show_copy_legend: z.boolean(),
  show_physical_seal_space: z.boolean(),
  use_logo: z.boolean(),
  active: z.boolean(),
  is_global_default: z.boolean(),
});

export type ReceiptProfileForm = z.infer<typeof receiptProfileSchema>;

export const seriesSchema = z.object({
  series: z.string().trim().min(1, 'Requerido'),
  prefix: z.string().trim().min(1, 'Requerido'),
  number_format: z.string().trim().min(1, 'Requerido'),
  min_number: z.number().int().min(1),
  max_number: z.number().int().min(1),
  current_number: z.number().int().min(0),
  range_authorization: z.string().max(120).optional(),
  legal_text: z.string().max(255).optional(),
  active: z.boolean(),
}).refine((data) => data.max_number >= data.min_number, {
  path: ['max_number'],
  message: 'El numero final debe ser mayor o igual al inicial.',
}).refine((data) => data.current_number <= data.max_number, {
  path: ['current_number'],
  message: 'El correlativo actual no puede superar el numero final.',
}).refine((data) => !data.active || (data.current_number + 1 >= data.min_number && data.current_number + 1 <= data.max_number), {
  path: ['current_number'],
  message: 'El siguiente recibo debe quedar dentro del rango autorizado.',
});

export const advancedProfileSchema = z.object({
  width_mm: z.number().positive('Debe ser mayor que cero.'),
  height_mm: z.number().positive('Debe ser mayor que cero.'),
  margin_top_mm: z.number().min(0),
  margin_right_mm: z.number().min(0),
  margin_bottom_mm: z.number().min(0),
  margin_left_mm: z.number().min(0),
  orientation: z.enum(['landscape', 'portrait']),
  font_family: z.string().trim().min(1),
  font_scale: z.number().min(0.5).max(2),
  support_reason: z.string().trim().min(10, 'Documente el motivo de soporte.'),
});

export type SeriesFormData = z.infer<typeof seriesSchema>;
export type AdvancedProfileFormData = z.infer<typeof advancedProfileSchema>;
