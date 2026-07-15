import type { ReceiptData } from './api';
import {
  PAPER_CHOICES,
  normalizeInstitutionalPaper,
  paperChoiceFor,
  type InstitutionalPaper,
} from '../modules/receipts/paperPolicy';

export const INSTITUTIONAL_RECEIPT_PAPER_VALUES = PAPER_CHOICES.map((option) => option.value);

export type InstitutionalReceiptPaperOption = InstitutionalPaper;

export const INSTITUTIONAL_RECEIPT_PAPER_OPTIONS = PAPER_CHOICES;

export function institutionalReceiptPaperSize(
  value: ReceiptData['width'] | string | null | undefined,
): InstitutionalReceiptPaperOption {
  return normalizeInstitutionalPaper(value);
}

export function receiptPrintPaperSize(
  value: ReceiptData['width'] | string | null | undefined,
): ReceiptData['width'] {
  return value === 'letter' || value === 'half_letter' || value === 'a5' || value === 'custom' || value === '80mm' || value === '58mm'
    ? value
    : 'half_letter';
}

export function receiptPaperSizeLabel(
  value: ReceiptData['width'] | string | null | undefined,
): string {
  return paperChoiceFor(institutionalReceiptPaperSize(value)).label;
}
