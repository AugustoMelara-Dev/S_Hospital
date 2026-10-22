import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  type Invoice,
  type ReceiptData,
  apiClient,
  institutionalReceipts,
  userSafeErrorMessage,
} from '../../../lib/api';
import { downloadBlob, institutionalReceiptPdfFilename, openBlobInNewTab } from '../../../lib/download';
import { institutionalReceiptPaperSize } from '../../../lib/institutionalReceiptPaper';
import { invalidateBillingQueries } from '@/lib/queryInvalidation';
import { payloadScopedIdempotencyKey, resetPayloadScopedIdempotencyKey } from '../../../lib/api/idempotency';
import type { OperationalStatusReporter } from '@/app/operationalStatus';
import {
  latestPostedPayment,
  hasInstitutionalPrintEvents,
  isAuditedReprintReceipt,
  issuedInstitutionalReceipt,
  requiresLegacyReprintReason,
} from './invoiceHistoryReceiptRules';

type UseInvoiceHistoryReceiptsOptions = {
  selectedInvoice: Invoice | null;
  setSelectedInvoice: Dispatch<SetStateAction<Invoice | null>>;
  onStatus: OperationalStatusReporter;
  synchronizeDetailInvoice: (invoice: Invoice) => void;
};

/**
 * Flujo de recibos del historial: vista previa, primera impresión sin motivo ni
 * etiqueta de reimpresión, reimpresión auditada con motivo humano interactivo e
 * idempotencia estable.
 *
 * F012/T2-035+T3-004: la primera impresión autorizada del comprobante legacy se
 * resuelve de inmediato (sin POST ni etiqueta) mientras el contador durable
 * `legacy_reprint_count` del backend sea 0; una impresión posterior con
 * contador > 0 pide motivo (5–500) y audita la REIMPRESIÓN numerada con el
 * contador persistente del servidor. Tras recargar, el estado sigue siendo
 * correcto porque el contador vive en la factura, no en la sesión del frontend.
 * La primera impresión institucional (sin print-events) se registra sin motivo,
 * como exige HIST-6.
 */
export function useInvoiceHistoryReceipts({
  selectedInvoice,
  setSelectedInvoice,
  onStatus,
  synchronizeDetailInvoice,
}: UseInvoiceHistoryReceiptsOptions) {
  const queryClient = useQueryClient();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptWidth, setReceiptWidth] = useState<ReceiptData['width']>('half_letter');
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [confirmingReprint, setConfirmingReprint] = useState(false);
  const [confirmingReceiptPrint, setConfirmingReceiptPrint] = useState(false);
  const [reprintingReceipt, setReprintingReceipt] = useState(false);
  const [loadingActionInvoiceId, setLoadingActionInvoiceId] = useState<number | null>(null);
  const registeringReprintRef = useRef(false);
  const generatingInstitutionalReceiptRef = useRef(false);
  const reprintIdempotencyKeyRef = useRef<string | null>(null);
  const reprintIdempotencySignatureRef = useRef<string | null>(null);
  const previewPrintIdempotencyKeyRef = useRef<string | null>(null);
  const previewPrintIdempotencySignatureRef = useRef<string | null>(null);
  const receiptGenerationIdempotencyKeyRef = useRef<string | null>(null);
  const receiptGenerationIdempotencySignatureRef = useRef<string | null>(null);
  const receiptGenerationPrintIdempotencyKeyRef = useRef<string | null>(null);
  const receiptGenerationPrintIdempotencySignatureRef = useRef<string | null>(null);
  const receiptRequestRef = useRef(0);
  const pendingLegacyPrintResolveRef = useRef<(() => void) | null>(null);

  async function openReceiptModal(invoiceId: number) {
    const requestId = receiptRequestRef.current + 1;
    receiptRequestRef.current = requestId;
    setReceipt(null);

    try {
      const invoice = await apiClient.getInvoice(invoiceId);
      if (receiptRequestRef.current !== requestId) return;

      setSelectedInvoice(invoice);
      const institutionalReceipt = issuedInstitutionalReceipt(invoice);
      if (institutionalReceipt) {
        setReceiptModalOpen(true);
        return;
      }

      const requestedWidth = institutionalReceiptPaperSize(receiptWidth);
      const receiptData = await apiClient.getReceipt(invoiceId, requestedWidth);
      if (receiptRequestRef.current !== requestId) return;

      const normalizedWidth = institutionalReceiptPaperSize(receiptData.width);
      setReceiptWidth(normalizedWidth);
      setReceipt({ ...receiptData, width: normalizedWidth });
      setReceiptModalOpen(true);
    } catch (error) {
      if (receiptRequestRef.current === requestId) {
        onStatus({
          key: 'invoice-history:receipt-load',
          level: 'error',
          message: userSafeErrorMessage(error, 'No se pudo cargar recibo.'),
          toast: false,
        });
      }
    }
  }

  /**
   * Audita una reimpresión legacy con motivo humano. Devuelve el documento
   * REIMPRESIÓN resultante o null si falló (el error ya quedó reportado).
   */
  async function auditReceiptPrint(reason: string): Promise<ReceiptData | null> {
    if (!selectedInvoice || !receipt) return null;

    try {
      const width = institutionalReceiptPaperSize(receipt.width);
      const auditedReceipt = await apiClient.reprintInvoice(selectedInvoice.id, {
        width,
        reason,
      }, {
        idempotencyKey: payloadScopedIdempotencyKey(reprintIdempotencyKeyRef, reprintIdempotencySignatureRef, {
          invoiceId: selectedInvoice.id,
          reason,
          width,
        }),
      });
      resetPayloadScopedIdempotencyKey(reprintIdempotencyKeyRef, reprintIdempotencySignatureRef);
      const normalizedWidth = institutionalReceiptPaperSize(auditedReceipt.width);

      return { ...auditedReceipt, width: normalizedWidth };
    } catch (error) {
      onStatus({
        key: 'invoice-history:receipt-print',
        level: 'error',
        message: userSafeErrorMessage(error, 'No se pudo auditar la reimpresión.'),
        toast: false,
      });

      return null;
    }
  }

  /**
   * Impresión legacy desde la vista previa (T2-035 + T3-004 + C1-RCP-01):
   * - Un documento ya etiquetado REIMPRESIÓN #n fue auditado: se imprime sin
   *   repetir el POST.
   * - Si el contador durable del backend es > 0 (ya hubo reimpresiones auditadas,
   *   incluso en sesiones anteriores), la impresión es una reimpresión: abre el
   *   diálogo de motivo humano y devuelve una promesa que solo resuelve la
   *   confirmación auditada; cancelar la deja pendiente para que ReceiptPreview
   *   no imprima.
   * - Si la vista cree que es la primera impresión (contador 0), NO se confía en
   *   el payload en memoria: otra pestaña pudo auditar una reimpresión después de
   *   abrir el modal. Se relee el recibo del servidor (GET read-only, no muta el
   *   contador) y solo se imprime como primera entrega si el contador durable
   *   sigue en 0. Si el servidor falla, la impresión no ocurre (fail-closed) para
   *   no saltarse el motivo/auditoría de una reimpresión.
   */
  function requestLegacyReprintReason(): Promise<void> {
    setConfirmingReceiptPrint(true);

    return new Promise((resolve) => {
      pendingLegacyPrintResolveRef.current = resolve;
    });
  }

  async function handleLegacyReceiptPrint(): Promise<void> {
    if (!receipt || !selectedInvoice) return;
    if (isAuditedReprintReceipt(receipt)) return;
    if (requiresLegacyReprintReason(receipt)) return requestLegacyReprintReason();

    let freshReceipt: ReceiptData;
    try {
      freshReceipt = await apiClient.getReceipt(
        selectedInvoice.id,
        institutionalReceiptPaperSize(receipt.width),
      );
    } catch (error) {
      onStatus({
        key: 'invoice-history:receipt-print',
        level: 'error',
        message: userSafeErrorMessage(
          error,
          'No se pudo verificar el estado del recibo antes de imprimir. Intente de nuevo.',
        ),
        toast: false,
      });

      throw error;
    }

    const normalizedWidth = institutionalReceiptPaperSize(freshReceipt.width);
    const normalizedReceipt = { ...freshReceipt, width: normalizedWidth };
    setReceiptWidth(normalizedWidth);
    setReceipt(normalizedReceipt);

    if (isAuditedReprintReceipt(normalizedReceipt)) return;
    if (requiresLegacyReprintReason(normalizedReceipt)) return requestLegacyReprintReason();
  }

  function cancelLegacyReceiptPrint() {
    setConfirmingReceiptPrint(false);
    pendingLegacyPrintResolveRef.current = null;
  }

  async function confirmLegacyReceiptPrint(reason: string) {
    if (!selectedInvoice || !receipt || reprintingReceipt) return;

    setReprintingReceipt(true);
    try {
      const audited = await auditReceiptPrint(reason);
      if (!audited) return;

      setReceipt(audited);
      setConfirmingReceiptPrint(false);
      // ReceiptPreview difiere la impresión al siguiente commit: resolver aquí
      // imprime una sola vez con la etiqueta REIMPRESIÓN #n (número durable del
      // backend) ya comprometida.
      const resolvePrint = pendingLegacyPrintResolveRef.current;
      pendingLegacyPrintResolveRef.current = null;
      resolvePrint?.();
      onStatus({
        key: 'invoice-history:receipt-print',
        level: 'success',
        message: `Recibo ${selectedInvoice.invoice_number} enviado a impresión.`,
        toast: false,
      });
    } finally {
      setReprintingReceipt(false);
    }
  }

  async function printInstitutionalReceiptFromPreview() {
    if (!selectedInvoice || !selectedInstitutionalReceipt) return;

    if (hasInstitutionalPrintEvents(selectedInstitutionalReceipt)) {
      setReceiptModalOpen(false);
      requestReprintInvoice(selectedInvoice);
      return;
    }

    setLoadingActionInvoiceId(selectedInvoice.id);
    try {
      const idempotencyKey = payloadScopedIdempotencyKey(
        previewPrintIdempotencyKeyRef,
        previewPrintIdempotencySignatureRef,
        { action: 'history-preview-first-print', receiptId: selectedInstitutionalReceipt.id },
      );
      const blob = await apiClient.getInstitutionalReceiptPdf(selectedInstitutionalReceipt.id);
      await apiClient.registerInstitutionalReceiptPrintEvent(selectedInstitutionalReceipt.id, undefined, { idempotencyKey });
      resetPayloadScopedIdempotencyKey(previewPrintIdempotencyKeyRef, previewPrintIdempotencySignatureRef);
      openBlobInNewTab(blob, institutionalReceiptPdfFilename(selectedInstitutionalReceipt.receipt_number_full));
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      await invalidateBillingQueries(queryClient);
      setSelectedInvoice({
        ...selectedInvoice,
        institutional_receipt: {
          ...selectedInstitutionalReceipt,
          has_print_events: true,
          print_events_count: (selectedInstitutionalReceipt.print_events_count ?? 0) + 1,
        },
      });
      onStatus({
        key: 'invoice-history:receipt-print',
        level: 'success',
        message: `PDF institucional ${selectedInstitutionalReceipt.receipt_number_full} abierto.`,
        toast: false,
      });
    } catch (error) {
      onStatus({
        key: 'invoice-history:receipt-print',
        level: 'error',
        message: userSafeErrorMessage(error, 'No se pudo imprimir el recibo institucional.'),
        toast: false,
      });
    } finally {
      setLoadingActionInvoiceId(null);
    }
  }

  async function generateInstitutionalReceipt(invoiceId: number) {
    if (generatingInstitutionalReceiptRef.current) return;

    setLoadingActionInvoiceId(invoiceId);
    try {
      generatingInstitutionalReceiptRef.current = true;
      const invoiceDetail = await apiClient.getInvoice(invoiceId);
      const selectedPayment = latestPostedPayment(invoiceDetail);
      const receiptPayload = {
        invoice_id: invoiceId,
        ...(selectedPayment ? {
          payment_id: selectedPayment.id,
          cash_session_id: selectedPayment.cash_session_id,
        } : {}),
      };
      const idempotencyKey = payloadScopedIdempotencyKey(
        receiptGenerationIdempotencyKeyRef,
        receiptGenerationIdempotencySignatureRef,
        receiptPayload,
      );
      const receipt = await institutionalReceipts.store(receiptPayload, { idempotencyKey });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      await invalidateBillingQueries(queryClient);

      const invoice = await apiClient.getInvoice(invoiceId);
      setSelectedInvoice(invoice);
      synchronizeDetailInvoice(invoice);
      // Excepción de EMISIÓN, no de reimpresión (T3-012): este POST abre el PDF
      // del recibo recién generado, antes de su primera impresión, así que el
      // backend no exige motivo humano (solo lo valida 5–500 si viene). El texto
      // describe la acción del sistema (generar un recibo faltante); el motivo
      // humano 5–500 aplica a las reimpresiones auditadas.
      await openInstitutionalReceiptPdf(receipt, 'Emisión manual de recibo faltante.', idempotencyKey);
      resetPayloadScopedIdempotencyKey(receiptGenerationIdempotencyKeyRef, receiptGenerationIdempotencySignatureRef);
      onStatus({
        key: 'invoice-history:receipt-generate',
        level: 'success',
        message: `Recibo institucional ${receipt.receipt_number_full} generado exitosamente.`,
        toast: false,
      });
    } catch (error) {
      onStatus({
        key: 'invoice-history:receipt-generate',
        level: 'error',
        message: userSafeErrorMessage(error, 'No se pudo generar el recibo institucional.'),
        toast: false,
      });
    } finally {
      generatingInstitutionalReceiptRef.current = false;
      setLoadingActionInvoiceId(null);
    }
  }

  async function downloadInstitutionalReceipt(invoice: Invoice) {
    const institutionalReceipt = issuedInstitutionalReceipt(invoice);
    if (!institutionalReceipt) return;

    setLoadingActionInvoiceId(invoice.id);
    try {
      const blob = await apiClient.getInstitutionalReceiptPdf(institutionalReceipt.id);
      downloadBlob(blob, institutionalReceiptPdfFilename(institutionalReceipt.receipt_number_full));
      onStatus({
        key: 'invoice-history:receipt-download',
        level: 'success',
        message: `PDF institucional ${institutionalReceipt.receipt_number_full} descargado.`,
        toast: false,
      });
    } catch (error) {
      onStatus({
        key: 'invoice-history:receipt-download',
        level: 'error',
        message: userSafeErrorMessage(error, 'No se pudo descargar el recibo institucional.'),
        toast: false,
      });
    } finally {
      setLoadingActionInvoiceId(null);
    }
  }

  function requestReprintInvoice(invoice: Invoice) {
    if (registeringReprintRef.current) return;

    setSelectedInvoice(invoice);
    setConfirmingReprint(true);
  }

  async function reprintSelectedInvoice(reason: string | null) {
    if (!selectedInvoice || !reason?.trim()) return;

    try {
      setReprintingReceipt(true);
      const completed = await reprintInvoiceFromHistory(selectedInvoice, reason.trim());
      if (completed) {
        setConfirmingReprint(false);
      }
    } finally {
      setReprintingReceipt(false);
    }
  }

  async function reprintInvoiceFromHistory(reprintInvoice: Invoice, reason: string): Promise<boolean> {
    if (registeringReprintRef.current) return false;

    try {
      registeringReprintRef.current = true;
      setLoadingActionInvoiceId(reprintInvoice.id);
      const invoice = await apiClient.getInvoice(reprintInvoice.id);
      setSelectedInvoice(invoice);
      const institutionalReceipt = issuedInstitutionalReceipt(invoice);

      if (institutionalReceipt) {
        const idempotencyKey = payloadScopedIdempotencyKey(reprintIdempotencyKeyRef, reprintIdempotencySignatureRef, {
          reason,
          receiptId: institutionalReceipt.id,
        });
        const blob = await apiClient.getInstitutionalReceiptPdf(institutionalReceipt.id);
        await apiClient.registerInstitutionalReceiptPrintEvent(institutionalReceipt.id, reason, { idempotencyKey });
        openBlobInNewTab(blob, institutionalReceiptPdfFilename(institutionalReceipt.receipt_number_full));
        queryClient.invalidateQueries({ queryKey: ['audit'] });
        onStatus({
          key: 'invoice-history:reprint',
          level: 'success',
          message: `PDF institucional ${institutionalReceipt.receipt_number_full} abierto.`,
          toast: false,
        });
        resetPayloadScopedIdempotencyKey(reprintIdempotencyKeyRef, reprintIdempotencySignatureRef);

        return true;
      }

      const requestedWidth = institutionalReceiptPaperSize(receiptWidth);
      const idempotencyKey = payloadScopedIdempotencyKey(reprintIdempotencyKeyRef, reprintIdempotencySignatureRef, {
        invoiceId: invoice.id,
        reason,
        width: requestedWidth,
      });
      const nextReceipt = await apiClient.reprintInvoice(invoice.id, {
        width: requestedWidth,
        reason,
      }, {
        idempotencyKey,
      });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      const normalizedWidth = institutionalReceiptPaperSize(nextReceipt.width);
      setReceiptWidth(normalizedWidth);
      setReceipt({ ...nextReceipt, width: normalizedWidth });
      setReceiptModalOpen(true);
      resetPayloadScopedIdempotencyKey(reprintIdempotencyKeyRef, reprintIdempotencySignatureRef);
      onStatus({
        key: 'invoice-history:reprint',
        level: 'success',
        message: `Recibo ${invoice.invoice_number} listo para imprimir.`,
        toast: false,
      });

      return true;
    } catch (error) {
      onStatus({
        key: 'invoice-history:reprint',
        level: 'error',
        message: userSafeErrorMessage(error, 'No se pudo reimprimir el recibo.'),
        toast: false,
      });

      return false;
    } finally {
      registeringReprintRef.current = false;
      setLoadingActionInvoiceId(null);
    }
  }

  async function openInstitutionalReceiptPdf(
    receiptToOpen: NonNullable<Invoice['institutional_receipt']>,
    reason?: string,
    idempotencyKey?: string,
  ) {
    const trimmedReason = reason?.trim();
    const blob = trimmedReason
      ? await apiClient.getInstitutionalReceiptPdf(receiptToOpen.id, trimmedReason, idempotencyKey ? { idempotencyKey } : undefined)
      : await apiClient.getInstitutionalReceiptPdf(receiptToOpen.id);

    if (trimmedReason && idempotencyKey) {
      const printIdempotencyKey = payloadScopedIdempotencyKey(
        receiptGenerationPrintIdempotencyKeyRef,
        receiptGenerationPrintIdempotencySignatureRef,
        {
          action: 'generated-receipt-first-print',
          receiptId: receiptToOpen.id,
        },
      );
      await apiClient.registerInstitutionalReceiptPrintEvent(receiptToOpen.id, undefined, {
        idempotencyKey: printIdempotencyKey,
      });
      resetPayloadScopedIdempotencyKey(
        receiptGenerationPrintIdempotencyKeyRef,
        receiptGenerationPrintIdempotencySignatureRef,
      );
    }

    openBlobInNewTab(blob, institutionalReceiptPdfFilename(receiptToOpen.receipt_number_full));
  }

  const selectedInstitutionalReceipt = selectedInvoice
    ? issuedInstitutionalReceipt(selectedInvoice)
    : null;

  return {
    receipt,
    receiptModalOpen,
    setReceiptModalOpen,
    clearReceipt: () => setReceipt(null),
    confirmingReprint,
    setConfirmingReprint,
    confirmingReceiptPrint,
    cancelLegacyReceiptPrint,
    confirmLegacyReceiptPrint,
    handleLegacyReceiptPrint,
    reprintingReceipt,
    loadingActionInvoiceId,
    openReceiptModal,
    printInstitutionalReceiptFromPreview,
    requestReprintInvoice,
    reprintSelectedInvoice,
    generateInstitutionalReceipt,
    downloadInstitutionalReceipt,
    selectedInstitutionalReceipt,
  };
}
