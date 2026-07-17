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
