import type { ReceiptData } from './api';

export const INSTITUTIONAL_RECEIPT_PAPER_VALUES = [
  'half_letter',
  '80mm',
  '58mm',
  'letter',
  'a5',
] as const satisfies readonly ReceiptData['width'][];

export type InstitutionalReceiptPaperOption = (typeof INSTITUTIONAL_RECEIPT_PAPER_VALUES)[number];

export const INSTITUTIONAL_RECEIPT_PAPER_OPTIONS: Array<{
  value: InstitutionalReceiptPaperOption;
  label: string;
}> = [
  { value: 'half_letter', label: 'Media carta' },
  { value: '80mm', label: 'Termico 80mm' },
  { value: '58mm', label: 'Termico 58mm' },
  { value: 'letter', label: 'Carta' },
  { value: 'a5', label: 'A5' },
];

export function institutionalReceiptPaperSize(
  value: ReceiptData['width'] | string | null | undefined,
): InstitutionalReceiptPaperOption {
  return INSTITUTIONAL_RECEIPT_PAPER_OPTIONS.some((option) => option.value === value)
    ? (value as InstitutionalReceiptPaperOption)
    : 'half_letter';
}

export function receiptPaperSizeLabel(value: ReceiptData['width'] | string | null | undefined): string {
  const normalized = institutionalReceiptPaperSize(value);
  return INSTITUTIONAL_RECEIPT_PAPER_OPTIONS.find((option) => option.value === normalized)?.label ?? 'Media carta';
}
