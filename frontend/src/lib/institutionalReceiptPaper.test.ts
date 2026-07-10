import { describe, expect, it } from 'vitest';
import {
  INSTITUTIONAL_RECEIPT_PAPER_OPTIONS,
  INSTITUTIONAL_RECEIPT_PAPER_VALUES,
  institutionalReceiptPaperSize,
  receiptPrintPaperSize,
  receiptPaperSizeLabel,
} from './institutionalReceiptPaper';

describe('institutional receipt paper helpers', () => {
  it('offers only API-backed institutional defaults', () => {
    expect(INSTITUTIONAL_RECEIPT_PAPER_VALUES).toEqual(['letter', 'half_letter', 'a5']);
    expect(INSTITUTIONAL_RECEIPT_PAPER_OPTIONS.map((option) => option.value)).toEqual([
      ...INSTITUTIONAL_RECEIPT_PAPER_VALUES,
    ]);
  });

  it('falls back to half letter for malformed and thermal setting values', () => {
    expect(institutionalReceiptPaperSize('80mm')).toBe('half_letter');
    expect(institutionalReceiptPaperSize('58mm')).toBe('half_letter');
    expect(institutionalReceiptPaperSize('ticket-roll')).toBe('half_letter');
    expect(institutionalReceiptPaperSize(null)).toBe('half_letter');
    expect(receiptPaperSizeLabel('ticket-roll')).toBe('Media carta');
  });

  it('preserves valid thermal widths for receipts that were already issued', () => {
    expect(receiptPrintPaperSize('80mm')).toBe('80mm');
    expect(receiptPrintPaperSize('58mm')).toBe('58mm');
    expect(receiptPrintPaperSize('letter')).toBe('letter');
    expect(receiptPrintPaperSize('ticket-roll')).toBe('half_letter');
  });
});
