import { useCallback, useRef, useState } from 'react';
import { apiClient, userSafeErrorMessage, type InstitutionalReceipt } from '@/lib/api';
import { createClientIdempotencyKey } from '@/lib/api/base';
import { downloadBlob, institutionalReceiptPdfFilename, openBlobInNewTab } from '@/lib/download';
import type { OperationalStatusReporter } from '@/app/operationalStatus';

type UseCobrarReceiptActionsArgs = {
  receipt: InstitutionalReceipt | null;
  onStatus: OperationalStatusReporter;
};

/**
 * Acciones del comprobante emitido. Un fallo de PDF o impresora informa sin
 * volver a cobrar: la operación ya quedó registrada.
 */
export function useCobrarReceiptActions({ receipt, onStatus }: UseCobrarReceiptActionsArgs) {
  const [printing, setPrinting] = useState(false);
  const [saving, setSaving] = useState(false);
  const printKeyRef = useRef<string | null>(null);

  const print = useCallback(async () => {
    if (!receipt) return;

    setPrinting(true);
    try {
      const idempotencyKey = (printKeyRef.current ??= createClientIdempotencyKey());
      const blob = await apiClient.getInstitutionalReceiptPdf(receipt.id);
      await apiClient.registerInstitutionalReceiptPrintEvent(receipt.id, undefined, { idempotencyKey });
      printKeyRef.current = null;
      openBlobInNewTab(blob, institutionalReceiptPdfFilename(receipt.receipt_number_full));
      onStatus({
        message: `PDF institucional ${receipt.receipt_number_full} abierto.`,
        level: 'success',
        key: 'cobrar-receipt',
        toast: false,
      });
    } catch (error) {
      onStatus({
        message: userSafeErrorMessage(error, 'No se pudo abrir el PDF institucional.'),
        level: 'error',
        key: 'cobrar-receipt',
        toast: false,
      });
    } finally {
      setPrinting(false);
    }
  }, [onStatus, receipt]);

  const savePdf = useCallback(async () => {
    if (!receipt) return;

    setSaving(true);
    try {
      const blob = await apiClient.getInstitutionalReceiptPdf(receipt.id);
      downloadBlob(blob, institutionalReceiptPdfFilename(receipt.receipt_number_full));
      onStatus({
        message: `PDF institucional ${receipt.receipt_number_full} guardado.`,
        level: 'success',
        key: 'cobrar-receipt',
        toast: false,
      });
    } catch (error) {
      onStatus({
        message: userSafeErrorMessage(error, 'No se pudo guardar el PDF institucional.'),
        level: 'error',
        key: 'cobrar-receipt',
        toast: false,
      });
    } finally {
      setSaving(false);
    }
  }, [onStatus, receipt]);

  return { print, savePdf, printing, saving };
}
