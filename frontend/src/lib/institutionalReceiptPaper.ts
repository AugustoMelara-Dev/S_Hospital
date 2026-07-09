import type { ReceiptData } from './api';
import {
  INSTITUTIONAL_PAPER_OPTIONS,
  normalizeInstitutionalPaper,
  type InstitutionalPaper,
} from '../modules/receipts/paperPolicy';

export const INSTITUTIONAL_RECEIPT_PAPER_VALUES = INSTITUTIONAL_PAPER_OPTIONS.map((option) => option.value);

export type InstitutionalReceiptPaperOption = InstitutionalPaper;

export const INSTITUTIONAL_RECEIPT_PAPER_OPTIONS = [...INSTITUTIONAL_PAPER_OPTIONS];

export function institutionalReceiptPaperSize(
  value: ReceiptData['width'] | string | null | undefined,
): InstitutionalReceiptPaperOption {
  return normalizeInstitutionalPaper(value);
}

export function receiptPaperSizeLabel(value: ReceiptData['width'] | string | null | undefined): string {
  const normalized = institutionalReceiptPaperSize(value);
  return INSTITUTIONAL_RECEIPT_PAPER_OPTIONS.find((option) => option.value === normalized)?.label ?? 'Media carta';
}
