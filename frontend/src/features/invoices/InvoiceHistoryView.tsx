import { type FormEvent, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  type AuthUser,
  type Invoice,
  type InvoiceFilters,
  type PaginatedMeta,
  type ReceiptData,
  apiClient,
  institutionalReceipts,
  userSafeErrorMessage,
} from '../../lib/api';
import { useInvoices } from '../../hooks/useInvoices';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Dialog } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { PaginationControls } from '../../components/ui/pagination';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { ReceiptPreview } from '../receipts/ReceiptPreview';
import { Textarea } from '../../components/ui/textarea';
import { institutionalReceiptPaperSize } from '../../lib/institutionalReceiptPaper';
import { downloadBlob, institutionalReceiptPdfFilename, openBlobInNewTab } from '../../lib/download';
import { formatLempirasUIFromCents, parseCents } from '../../lib/moneyCents';
import { formatLocalizedDateTime } from '../../lib/format/formatDate';
import { invalidateBillingQueries } from '@/lib/queryInvalidation';
import { payloadScopedIdempotencyKey, resetPayloadScopedIdempotencyKey } from '../../lib/api/idempotency';
import { InvoiceHistoryFilters } from './history/InvoiceHistoryFilters';
import { InvoiceHistoryHeader } from './history/InvoiceHistoryHeader';
import { InvoiceHistoryTable, issuedInstitutionalReceipt } from './history/InvoiceHistoryTable';
import { InvoiceDetailSheet } from './history/InvoiceDetailSheet';

type InvoiceHistoryViewProps = {
  user: AuthUser;
  onStatus: (message: string) => void;
};

const today = localDateString();

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
  const downloadReceiptIdempotencyKeyRef = useRef<string | null>(null);
  const downloadReceiptIdempotencySignatureRef = useRef<string | null>(null);
  const receiptGenerationIdempotencyKeyRef = useRef<string | null>(null);
  const receiptGenerationIdempotencySignatureRef = useRef<string | null>(null);
  const receiptGenerationPrintIdempotencyKeyRef = useRef<string | null>(null);
  const receiptGenerationPrintIdempotencySignatureRef = useRef<string | null>(null);
  const actionRequestRef = useRef(0);
  const receiptRequestRef = useRef(0);
  const detailRequestRef = useRef(0);

  const canReprint = user.permissions.includes('receipts.reprint');
  const canReprintAny = user.permissions.includes('receipts.reprint_any');
  const canViewReceipt = user.permissions.includes('receipts.view');
  const canIssueInstitutionalReceipt = canViewReceipt && user.permissions.includes('payments.create');
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
  const loading = invoicesQuery.isFetching;
  const loadError = invoicesQuery.isError
    ? userSafeErrorMessage(invoicesQuery.error, 'No se pudo cargar historial.')
    : '';
  const detailInvoiceId = positiveIntegerFromSearchParam(searchParams.get('invoice'), 0);

  useEffect(() => {
    setFilters(filtersFromSearchParams(searchParams));
  }, [searchParams]);

  useEffect(() => {
    if (!detailInvoiceId || detailInvoice?.id === detailInvoiceId || detailLoading) return;

    const summary = invoicesList.find((invoice) => invoice.id === detailInvoiceId) ?? null;
    void openInvoiceDetail(summary ?? detailInvoiceId, false);
  // The detail loader deliberately reacts only to URL identity and list availability.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, invoicesList]);

  function changeFilters(nextFilters: InvoiceFilters) {
    setFilters(nextFilters);
    setSearchParams(withPreservedDetail(searchParamsFromFilters(nextFilters), searchParams));
  }

  async function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFilters = { ...filters, page: 1 };
    setFilters(nextFilters);
    setSearchParams(searchParamsFromFilters(nextFilters));
    // The query refetches automatically because filters is in the
    // queryKey.
  }

  function clearFilters() {
    const clearedFilters: InvoiceFilters = {
      date_from: today,
      date_to: today,
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

  async function openInvoiceDetail(invoice: Invoice | number, updateUrl = true) {
    const invoiceId = typeof invoice === 'number' ? invoice : invoice.id;
    const requestId = detailRequestRef.current + 1;
    detailRequestRef.current = requestId;
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
      onStatus(`Factura ${invoice.invoice_number} cargada.`);
    } catch (error) {
      if (actionRequestRef.current === requestId) {
        onStatus(userSafeErrorMessage(error, 'No se pudo cargar detalle.'));
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
        if (hasInstitutionalPrintEvents(institutionalReceipt)) {
          requestReprintInvoice(invoice);

          return;
        }

        const idempotencyKey = payloadScopedIdempotencyKey(reprintIdempotencyKeyRef, reprintIdempotencySignatureRef, {
          action: 'first-print-from-history',
          receiptId: institutionalReceipt.id,
        });
        await apiClient.registerInstitutionalReceiptPrintEvent(institutionalReceipt.id, undefined, { idempotencyKey });
        await openInstitutionalReceiptPdf(institutionalReceipt);
        resetPayloadScopedIdempotencyKey(reprintIdempotencyKeyRef, reprintIdempotencySignatureRef);
        queryClient.invalidateQueries({ queryKey: ['audit'] });
        onStatus(`PDF institucional ${institutionalReceipt.receipt_number_full} abierto.`);

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
        onStatus(userSafeErrorMessage(error, 'No se pudo cargar recibo.'));
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
    setSearchParams(searchParamsFromFilters(nextFilters));
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
      await openInstitutionalReceiptPdf(receipt, 'Emisión manual de recibo faltante.', idempotencyKey);
      resetPayloadScopedIdempotencyKey(receiptGenerationIdempotencyKeyRef, receiptGenerationIdempotencySignatureRef);
      onStatus(`Recibo institucional ${receipt.receipt_number_full} generado exitosamente.`);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo generar el recibo institucional.'));
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
      const idempotencyKey = payloadScopedIdempotencyKey(
        downloadReceiptIdempotencyKeyRef,
        downloadReceiptIdempotencySignatureRef,
        {
          action: 'first-download-from-history',
          receiptId: institutionalReceipt.id,
        },
      );
      await apiClient.registerInstitutionalReceiptPrintEvent(institutionalReceipt.id, undefined, { idempotencyKey });
      const blob = await apiClient.getInstitutionalReceiptPdf(institutionalReceipt.id);
      downloadBlob(blob, institutionalReceiptPdfFilename(institutionalReceipt.receipt_number_full));
      resetPayloadScopedIdempotencyKey(
        downloadReceiptIdempotencyKeyRef,
        downloadReceiptIdempotencySignatureRef,
      );
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      await invalidateBillingQueries(queryClient);
      onStatus(`PDF institucional ${institutionalReceipt.receipt_number_full} descargado.`);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo descargar el recibo institucional.'));
    } finally {
      setLoadingActionInvoiceId(null);
    }
  }

  async function voidSelectedInvoice() {
    if (voidingInvoiceRef.current) return;

    if (!selectedInvoice || voidReason.trim().length < 5) {
      const message = 'Ingrese un motivo de anulación de al menos 5 caracteres.';
      setVoidReasonError(message);
      onStatus(message);

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
      setReceipt(null);
      setVoidReason('');
      setConfirmingVoid(false);
      resetPayloadScopedIdempotencyKey(voidIdempotencyKeyRef, voidIdempotencySignatureRef);
      onStatus(`Factura ${voided.invoice_number} anulada.`);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo anular la factura.'));
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
      onStatus(message);

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
      setReceipt(null);
      setReverseReason('');
      setConfirmingReverse(false);
      resetPayloadScopedIdempotencyKey(reverseIdempotencyKeyRef, reverseIdempotencySignatureRef);
      onStatus(`Factura ${reversed.invoice_number} reversada.`);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo reversar la factura.'));
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
        await apiClient.registerInstitutionalReceiptPrintEvent(institutionalReceipt.id, reason, { idempotencyKey });
        await openInstitutionalReceiptPdf(institutionalReceipt);
        queryClient.invalidateQueries({ queryKey: ['audit'] });
        onStatus(`PDF institucional ${institutionalReceipt.receipt_number_full} abierto.`);
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
      onStatus(`Recibo ${invoice.invoice_number} listo para imprimir.`);

      return true;
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo reimprimir el recibo.'));

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
    (filters.date_from && filters.date_from !== today) ||
    (filters.date_to && filters.date_to !== today)
  );

  const isEmpty = invoicesList.length === 0;

  return (
    <section id="historial" className="flex flex-col gap-5" aria-label="Historial de facturas">
      <InvoiceHistoryHeader loading={loading} meta={meta} />
      <InvoiceHistoryFilters
        filters={filters}
        hasActiveFilters={hasActiveFilters}
        loading={loading}
        onChange={changeFilters}
        onClear={clearFilters}
        onSubmit={(event) => void submitFilters(event)}
      />

      {loadError ? (
        <ErrorState
          title="No se pudo cargar el historial"
          description={loadError}
          action={(
            <Button type="button" variant="secondary" onClick={() => void invoicesQuery.refetch()}>
              Reintentar
            </Button>
          )}
        />
      ) : null}

      {isEmpty && !loading && !loadError ? (
        <EmptyState
          title="No hay facturas"
          description={hasActiveFilters
            ? 'No se encontraron facturas con los filtros seleccionados.'
            : 'No hay facturas registradas aún.'}
          action={hasActiveFilters ? (
            <Button type="button" variant="outline" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          ) : undefined}
        />
      ) : loading ? (
        <LoadingState label="Cargando facturas..." />
      ) : !loadError ? (
        <Card className="border-operational-border">
          <CardHeader className="gap-1 border-b border-border">
            <CardTitle>Facturas filtradas</CardTitle>
            <CardDescription>
              Acciones disponibles según permisos, estado de pago y trazabilidad del recibo institucional.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <InvoiceHistoryTable
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
              onDownloadInstitutionalReceipt={(invoice) => void downloadInstitutionalReceipt(invoice)}
              onOpenReceipt={(invoiceId) => void openReceiptModal(invoiceId)}
              onOpenDetail={(invoice) => void openInvoiceDetail(invoice)}
              onPrepareInvoiceAction={(invoiceId, action) => void prepareInvoiceAction(invoiceId, action)}
              onReprint={requestReprintInvoice}
            />
          </CardContent>
        </Card>
      ) : null}

      {!isEmpty && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {meta.total} registro{meta.total !== 1 ? 's' : ''} en total
          </span>
          <PaginationControls
            meta={meta}
            loading={loading}
            onPageChange={(nextPage) => void changePage(nextPage)}
          />
        </div>
      )}

      <InvoiceDetailSheet
        error={detailError}
        invoice={detailInvoice}
        loading={detailLoading}
        loadingActionInvoiceId={loadingActionInvoiceId}
        moneyLabel={moneyLabel}
        onDownloadInstitutionalReceipt={(invoice) => void downloadInstitutionalReceipt(invoice)}
        onGenerateInstitutionalReceipt={(invoiceId) => void generateInstitutionalReceipt(invoiceId)}
        onOpenChange={(open) => { if (!open) closeInvoiceDetail(); }}
        onOpenReceipt={(invoiceId) => void openReceiptModal(invoiceId)}
        onPrepareInvoiceAction={(invoiceId, action) => void prepareInvoiceAction(invoiceId, action)}
        onReprint={requestReprintInvoice}
        open={detailInvoiceId > 0}
        permissions={detailInvoice ? {
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

      <Dialog
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        title={`Comprobante de factura - ${selectedInvoice?.invoice_number ?? ''}`}
        description="Recibo disponible para esta factura. Usa el perfil de papel configurado."
      >
        {receipt && selectedInvoice && (
          <div className="space-y-4">
            <ReceiptPreview
              receipt={receipt}
              onPrint={async () => {
                try {
                  await auditReceiptPrint();
                  onStatus(`Recibo ${selectedInvoice.invoice_number} enviado a impresión.`);
                } catch (error) {
                  onStatus(userSafeErrorMessage(error, 'No se pudo auditar la reimpresión.'));
                  throw error;
                }
              }}
            />
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        confirmLabel={reprintingReceipt ? 'Reimprimiendo...' : 'Reimprimir'}
        onCancel={() => setConfirmingReprint(false)}
        cancelDisabled={reprintingReceipt}
        confirmDisabled={reprintingReceipt}
        onConfirm={(reason) => void reprintSelectedInvoice(reason)}
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
      </ConfirmDialog>

      <ConfirmDialog
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
            <Label htmlFor="voidReason">Motivo de anulación *</Label>
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
      </ConfirmDialog>

      <ConfirmDialog
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
            <Label htmlFor="reverseReason">Motivo de reversa *</Label>
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
      </ConfirmDialog>

    </section>
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
  return {
    date_from: searchParams.get('date_from') || today,
    date_to: searchParams.get('date_to') || today,
    status: (searchParams.get('status') ?? '') as InvoiceFilters['status'],
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

  if (filters.date_from && filters.date_from !== today) params.date_from = filters.date_from;
  if (filters.date_to && filters.date_to !== today) params.date_to = filters.date_to;
  if (filters.status) params.status = filters.status;
  if (filters.patient) params.q = filters.patient;
  if (filters.invoice_number) params.invoice_number = filters.invoice_number;
  if (filters.page && filters.page > 1) params.page = String(filters.page);
  if (filters.per_page && filters.per_page !== 10) params.per_page = String(filters.per_page);

  return params;
}

function withPreservedDetail(
  filters: Record<string, string>,
  currentSearchParams: URLSearchParams,
): Record<string, string> {
  const invoice = currentSearchParams.get('invoice');
  return invoice ? { ...filters, invoice } : filters;
}
