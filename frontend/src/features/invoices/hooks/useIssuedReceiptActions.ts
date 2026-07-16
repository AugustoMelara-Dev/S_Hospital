import { useRef, type Dispatch } from 'react';
import { apiClient, type InstitutionalReceipt, type ReceiptData, userSafeErrorMessage } from '@/lib/api';
import { createClientIdempotencyKey } from '@/lib/api/base';
import { downloadBlob, institutionalReceiptPdfFilename, openBlobInNewTab } from '@/lib/download';
import type { OperationalStatusReporter } from '@/app/operationalStatus';
import type { NewInvoiceAction, NewInvoiceState } from '../state/types';

type IssuedReceiptActionsOptions = {
  state: NewInvoiceState;
  dispatch: Dispatch<NewInvoiceAction>;
  loadHistoricalReceipt: (width: ReceiptData['width']) => Promise<void>;
  onStatus: OperationalStatusReporter;
};

export function useIssuedReceiptActions({ state, dispatch, loadHistoricalReceipt, onStatus }: IssuedReceiptActionsOptions) {
  const printIdempotencyKeyRef = useRef<string | null>(null);

  async function openPdf(receipt: InstitutionalReceipt, reason?: string) {
    const idempotencyKey = printIdempotencyKeyRef.current ??= createClientIdempotencyKey();
    const blob = await apiClient.getInstitutionalReceiptPdf(receipt.id);
    await apiClient.registerInstitutionalReceiptPrintEvent(receipt.id, reason?.trim() || undefined, { idempotencyKey });
    printIdempotencyKeyRef.current = null;
    openBlobInNewTab(blob, institutionalReceiptPdfFilename(receipt.receipt_number_full));
  }

  async function printIssuedReceipt() {
    const receipt = state.institutionalReceipt;
    if (!receipt) return loadHistoricalReceipt(state.receiptWidth);

    try {
      const isReprint = receipt.has_print_events === true || (receipt.print_events_count ?? 0) > 0;
      await openPdf(receipt, isReprint ? 'Reimpresion desde venta/cobro.' : undefined);
      dispatch({
        type: 'SET_INSTITUTIONAL_RECEIPT',
        payload: {
          ...receipt,
          has_print_events: true,
          print_events_count: (receipt.print_events_count ?? 0) + 1,
          reprint_count: receipt.reprint_count + (isReprint ? 1 : 0),
        },
      });
      onStatus({ message: `PDF institucional ${receipt.receipt_number_full} abierto.`, level: 'success', key: 'billing-receipt', toast: false });
    } catch (error) {
      onStatus({ message: userSafeErrorMessage(error, 'No se pudo abrir el PDF institucional.'), level: 'error', key: 'billing-receipt', toast: false });
    }
  }

  function viewIssuedReceipt() {
    if (!state.institutionalReceipt && !state.receipt) return;
    dispatch({ type: 'SET_SHOW_SUCCESS', payload: false });
    dispatch({ type: 'SET_SHOW_RECEIPT', payload: true });
  }

  async function saveIssuedReceiptPdf() {
    const receipt = state.institutionalReceipt;
    if (!receipt) return;
    try {
      const blob = await apiClient.getInstitutionalReceiptPdf(receipt.id);
      downloadBlob(blob, institutionalReceiptPdfFilename(receipt.receipt_number_full));
      onStatus({ message: `PDF institucional ${receipt.receipt_number_full} guardado.`, level: 'success', key: 'billing-receipt', toast: false });
    } catch (error) {
      onStatus({ message: userSafeErrorMessage(error, 'No se pudo guardar el PDF institucional.'), level: 'error', key: 'billing-receipt', toast: false });
    }
  }

  function setReceiptOpen(nextOpen: boolean) {
    dispatch({ type: 'SET_SHOW_RECEIPT', payload: nextOpen });
    if (!nextOpen && (state.issuedInvoice?.status === 'paid' || state.issuedInvoice?.status === 'partial')) {
      dispatch({ type: 'SET_SHOW_SUCCESS', payload: true });
    }
  }

  return { printIssuedReceipt, saveIssuedReceiptPdf, setReceiptOpen, viewIssuedReceipt };
}
