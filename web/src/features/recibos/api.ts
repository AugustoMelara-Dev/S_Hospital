import type { QueryClient } from '@tanstack/react-query';
import { downloadFile } from '@/lib/api';
import { qk } from '@/api/queryClient';
import type { Receipt } from '@/api/types';

/** Opens the institutional receipt PDF in a new tab (call directly from a click). */
export function openReceiptPdf(receiptId: number): Promise<void> {
  return downloadFile(`/receipts/${receiptId}/pdf`);
}

/** Downloads the receipt PDF as a file. */
export function saveReceiptPdf(receipt: Pick<Receipt, 'id' | 'number_full'>): Promise<void> {
  return downloadFile(`/receipts/${receipt.id}/pdf`, { mode: 'save', filename: `${receipt.number_full}.pdf` });
}

/** Refreshes everything an invoice/payment operation can change. */
export function invalidateAfterOperation(qc: QueryClient, invoiceId?: number): Promise<unknown> {
  return Promise.all([
    invoiceId !== undefined ? qc.invalidateQueries({ queryKey: qk.invoice(invoiceId) }) : null,
    qc.invalidateQueries({ queryKey: ['invoices', 'list'] }),
    qc.invalidateQueries({ queryKey: qk.currentCash }),
    qc.invalidateQueries({ queryKey: ['reports'] }),
  ]);
}
