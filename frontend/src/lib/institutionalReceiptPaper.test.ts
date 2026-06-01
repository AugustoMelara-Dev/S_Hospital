import { describe, expect, it } from 'vitest';
import {
  INSTITUTIONAL_RECEIPT_PAPER_OPTIONS,
  INSTITUTIONAL_RECEIPT_PAPER_VALUES,
  institutionalReceiptPaperSize,
  receiptPaperSizeLabel,
} from './institutionalReceiptPaper';

describe('institutional receipt paper helpers', () => {
  it('keeps paper receipt sizes as the only visible institutional options', () => {
    expect(institutionalReceiptPaperSize('80mm')).toBe('half_letter');
    expect(institutionalReceiptPaperSize('58mm')).toBe('half_letter');
    expect(INSTITUTIONAL_RECEIPT_PAPER_VALUES).toEqual(['half_letter', 'letter', 'a5']);
    expect(INSTITUTIONAL_RECEIPT_PAPER_OPTIONS.map((option) => option.value)).toEqual([
      ...INSTITUTIONAL_RECEIPT_PAPER_VALUES,
    ]);
  });

  it('falls back to half letter for malformed values', () => {
    expect(institutionalReceiptPaperSize('ticket-roll')).toBe('half_letter');
    expect(institutionalReceiptPaperSize(null)).toBe('half_letter');
    expect(receiptPaperSizeLabel('ticket-roll')).toBe('Media carta');
  });
});
