import { describe, expect, it } from 'vitest';
import { receiptProfileAdvancedSchema } from './receiptSettings.schema';

const advancedPayload = {
  width_mm: 45,
  height_mm: 95,
  margin_top_mm: 5,
  margin_right_mm: 5,
  margin_bottom_mm: 5,
  margin_left_mm: 5,
  font_family: 'Arial, sans-serif',
  font_scale: 1,
  paper_kind: 'custom_mm',
  orientation: 'landscape',
  template_code: 'institutional_classic',
};

describe('receipt settings schemas', () => {
  it('keeps advanced support schema aligned with support-only print limits', () => {
    expect(receiptProfileAdvancedSchema.safeParse(advancedPayload).success).toBe(false);
    expect(receiptProfileAdvancedSchema.safeParse({ ...advancedPayload, width_mm: 180 }).success).toBe(false);
    expect(receiptProfileAdvancedSchema.safeParse({
      ...advancedPayload,
      width_mm: 180,
      support_reason: 'Ajuste por soporte tecnico',
    }).success).toBe(true);
  });
});
