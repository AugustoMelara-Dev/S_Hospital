import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  type AuthUser,
  type Invoice,
  type InvoiceFilters,
  type Payment,
  type PaginatedMeta,
  type ReceiptData,
  apiClient,
  institutionalReceipts,
  userSafeErrorMessage,
} from '../../lib/api';
import { useInvoices } from '../../hooks/useInvoices';
import { FileTextIcon } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ReceiptPreview } from '../receipts/ReceiptPreview';
import { InstitutionalReceiptPreviewFrame } from '../receipts/InstitutionalReceiptPreviewFrame';
import { institutionalReceiptPaperSize } from '../../lib/institutionalReceiptPaper';
import { downloadBlob, institutionalReceiptPdfFilename, openBlobInNewTab } from '../../lib/download';
import { formatLempirasUIFromCents, parseCents } from '../../lib/moneyCents';

import { formatLocalizedDateTime } from '../../lib/format/formatDate';
import { invalidateBillingQueries } from '@/lib/queryInvalidation';
import { payloadScopedIdempotencyKey, resetPayloadScopedIdempotencyKey } from '../../lib/api/idempotency';
import { InvoiceHistoryFilters } from './history/InvoiceHistoryFilters';
import { InvoiceHistoryTable, issuedInstitutionalReceipt } from './history/InvoiceHistoryTable';
import { InvoiceDetailDrawer } from './history/InvoiceDetailDrawer';
import { PageHeader } from '@/design-system/components/PageHeader';
import { PaymentModal } from './components/PaymentModal';
import type { OperationalStatusReporter } from '@/app/operationalStatus';

type InvoiceHistoryViewProps = {
  user: AuthUser;
  onStatus: OperationalStatusReporter;
};

function invoicePatientNameLabel(invoice: Invoice | null) {
  const patientName = invoice?.patient_name?.trim();
  return patientName ? patientName : 'Paciente sin nombre';
}

function latestPostedPayment(invoice: Invoice): NonNullable<Invoice['payments']>[number] | null {
  const postedPayments = invoice.payments?.filter((payment) => payment.status === 'posted') ?? [];

  return postedPayments
    .sort((first, second) => {
      const firstPaidAt = Date.parse(first.paid_at);
      const secondPaidAt = Date.parse(second.paid_at);
      const paidAtComparison = (Number.isNaN(secondPaidAt) ? 0 : secondPaidAt)
        - (Number.isNaN(firstPaidAt) ? 0 : firstPaidAt);

      return paidAtComparison !== 0 ? paidAtComparison : second.id - first.id;
    })[0] ?? null;
}

export function InvoiceHistoryView({ user, onStatus }: InvoiceHistoryViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchFilterKey = searchParams.toString();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<InvoiceFilters>(() => filtersFromSearchParams(searchParams));
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [detailInvoice, setDetailInvoice] = useState<Invoice | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptWidth, setReceiptWidth] = useState<ReceiptData['width']>('half_letter');
  const [voidReason, setVoidReason] = useState('');
  const [reverseReason, setReverseReason] = useState('');
  const [voidReasonError, setVoidReasonError] = useState('');
  const [reverseReasonError, setReverseReasonError] = useState('');
  const [confirmingVoid, setConfirmingVoid] = useState(false);
  const [confirmingReverse, setConfirmingReverse] = useState(false);
  const [confirmingReprint, setConfirmingReprint] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [collectionInvoice, setCollectionInvoice] = useState<Invoice | null>(null);
  const [collectionMethod, setCollectionMethod] = useState<Payment['method']>('cash');
  const [collectionAmount, setCollectionAmount] = useState('');
  const [collectionReference, setCollectionReference] = useState('');
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [collectingPayment, setCollectingPayment] = useState(false);
  const [loadingActionInvoiceId, setLoadingActionInvoiceId] = useState<number | null>(null);
  const [voidingInvoice, setVoidingInvoice] = useState(false);
  const [reversingInvoice, setReversingInvoice] = useState(false);
  const [reprintingReceipt, setReprintingReceipt] = useState(false);
  const voidingInvoiceRef = useRef(false);
  const reversingInvoiceRef = useRef(false);
  const registeringReprintRef = useRef(false);
  const generatingInstitutionalReceiptRef = useRef(false);
  const voidIdempotencyKeyRef = useRef<string | null>(null);
  const voidIdempotencySignatureRef = useRef<string | null>(null);
  const reverseIdempotencyKeyRef = useRef<string | null>(null);
  const reverseIdempotencySignatureRef = useRef<string | null>(null);
  const reprintIdempotencyKeyRef = useRef<string | null>(null);
  const reprintIdempotencySignatureRef = useRef<string | null>(null);
  const previewPrintIdempotencyKeyRef = useRef<string | null>(null);
  const previewPrintIdempotencySignatureRef = useRef<string | null>(null);
  const receiptGenerationIdempotencyKeyRef = useRef<string | null>(null);
  const receiptGenerationIdempotencySignatureRef = useRef<string | null>(null);
  const receiptGenerationPrintIdempotencyKeyRef = useRef<string | null>(null);
  const receiptGenerationPrintIdempotencySignatureRef = useRef<string | null>(null);
  const collectionIdempotencyKeyRef = useRef<string | null>(null);
  const collectionIdempotencySignatureRef = useRef<string | null>(null);
  const actionRequestRef = useRef(0);
  const receiptRequestRef = useRef(0);
  const detailRequestRef = useRef(0);
  const detailRequestedInvoiceIdRef = useRef(0);
  const detailReturnFocusRef = useRef<HTMLElement | null>(null);
  const detailReturnFocusInvoiceIdRef = useRef<number | null>(null);
  const historySectionRef = useRef<HTMLElement | null>(null);

  const canReprint = user.permissions.includes('receipts.reprint');
  const canReprintAny = user.permissions.includes('receipts.reprint_any');
  const canViewReceipt = user.permissions.includes('receipts.view');
  const canIssueInstitutionalReceipt = canViewReceipt && user.permissions.includes('payments.create');
  const canCollectPayment = user.permissions.includes('payments.create');
  const canOperateAnyInvoice = user.permissions.includes('invoices.operate_any');
  const canVoid = user.permissions.includes('invoices.void');
  const canReverse = user.permissions.includes('invoices.reverse');

  // TanStack Query replaces the prior manual useState + useEffect
  // loading. Cross-PC invalidation is handled by useBroadcastSync
  // through the queryClient. staleTime of 30s matches the cashier
  // expectation that the screen stays fresh for the duration of a
  // single filter/refresh action.
  const invoicesQuery = useInvoices(filters);
  const invoicesList: Invoice[] = Array.isArray(invoicesQuery.data?.data)
    ? (invoicesQuery.data!.data as Invoice[])
    : [];
  const meta: PaginatedMeta = invoicesQuery.data?.meta ?? { current_page: 1, per_page: 10, total: 0 };
  const hasCachedInvoices = invoicesQuery.data !== undefined;
  const loading = invoicesQuery.isLoading;
  const loadError = invoicesQuery.isError && !hasCachedInvoices
    ? userSafeErrorMessage(invoicesQuery.error, 'No se pudo cargar historial.')
    : '';
  const refreshError = invoicesQuery.isError && hasCachedInvoices
    ? userSafeErrorMessage(invoicesQuery.error, 'No se pudo actualizar el historial.')
    : '';
  const detailInvoiceId = positiveIntegerFromSearchParam(searchParams.get('invoice'), 0);

  useEffect(() => {
    setFilters(filtersFromSearchParams(new URLSearchParams(searchFilterKey)));
  }, [searchFilterKey]);

  useEffect(() => {
    if (!detailInvoiceId) {
      if (detailRequestedInvoiceIdRef.current !== 0) {
        detailRequestRef.current += 1;
        detailRequestedInvoiceIdRef.current = 0;
        setDetailInvoice(null);
        setDetailError('');
        setDetailLoading(false);
      }
      return;
    }
    if (detailRequestedInvoiceIdRef.current === detailInvoiceId) return;

    const summary = invoicesList.find((invoice) => invoice.id === detailInvoiceId) ?? null;
    void openInvoiceDetail(summary ?? detailInvoiceId, false);
  // The detail loader deliberately reacts only to URL identity and list availability.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, invoicesList]);

  function applyFilters(draftFilters: InvoiceFilters) {
    const nextFilters = { ...draftFilters, page: 1 };
    setFilters(nextFilters);
    setSearchParams(withPreservedDetail(searchParamsFromFilters(nextFilters), searchParams));
    // The query refetches automatically because filters is in the
    // queryKey.
  }

  function clearFilters() {
    const clearedFilters: InvoiceFilters = {
      date_from: '',
      date_to: '',
      status: '',
      patient: '',
      invoice_number: '',
      page: 1,
      per_page: 10,
    };
    setFilters(clearedFilters);
    setSearchParams(withPreservedDetail({}, searchParams));
    // Refetch is automatic via the filters key.
  }

  async function openInvoiceDetail(
    invoice: Invoice | number,
    updateUrl = true,
    returnFocus: HTMLElement | null = null,
  ) {
    const invoiceId = typeof invoice === 'number' ? invoice : invoice.id;
    const previousRequestedInvoiceId = detailRequestedInvoiceIdRef.current;
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
    detailRequestedInvoiceIdRef.current = invoiceId;
    if (updateUrl) detailReturnFocusRef.current = returnFocus;
    if (updateUrl) detailReturnFocusInvoiceIdRef.current = invoiceId;
    else if (previousRequestedInvoiceId !== invoiceId) detailReturnFocusRef.current = null;
    setDetailInvoice(typeof invoice === 'number' ? null : invoice);
    setDetailError('');
    setDetailLoading(true);

    if (updateUrl) {
      const next = new URLSearchParams(searchParams);
      next.set('invoice', String(invoiceId));
      setSearchParams(next);
    }

    try {
      const detail = await apiClient.getInvoice(invoiceId);
      if (detailRequestRef.current === requestId) setDetailInvoice(detail);
    } catch (error) {
      if (detailRequestRef.current === requestId) {
        setDetailError(userSafeErrorMessage(error, 'No se pudo cargar el detalle de la factura.'));
      }
    } finally {
      if (detailRequestRef.current === requestId) setDetailLoading(false);
    }
  }

  function closeInvoiceDetail() {
    detailRequestRef.current += 1;
    setDetailInvoice(null);
    setDetailError('');
    setDetailLoading(false);
    const next = new URLSearchParams(searchParams);
    next.delete('invoice');
    setSearchParams(next);
  }

  function restoreInvoiceDetailFocus() {
    const returnInvoiceId = detailReturnFocusInvoiceIdRef.current;
    const originalFocusTarget = detailReturnFocusRef.current;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const currentTrigger = returnInvoiceId
          ? document.querySelector<HTMLElement>(`[data-invoice-detail-trigger="${returnInvoiceId}"]`)
          : null;
        const focusTarget = currentTrigger
          ?? (originalFocusTarget?.isConnected ? originalFocusTarget : historySectionRef.current);
        focusTarget?.focus();
        detailReturnFocusRef.current = null;
        detailReturnFocusInvoiceIdRef.current = null;
      });
    });
  }

  function synchronizeDetailInvoice(invoice: Invoice) {
    if (detailRequestedInvoiceIdRef.current === invoice.id) {
      setDetailInvoice(invoice);
      setDetailError('');
    }
  }

  async function prepareInvoiceAction(invoiceId: number, action: 'void' | 'reverse') {
    const requestId = actionRequestRef.current + 1;
    actionRequestRef.current = requestId;

    try {
      const invoice = await apiClient.getInvoice(invoiceId);
      if (actionRequestRef.current !== requestId) return;

      setSelectedInvoice(invoice);
      setReceipt(null);
      if (action === 'void') {
        setConfirmingVoid(true);
      } else {
        setConfirmingReverse(true);
      }
      onStatus({
        key: 'invoice-history:detail',
        level: 'info',
        message: `Factura ${invoice.invoice_number} cargada.`,
        toast: false,
      });
    } catch (error) {
      if (actionRequestRef.current === requestId) {
        onStatus({
          key: 'invoice-history:detail',
          level: 'error',
          message: userSafeErrorMessage(error, 'No se pudo cargar detalle.'),
          toast: false,
        });
      }
    }
  }

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

  async function auditReceiptPrint() {
    if (!selectedInvoice || !receipt) {
      return;
    }

    const width = institutionalReceiptPaperSize(receipt.width);
    const reason = 'Impresion desde vista de recibo.';
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
    setReceiptWidth(normalizedWidth);
    setReceipt({ ...auditedReceipt, width: normalizedWidth });
  }

  async function changePage(page: number) {
    const nextFilters = { ...filters, page };
    setFilters(nextFilters);
    setSearchParams(withPreservedDetail(searchParamsFromFilters(nextFilters), searchParams));
    // Refetch is automatic via the filters key.
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

  function openPaymentCollection(invoice: Invoice) {
    setCollectionInvoice(invoice);
    setCollectionMethod('cash');
    setCollectionAmount(invoice.balance_due);
    setCollectionReference('');
    setCollectionError(null);
  }

  async function collectInvoicePayment(appliedAmount: string) {
    if (!collectionInvoice || collectingPayment) return;
    setCollectingPayment(true);
    setCollectionError(null);
    try {
      const cashSession = await apiClient.getCurrentCashSession();
      if (!cashSession || cashSession.status !== 'open') {
        setCollectionError('Abra caja antes de registrar el cobro.');
        return;
      }
      const payload = {
        cash_session_id: cashSession.id,
        method: collectionMethod,
        amount: appliedAmount,
        reference: collectionReference.trim() || null,
      };
      await apiClient.registerPayment(collectionInvoice.id, payload, {
        idempotencyKey: payloadScopedIdempotencyKey(
          collectionIdempotencyKeyRef,
          collectionIdempotencySignatureRef,
          { invoiceId: collectionInvoice.id, payload },
        ),
      });
      resetPayloadScopedIdempotencyKey(collectionIdempotencyKeyRef, collectionIdempotencySignatureRef);
      await invalidateBillingQueries(queryClient);
      onStatus({
        key: 'invoice-history:payment',
        level: 'success',
        message: `Cobro registrado para la factura ${collectionInvoice.invoice_number}.`,
        toast: false,
      });
      setCollectionInvoice(null);
    } catch (error) {
      setCollectionError(userSafeErrorMessage(error, 'No se pudo registrar el pago. Revise los datos e intente de nuevo.'));
    } finally {
      setCollectingPayment(false);
    }
  }

  async function voidSelectedInvoice() {
    if (voidingInvoiceRef.current) return;

    if (!selectedInvoice || voidReason.trim().length < 5) {
      const message = 'Ingrese un motivo de anulación de al menos 5 caracteres.';
      setVoidReasonError(message);
      onStatus({ key: 'invoice-history:void', level: 'warning', message, toast: false });

      return;
    }

    try {
      voidingInvoiceRef.current = true;
      setVoidingInvoice(true);
      setVoidReasonError('');
      const reason = voidReason.trim();
      const voided = await apiClient.voidInvoice(selectedInvoice.id, reason, {
        idempotencyKey: payloadScopedIdempotencyKey(voidIdempotencyKeyRef, voidIdempotencySignatureRef, {
          invoiceId: selectedInvoice.id,
          reason,
        }),
      });
      await invalidateBillingQueries(queryClient);
      setSelectedInvoice(voided);
      synchronizeDetailInvoice(voided);
      setReceipt(null);
      setVoidReason('');
      setConfirmingVoid(false);
      resetPayloadScopedIdempotencyKey(voidIdempotencyKeyRef, voidIdempotencySignatureRef);
      onStatus({
        key: 'invoice-history:void',
        level: 'success',
        message: `Factura ${voided.invoice_number} anulada.`,
        toast: false,
      });
    } catch (error) {
      onStatus({
        key: 'invoice-history:void',
        level: 'error',
        message: userSafeErrorMessage(error, 'No se pudo anular la factura.'),
        toast: false,
      });
    } finally {
      voidingInvoiceRef.current = false;
      setVoidingInvoice(false);
    }
  }

  async function reverseSelectedInvoice() {
    if (reversingInvoiceRef.current) return;

    if (!selectedInvoice || reverseReason.trim().length < 5) {
      const message = 'Ingrese un motivo de reversa de al menos 5 caracteres.';
      setReverseReasonError(message);
      onStatus({ key: 'invoice-history:reverse', level: 'warning', message, toast: false });

      return;
    }

    try {
      reversingInvoiceRef.current = true;
      setReversingInvoice(true);
      setReverseReasonError('');
      const reason = reverseReason.trim();
      const reversed = await apiClient.reverseInvoice(selectedInvoice.id, reason, {
        idempotencyKey: payloadScopedIdempotencyKey(reverseIdempotencyKeyRef, reverseIdempotencySignatureRef, {
          invoiceId: selectedInvoice.id,
          reason,
        }),
      });
      await invalidateBillingQueries(queryClient);
      setSelectedInvoice(reversed);
      synchronizeDetailInvoice(reversed);
      setReceipt(null);
      setReverseReason('');
      setConfirmingReverse(false);
      resetPayloadScopedIdempotencyKey(reverseIdempotencyKeyRef, reverseIdempotencySignatureRef);
      onStatus({
        key: 'invoice-history:reverse',
        level: 'success',
        message: `Factura ${reversed.invoice_number} reversada.`,
        toast: false,
      });
    } catch (error) {
      onStatus({
        key: 'invoice-history:reverse',
        level: 'error',
        message: userSafeErrorMessage(error, 'No se pudo reversar la factura.'),
        toast: false,
      });
    } finally {
      reversingInvoiceRef.current = false;
      setReversingInvoice(false);
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

  function isOwnInvoiceFromToday(invoice: Invoice): boolean {
    const issuedDate = localDateString(new Date(invoice.issued_at));

    return invoice.issuer?.id === user.id && issuedDate === localDateString();
  }

  async function openInstitutionalReceiptPdf(
    receipt: NonNullable<Invoice['institutional_receipt']>,
    reason?: string,
    idempotencyKey?: string,
  ) {
    const trimmedReason = reason?.trim();
    const blob = trimmedReason
      ? await apiClient.getInstitutionalReceiptPdf(receipt.id, trimmedReason, idempotencyKey ? { idempotencyKey } : undefined)
      : await apiClient.getInstitutionalReceiptPdf(receipt.id);

    if (trimmedReason && idempotencyKey) {
      const printIdempotencyKey = payloadScopedIdempotencyKey(
        receiptGenerationPrintIdempotencyKeyRef,
        receiptGenerationPrintIdempotencySignatureRef,
        {
          action: 'generated-receipt-first-print',
          receiptId: receipt.id,
        },
      );
      await apiClient.registerInstitutionalReceiptPrintEvent(receipt.id, undefined, {
        idempotencyKey: printIdempotencyKey,
      });
      resetPayloadScopedIdempotencyKey(
        receiptGenerationPrintIdempotencyKeyRef,
        receiptGenerationPrintIdempotencySignatureRef,
      );
    }

    openBlobInNewTab(blob, institutionalReceiptPdfFilename(receipt.receipt_number_full));
  }

  const hasActiveFilters = !!(
    filters.patient ||
    filters.invoice_number ||
    filters.status ||
    filters.balance_state ||
    filters.receipt_state ||
    filters.date_from ||
    filters.date_to
  );
  const reconciliationCriterion = reconciliationCriterionFromFilters(filters);

  const isEmpty = invoicesList.length === 0;
  const selectedInstitutionalReceipt = selectedInvoice
    ? issuedInstitutionalReceipt(selectedInvoice)
    : null;

  return (
    <section
      ref={historySectionRef}
      id="historial"
      className="flex flex-col gap-5"
      aria-label="Historial de facturas"
      tabIndex={-1}
    >
      <PageHeader
        eyebrow="Facturación"
        title="Historial de facturas"
        description="Consulta, reimpresión y acciones autorizadas sobre facturas emitidas."
        actions={<Badge variant="secondary"><FileTextIcon aria-hidden="true" />{meta.total} facturas</Badge>}
      />
      <InvoiceHistoryFilters
        filters={filters}
        hasActiveFilters={hasActiveFilters}
        loading={loading}
        onApply={applyFilters}
        onClear={clearFilters}
      />

      {reconciliationCriterion ? (
        <Alert>
          <AlertTitle>{reconciliationCriterion.kind === 'pending_balance'
            ? `Facturas pendientes o parciales de la caja #${reconciliationCriterion.cashSessionId}`
            : `Recibos institucionales pendientes de la caja #${reconciliationCriterion.cashSessionId}`}</AlertTitle>
          <AlertDescription>{reconciliationCriterion.kind === 'pending_balance'
            ? 'Incluye facturas asociadas a esta caja y facturas con un pago vigente aplicado en ella.'
            : 'Incluye facturas pagadas de esta caja que todavía no tienen un recibo institucional emitido.'}</AlertDescription>
        </Alert>
      ) : null}

      {loadError ? (
        <Alert variant="destructive"><AlertTitle>No se pudo cargar el historial</AlertTitle><AlertDescription>{loadError}</AlertDescription><AlertAction><Button type="button" variant="outline" onClick={() => void invoicesQuery.refetch()}>Reintentar</Button></AlertAction></Alert>
      ) : null}

      {refreshError ? (
        <Alert><AlertTitle>No se pudo actualizar el historial</AlertTitle><AlertDescription>{refreshError}</AlertDescription><AlertAction><Button type="button" variant="outline" onClick={() => void invoicesQuery.refetch()}>Reintentar</Button></AlertAction></Alert>
      ) : null}

      {isEmpty && !loading && !loadError ? (
        <Empty className="border"><EmptyHeader><EmptyTitle>No hay facturas</EmptyTitle><EmptyDescription>{hasActiveFilters ? 'No se encontraron facturas con los filtros seleccionados.' : 'No hay facturas registradas aún.'}</EmptyDescription></EmptyHeader>{hasActiveFilters ? <EmptyContent><Button type="button" variant="outline" onClick={clearFilters}>Limpiar filtros</Button></EmptyContent> : null}</Empty>
      ) : loading ? (
        <div role="status">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="mt-3 h-48 w-full" />
          <span>Cargando facturas...</span>
        </div>
      ) : !loadError ? (
        <section aria-label="Listado de facturas" className="border border-operational-border">
          <header className="border-b border-border p-4">
            <h2>Facturas filtradas</h2>
            <p>
              Acciones disponibles según permisos, estado de pago y trazabilidad del recibo institucional.
            </p>
          </header>
          <div className="p-0">
            <InvoiceHistoryTable
              canCollectPayment={canCollectPayment}
              canReprint={canReprint}
              canReprintAny={canReprintAny}
              canReverse={canReverse}
              canIssueInstitutionalReceipt={canIssueInstitutionalReceipt}
              canOperateAnyInvoice={canOperateAnyInvoice}
              canViewReceipt={canViewReceipt}
              canVoid={canVoid}
              formatDate={formatDate}
              invoices={invoicesList}
              isOwnInvoiceFromToday={isOwnInvoiceFromToday}
              loadingActionInvoiceId={loadingActionInvoiceId}
              moneyLabel={moneyLabel}
              onGenerateInstitutionalReceipt={(invoiceId) => void generateInstitutionalReceipt(invoiceId)}
              onCollectPayment={openPaymentCollection}
              onDownloadInstitutionalReceipt={(invoice) => void downloadInstitutionalReceipt(invoice)}
              onOpenReceipt={(invoiceId) => void openReceiptModal(invoiceId)}
              onOpenDetail={(invoice, trigger) => void openInvoiceDetail(invoice, true, trigger)}
              onPrepareInvoiceAction={(invoiceId, action) => void prepareInvoiceAction(invoiceId, action)}
              onReprint={requestReprintInvoice}
            />
          </div>
        </section>
      ) : null}

      {!isEmpty && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {meta.total} registro{meta.total !== 1 ? 's' : ''} en total
          </span>
          <InvoicePagination meta={meta} disabled={loading} onChange={(nextPage) => void changePage(nextPage)} />
        </div>
      )}

      <InvoiceDetailDrawer
        error={detailError}
        invoice={detailInvoice}
        loading={detailLoading}
        loadingActionInvoiceId={loadingActionInvoiceId}
        moneyLabel={moneyLabel}
        onDownloadInstitutionalReceipt={(invoice) => void downloadInstitutionalReceipt(invoice)}
        onAfterClose={restoreInvoiceDetailFocus}
        onGenerateInstitutionalReceipt={(invoiceId) => void generateInstitutionalReceipt(invoiceId)}
        onOpenChange={(open) => { if (!open) closeInvoiceDetail(); }}
        onOpenReceipt={(invoiceId) => void openReceiptModal(invoiceId)}
        onPrepareInvoiceAction={(invoiceId, action) => void prepareInvoiceAction(invoiceId, action)}
        onReprint={requestReprintInvoice}
        open={detailInvoiceId > 0}
        permissions={detailInvoice ? {
          canCollectPayment,
          canIssueInstitutionalReceipt,
          canOperateAnyInvoice,
          canReprint,
          canReprintAny,
          canReverse,
          canViewReceipt,
          canVoid,
          isOwnInvoiceFromToday: isOwnInvoiceFromToday(detailInvoice),
        } : null}
      />

      {collectionInvoice ? (
        <PaymentModal
          open
          onOpenChange={(open) => {
            if (!open && !collectingPayment) {
              setCollectionInvoice(null);
              setCollectionError(null);
            }
          }}
          invoiceNumber={collectionInvoice.invoice_number}
          patientName={collectionInvoice.patient_name}
          total={collectionInvoice.total}
          balanceDue={collectionInvoice.balance_due}
          paymentMethod={collectionMethod}
          paymentAmount={collectionAmount}
          paymentReference={collectionReference}
          onPaymentMethodChange={(method) => { setCollectionMethod(method); setCollectionError(null); }}
          onPaymentAmountChange={(amount) => { setCollectionAmount(amount); setCollectionError(null); }}
          onPaymentReferenceChange={(reference) => { setCollectionReference(reference); setCollectionError(null); }}
          onConfirm={(amount) => void collectInvoicePayment(amount)}
          submitting={collectingPayment}
          errorMessage={collectionError}
        />
      ) : null}

      <Dialog open={receiptModalOpen} onOpenChange={setReceiptModalOpen}>
        <DialogContent className="max-h-screen overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{`Comprobante de factura - ${selectedInvoice?.invoice_number ?? ''}`}</DialogTitle>
          <DialogDescription>Recibo disponible para esta factura. Usa el perfil de papel configurado.</DialogDescription>
        </DialogHeader>
        {selectedInstitutionalReceipt ? (
          <InstitutionalReceiptPreviewFrame
            receiptId={selectedInstitutionalReceipt.id}
            receiptNumber={selectedInstitutionalReceipt.receipt_number_full}
          />
        ) : receipt && selectedInvoice ? (
          <div className="space-y-4">
            <ReceiptPreview
              receipt={receipt}
              onPrint={async () => {
                try {
                  await auditReceiptPrint();
                  onStatus({
                    key: 'invoice-history:receipt-print',
                    level: 'success',
                    message: `Recibo ${selectedInvoice.invoice_number} enviado a impresión.`,
                    toast: false,
                  });
                } catch (error) {
                  onStatus({
                    key: 'invoice-history:receipt-print',
                    level: 'error',
                    message: userSafeErrorMessage(error, 'No se pudo auditar la reimpresión.'),
                    toast: false,
                  });
                  throw error;
                }
              }}
            />
          </div>
        ) : null}
        {selectedInstitutionalReceipt ? <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setReceiptModalOpen(false)}>Cerrar</Button>
          <Button type="button" variant="outline" disabled={loadingActionInvoiceId === selectedInvoice?.id} onClick={() => selectedInvoice && void downloadInstitutionalReceipt(selectedInvoice)}>Guardar PDF</Button>
          <Button type="button" disabled={loadingActionInvoiceId === selectedInvoice?.id} onClick={() => void printInstitutionalReceiptFromPreview()}>{hasInstitutionalPrintEvents(selectedInstitutionalReceipt) ? 'Reimprimir' : 'Imprimir recibo'}</Button>
        </DialogFooter> : null}
        </DialogContent>
      </Dialog>

      <LocalConfirmDialog
          confirmLabel={reprintingReceipt ? 'Reimprimiendo...' : 'Reimprimir'}
          onCancel={() => setConfirmingReprint(false)}
          cancelDisabled={reprintingReceipt}
          confirmDisabled={reprintingReceipt}
          onConfirm={(reason) => void reprintSelectedInvoice(reason ?? '')}
          open={confirmingReprint}
          requireReasonTextarea
          requireReasonMinLength={5}
          reasonHelpText="Explique por que se entrega otra copia. Quedara registrado en auditoria."
          title={`Reimprimir ${selectedInvoice?.invoice_number ?? ''}`}
        >
          <div className="flex flex-col gap-2 text-sm">
            <p>
              <strong>Paciente:</strong> {invoicePatientNameLabel(selectedInvoice)}
            </p>
            <p>El motivo quedara asociado a la auditoria de impresion.</p>
          </div>
      </LocalConfirmDialog>

      <LocalConfirmDialog
          confirmLabel={voidingInvoice ? 'Anulando...' : 'Anular Factura'}
          danger
          onCancel={() => {
            setConfirmingVoid(false);
            setVoidReason('');
            setVoidReasonError('');
          }}
          cancelDisabled={voidingInvoice}
          confirmDisabled={voidingInvoice || voidReason.trim().length < 5}
          onConfirm={() => void voidSelectedInvoice()}
          open={confirmingVoid}
          title={`¿Anular factura ${selectedInvoice?.invoice_number}?`}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              <strong>Paciente:</strong> {invoicePatientNameLabel(selectedInvoice)}
            </p>
            <div className="space-y-2">
              <label htmlFor="voidReason" className="block text-sm font-semibold text-foreground">Motivo de anulación *</label>
              <Textarea
                id="voidReason"
                aria-describedby={voidReasonError ? 'voidReason-help voidReason-error' : 'voidReason-help'}
                aria-invalid={Boolean(voidReasonError)}
                aria-label="Motivo de anulación"
                value={voidReason}
                disabled={voidingInvoice}
                onChange={(e) => {
                  setVoidReason(e.target.value);
                  if (voidReasonError && e.target.value.trim().length >= 5) {
                    setVoidReasonError('');
                  }
                }}
                placeholder="Explique el motivo de la anulación (mínimo 5 caracteres)..."
                rows={3}
              />
              <p id="voidReason-help" className="text-xs text-muted-foreground">
                Esta acción no se puede deshacer. La factura será marcada como anulada.
              </p>
              {voidReasonError ? (
                <p id="voidReason-error" role="alert" className="text-xs font-medium text-destructive">
                  {voidReasonError}
                </p>
              ) : null}
            </div>
          </div>
      </LocalConfirmDialog>

      <LocalConfirmDialog
          confirmLabel={reversingInvoice ? 'Reversando...' : 'Reversar Factura'}
          danger
          onCancel={() => {
            setConfirmingReverse(false);
            setReverseReason('');
            setReverseReasonError('');
          }}
          cancelDisabled={reversingInvoice}
          confirmDisabled={reversingInvoice || reverseReason.trim().length < 5}
          onConfirm={() => void reverseSelectedInvoice()}
          open={confirmingReverse}
          title={`¿Reversar factura ${selectedInvoice?.invoice_number}?`}
        >
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              <strong>Paciente:</strong> {invoicePatientNameLabel(selectedInvoice)}
            </p>
            <div className="space-y-2">
              <label htmlFor="reverseReason" className="block text-sm font-semibold text-foreground">Motivo de reversa *</label>
              <Textarea
                id="reverseReason"
                aria-describedby={reverseReasonError ? 'reverseReason-help reverseReason-error' : 'reverseReason-help'}
                aria-invalid={Boolean(reverseReasonError)}
                aria-label="Motivo de reversa"
                value={reverseReason}
                disabled={reversingInvoice}
                onChange={(e) => {
                  setReverseReason(e.target.value);
                  if (reverseReasonError && e.target.value.trim().length >= 5) {
                    setReverseReasonError('');
                  }
                }}
                placeholder="Explique por qué se reversan los pagos y la factura..."
                rows={3}
              />
              <p id="reverseReason-help" className="text-xs text-muted-foreground">
                Reversa los pagos registrados, crea movimientos compensatorios y deja auditoría. Motivo mínimo 5 caracteres.
              </p>
              {reverseReasonError ? (
                <p id="reverseReason-error" role="alert" className="text-xs font-medium text-destructive">
                  {reverseReasonError}
                </p>
              ) : null}
            </div>
          </div>
      </LocalConfirmDialog>

    </section>
  );
}

function InvoicePagination({ disabled, meta, onChange }: { disabled: boolean; meta: PaginatedMeta; onChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(meta.total / meta.per_page));
  const pages = Array.from(new Set([1, meta.current_page - 1, meta.current_page, meta.current_page + 1, totalPages]))
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((first, second) => first - second);
  const goTo = (event: MouseEvent<HTMLAnchorElement>, page: number) => {
    event.preventDefault();
    if (!disabled && page !== meta.current_page && page >= 1 && page <= totalPages) onChange(page);
  };

  return (
    <Pagination aria-label="Paginación de facturas" className="mx-0 w-auto">
      <PaginationContent>
        <PaginationItem><PaginationPrevious href="#" text="Anterior" aria-label="Página anterior" aria-disabled={disabled || meta.current_page === 1} tabIndex={disabled || meta.current_page === 1 ? -1 : undefined} onClick={(event) => goTo(event, meta.current_page - 1)} /></PaginationItem>
        {pages.map((page) => <PaginationItem key={page}><PaginationLink href="#" aria-label={`Página ${page}`} isActive={page === meta.current_page} aria-disabled={disabled} tabIndex={disabled ? -1 : undefined} onClick={(event) => goTo(event, page)}>{page}</PaginationLink></PaginationItem>)}
        <PaginationItem><PaginationNext href="#" text="Siguiente" aria-label="Página siguiente" aria-disabled={disabled || meta.current_page === totalPages} tabIndex={disabled || meta.current_page === totalPages ? -1 : undefined} onClick={(event) => goTo(event, meta.current_page + 1)} /></PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function LocalConfirmDialog({
  open,
  title,
  confirmLabel,
  cancelLabel = 'Cancelar',
  onCancel,
  onConfirm,
  children,
  confirmDisabled,
  cancelDisabled,
  danger,
  requireReasonTextarea,
  requireReasonMinLength = 0,
  reasonHelpText,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  cancelLabel?: string;
  onCancel: () => void;
  onConfirm: (reason?: string) => void;
  children: ReactNode;
  confirmDisabled?: boolean;
  cancelDisabled?: boolean;
  danger?: boolean;
  requireReasonTextarea?: boolean;
  requireReasonMinLength?: number;
  reasonHelpText?: string;
}) {
  const [reason, setReason] = useState('');
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(open);
  useEffect(() => {
    if (open) {
      setReason('');
    }
  }, [open]);
  useEffect(() => {
    if (!wasOpenRef.current && open) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    if (wasOpenRef.current && !open) {
      window.setTimeout(() => previousFocusRef.current?.focus(), 0);
    }
    wasOpenRef.current = open;
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !cancelDisabled) onCancel(); }}>
      <DialogContent showCloseButton={!cancelDisabled}>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription className="sr-only">Confirmación de una acción sobre la factura seleccionada.</DialogDescription></DialogHeader>
      <div className="space-y-4 py-4">
        {children}
        {requireReasonTextarea ? (
          <div className="space-y-2">
            <label htmlFor="confirm-reason" className="block text-sm font-semibold text-foreground">
              Motivo *
            </label>
            <Textarea
              id="confirm-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Explique el motivo (mínimo 5 caracteres)..."
              rows={3}
            />
            {reasonHelpText ? (
              <p className="text-xs text-muted-foreground">{reasonHelpText}</p>
            ) : null}
          </div>
        ) : null}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={cancelDisabled} onClick={onCancel}>{cancelLabel}</Button>
        <Button type="button" variant={danger ? 'destructive' : 'default'} disabled={confirmDisabled || (requireReasonTextarea && reason.trim().length < requireReasonMinLength)} onClick={() => onConfirm(reason)}>{confirmLabel}</Button>
      </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function hasInstitutionalPrintEvents(receipt: NonNullable<Invoice['institutional_receipt']>): boolean {
  return receipt.has_print_events === true || (receipt.print_events_count ?? 0) > 0;
}

function formatDate(value: string): string {
  const formatted = formatLocalizedDateTime(value);

  return formatted === '-' ? 'Fecha no disponible' : formatted;
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasUIFromCents(parseCents(value));
}

export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function filtersFromSearchParams(searchParams: URLSearchParams): InvoiceFilters {
  const reconciliationCashSessionId = positiveIntegerFromSearchParam(
    searchParams.get('reconciliation_cash_session_id'),
    0,
  );
  const hasPendingBalanceCriterion = reconciliationCashSessionId > 0
    && searchParams.get('balance_state') === 'pending';
  const hasMissingReceiptCriterion = !hasPendingBalanceCriterion
    && reconciliationCashSessionId > 0
    && searchParams.get('receipt_state') === 'missing';
  const hasReconciliationCriterion = hasPendingBalanceCriterion || hasMissingReceiptCriterion;

  return {
    date_from: searchParams.get('date_from') ?? '',
    date_to: searchParams.get('date_to') ?? '',
    status: (searchParams.get('status') ?? '') as InvoiceFilters['status'],
    balance_state: hasPendingBalanceCriterion ? 'pending' : '',
    receipt_state: hasMissingReceiptCriterion ? 'missing' : '',
    reconciliation_cash_session_id: hasReconciliationCriterion
      ? String(reconciliationCashSessionId)
      : undefined,
    patient: searchParams.get('q') ?? searchParams.get('patient') ?? '',
    invoice_number: searchParams.get('invoice_number') ?? '',
    page: positiveIntegerFromSearchParam(searchParams.get('page'), 1),
    per_page: positiveIntegerFromSearchParam(searchParams.get('per_page'), 10),
  };
}

function positiveIntegerFromSearchParam(value: string | null, fallback: number): number {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function searchParamsFromFilters(filters: InvoiceFilters): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.date_from) {
    params.date_from = filters.date_from;
  }
  if (filters.date_to) {
    params.date_to = filters.date_to;
  }
  if (filters.status) params.status = filters.status;
  if (filters.reconciliation_cash_session_id && filters.balance_state === 'pending') {
    params.balance_state = filters.balance_state;
    params.reconciliation_cash_session_id = filters.reconciliation_cash_session_id;
  } else if (filters.reconciliation_cash_session_id && filters.receipt_state === 'missing') {
    params.receipt_state = filters.receipt_state;
    params.reconciliation_cash_session_id = filters.reconciliation_cash_session_id;
  }
  if (filters.patient) params.q = filters.patient;
  if (filters.invoice_number) params.invoice_number = filters.invoice_number;
  if (filters.page && filters.page > 1) params.page = String(filters.page);
  if (filters.per_page && filters.per_page !== 10) params.per_page = String(filters.per_page);

  return params;
}

type ReconciliationCriterion = {
  kind: 'pending_balance' | 'missing_receipt';
  cashSessionId: string;
};

function reconciliationCriterionFromFilters(filters: InvoiceFilters): ReconciliationCriterion | null {
  const cashSessionId = filters.reconciliation_cash_session_id?.trim();

  if (!cashSessionId) return null;
  if (filters.balance_state === 'pending') return { kind: 'pending_balance', cashSessionId };
  if (filters.receipt_state === 'missing') return { kind: 'missing_receipt', cashSessionId };

  return null;
}

function withPreservedDetail(
  filters: Record<string, string>,
  currentSearchParams: URLSearchParams,
): Record<string, string> {
  const invoice = currentSearchParams.get('invoice');
  return invoice ? { ...filters, invoice } : filters;
}
