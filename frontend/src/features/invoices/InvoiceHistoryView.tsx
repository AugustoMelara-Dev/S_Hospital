import { type FormEvent, useRef, useState } from 'react';
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
import { NativeSelect } from '../../components/ui/select';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/states';
import { ReceiptPreview } from '../receipts/ReceiptPreview';
import { Textarea } from '../../components/ui/textarea';
import { INSTITUTIONAL_RECEIPT_PAPER_OPTIONS, institutionalReceiptPaperSize } from '../../lib/institutionalReceiptPaper';
import { openBlobInNewTab } from '../../lib/download';
import { formatLempirasUIFromCents, parseCents } from '../../lib/moneyCents';
import { formatLocalizedDateTime } from '../../lib/format/formatDate';
import { invalidateBillingQueries } from '@/lib/queryInvalidation';
import { InvoiceHistoryFilters } from './history/InvoiceHistoryFilters';
import { InvoiceHistoryHeader } from './history/InvoiceHistoryHeader';
import { InvoiceHistoryTable, issuedInstitutionalReceipt } from './history/InvoiceHistoryTable';

type InvoiceHistoryViewProps = {
  user: AuthUser;
  onStatus: (message: string) => void;
};

const today = localDateString();

export function InvoiceHistoryView({ user, onStatus }: InvoiceHistoryViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<InvoiceFilters>(() => filtersFromSearchParams(searchParams));
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptWidth, setReceiptWidth] = useState<ReceiptData['width']>('half_letter');
  const [voidReason, setVoidReason] = useState('');
  const [reverseReason, setReverseReason] = useState('');
  const [reprintReason, setReprintReason] = useState('');
  const [voidReasonError, setVoidReasonError] = useState('');
  const [reverseReasonError, setReverseReasonError] = useState('');
  const [reprintReasonError, setReprintReasonError] = useState('');
  const [confirmingVoid, setConfirmingVoid] = useState(false);
  const [confirmingReverse, setConfirmingReverse] = useState(false);
  const [reprintTarget, setReprintTarget] = useState<Invoice | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [loadingActionInvoiceId, setLoadingActionInvoiceId] = useState<number | null>(null);
  const [voidingInvoice, setVoidingInvoice] = useState(false);
  const [reversingInvoice, setReversingInvoice] = useState(false);
  const [registeringReprint, setRegisteringReprint] = useState(false);
  const voidingInvoiceRef = useRef(false);
  const reversingInvoiceRef = useRef(false);
  const registeringReprintRef = useRef(false);
  const generatingInstitutionalReceiptRef = useRef(false);
  const actionRequestRef = useRef(0);

  const canReprint = user.permissions.includes('receipts.reprint');
  const canReprintAny = user.permissions.includes('receipts.reprint_any');
  const canViewReceipt = user.permissions.includes('receipts.view');
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
    setSearchParams({});
    // Refetch is automatic via the filters key.
  }

  async function prepareInvoiceAction(invoiceId: number, action: 'void' | 'reverse') {
    const requestId = actionRequestRef.current + 1;
    actionRequestRef.current = requestId;
    setLoadingActionInvoiceId(invoiceId);

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
    } finally {
      if (actionRequestRef.current === requestId) {
        setLoadingActionInvoiceId(null);
      }
    }
  }

  async function openReceiptModal(invoiceId: number) {
    setReceipt(null);

    try {
      const invoice = await apiClient.getInvoice(invoiceId);
      setSelectedInvoice(invoice);
      const institutionalReceipt = issuedInstitutionalReceipt(invoice);
      if (institutionalReceipt) {
        if (hasInstitutionalPrintEvents(institutionalReceipt)) {
          setReprintTarget(invoice);
          setReprintReason('');
          onStatus('Ingrese un motivo de reimpresión para abrir nuevamente el PDF institucional.');

          return;
        }

        await openInstitutionalReceiptPdf(institutionalReceipt);
        onStatus(`PDF institucional ${institutionalReceipt.receipt_number_full} abierto.`);

        return;
      }

      const requestedWidth = institutionalReceiptPaperSize(receiptWidth);
      const receiptData = await apiClient.getReceipt(invoiceId, requestedWidth);
      const normalizedWidth = institutionalReceiptPaperSize(receiptData.width);
      setReceiptWidth(normalizedWidth);
      setReceipt({ ...receiptData, width: normalizedWidth });
      setReceiptModalOpen(true);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo cargar recibo.'));
    }
  }

  async function auditReceiptPrint() {
    if (!selectedInvoice || !receipt) {
      return;
    }

    const auditedReceipt = await apiClient.reprintInvoice(selectedInvoice.id, {
      width: institutionalReceiptPaperSize(receipt.width),
      reason: 'Impresión desde vista de recibo.',
    });
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
      const receipt = await institutionalReceipts.store({ invoice_id: invoiceId });
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      await invalidateBillingQueries(queryClient);

      const invoice = await apiClient.getInvoice(invoiceId);
      setSelectedInvoice(invoice);
      await openInstitutionalReceiptPdf(receipt, 'Emisión manual de recibo faltante.');
      onStatus(`Recibo institucional ${receipt.receipt_number_full} generado exitosamente.`);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo generar el recibo institucional.'));
    } finally {
      generatingInstitutionalReceiptRef.current = false;
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
      const voided = await apiClient.voidInvoice(selectedInvoice.id, voidReason.trim());
      await invalidateBillingQueries(queryClient);
      setSelectedInvoice(voided);
      setReceipt(null);
      setVoidReason('');
      setConfirmingVoid(false);
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
      const reversed = await apiClient.reverseInvoice(selectedInvoice.id, reverseReason.trim());
      await invalidateBillingQueries(queryClient);
      setSelectedInvoice(reversed);
      setReceipt(null);
      setReverseReason('');
      setConfirmingReverse(false);
      onStatus(`Factura ${reversed.invoice_number} reversada.`);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo reversar la factura.'));
    } finally {
      reversingInvoiceRef.current = false;
      setReversingInvoice(false);
    }
  }

  async function confirmReprintInvoice() {
    if (registeringReprintRef.current) return;
    if (!reprintTarget) return;

    try {
      registeringReprintRef.current = true;
      setRegisteringReprint(true);
      const invoice = await apiClient.getInvoice(reprintTarget.id);
      setSelectedInvoice(invoice);
      const institutionalReceipt = issuedInstitutionalReceipt(invoice);
      if (institutionalReceipt) {
        const reason = reprintReason.trim();
        if (reason.length < 5) {
          const message = 'Ingrese un motivo de reimpresión de al menos 5 caracteres.';
          setReprintReasonError(message);
          onStatus(message);

          return;
        }

        setReprintReasonError('');
        await openInstitutionalReceiptPdf(institutionalReceipt, reason);
        queryClient.invalidateQueries({ queryKey: ['audit'] });
        onStatus(`PDF institucional ${institutionalReceipt.receipt_number_full} abierto.`);
        setReprintTarget(null);
        setReprintReason('');

        return;
      }

      const requestedWidth = institutionalReceiptPaperSize(receiptWidth);
      setReprintReasonError('');
      const nextReceipt = await apiClient.reprintInvoice(reprintTarget.id, {
        width: requestedWidth,
        reason: reprintReason.trim() || 'Reimpresión solicitada desde historial.',
      });
      // Reprint posts an audit log entry that other views (dashboard,
      // cashier list) may display; let them refetch.
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      const normalizedWidth = institutionalReceiptPaperSize(nextReceipt.width);
      setReceiptWidth(normalizedWidth);
      setReceipt({ ...nextReceipt, width: normalizedWidth });
      setReceiptModalOpen(true);
      setReprintTarget(null);
      setReprintReason('');
      onStatus(`Recibo ${invoice.invoice_number} listo para imprimir.`);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo reimprimir el recibo.'));
    } finally {
      registeringReprintRef.current = false;
      setRegisteringReprint(false);
    }
  }

  function isOwnInvoiceFromToday(invoice: Invoice): boolean {
    const issuedDate = localDateString(new Date(invoice.issued_at));

    return invoice.issuer?.id === user.id && issuedDate === localDateString();
  }

  async function openInstitutionalReceiptPdf(
    receipt: NonNullable<Invoice['institutional_receipt']>,
    reason?: string,
  ) {
    const blob = reason?.trim()
      ? await apiClient.getInstitutionalReceiptPdf(receipt.id, reason)
      : await apiClient.getInstitutionalReceiptPdf(receipt.id);
    openBlobInNewTab(blob, `recibo-institucional-${receipt.receipt_number_full}.pdf`);
  }

  const hasActiveFilters = !!(
    filters.patient ||
    filters.invoice_number ||
    filters.status
  );

  const isEmpty = invoicesList.length === 0;

  return (
    <section id="historial" className="flex flex-col gap-5" aria-label="Historial de facturas">
      <InvoiceHistoryHeader loading={loading} meta={meta} />
      <InvoiceHistoryFilters
        filters={filters}
        hasActiveFilters={hasActiveFilters}
        loading={loading}
        onChange={setFilters}
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
              canViewReceipt={canViewReceipt}
              canVoid={canVoid}
              formatDate={formatDate}
              invoices={invoicesList}
              isOwnInvoiceFromToday={isOwnInvoiceFromToday}
              loadingActionInvoiceId={loadingActionInvoiceId}
              moneyLabel={moneyLabel}
              onGenerateInstitutionalReceipt={(invoiceId) => void generateInstitutionalReceipt(invoiceId)}
              onOpenReceipt={(invoiceId) => void openReceiptModal(invoiceId)}
              onPrepareInvoiceAction={(invoiceId, action) => void prepareInvoiceAction(invoiceId, action)}
              onReprint={setReprintTarget}
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

      <Dialog
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        title={`Comprobante de factura - ${selectedInvoice?.invoice_number ?? ''}`}
        description="Fallback legacy para facturas sin recibo institucional PDF. Cambiar el tamaño no registra reimpresión."
      >
        {receipt && selectedInvoice && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="receipt-width" className="text-sm font-semibold">Tamaño</label>
                <NativeSelect
                  id="receipt-width"
                  aria-label="Tamaño de vista previa"
                  value={receiptWidth}
                  onChange={(event) => {
                    const newWidth = institutionalReceiptPaperSize(event.target.value);
                    setReceiptWidth(newWidth);
                    setReceipt({ ...receipt, width: newWidth });
                  }}
                  className="w-[140px]"
                >
                  {INSTITUTIONAL_RECEIPT_PAPER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </NativeSelect>
              </div>

            </div>

            <ReceiptPreview
              receipt={receipt}
              onWidthChange={(width) => {
                const newWidth = institutionalReceiptPaperSize(width);
                setReceipt({ ...receipt, width: newWidth });
                setReceiptWidth(newWidth);
              }}
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
            <strong>Paciente:</strong> {selectedInvoice?.patient_name}
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
            <strong>Paciente:</strong> {selectedInvoice?.patient_name}
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
              Reversa los pagos registrados, crea movimientos compensatorios y deja auditoría.
            </p>
            {reverseReasonError ? (
              <p id="reverseReason-error" role="alert" className="text-xs font-medium text-destructive">
                {reverseReasonError}
              </p>
            ) : null}
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        confirmLabel="Registrar reimpresión"
        onCancel={() => {
          setReprintTarget(null);
          setReprintReason('');
          setReprintReasonError('');
        }}
        cancelDisabled={registeringReprint}
        confirmDisabled={registeringReprint || reprintReason.trim().length < 5}
        onConfirm={() => void confirmReprintInvoice()}
        open={Boolean(reprintTarget)}
        title={`¿Reimprimir ${reprintTarget?.invoice_number ?? 'recibo'}?`}
      >
        <div className="flex flex-col gap-3">
          <p>
            Esta acción queda auditada. Cambiar el tamaño en la vista previa no registra reimpresión; este botón sí.
          </p>
          <div className="space-y-2">
            <Label htmlFor="reprintReason">Motivo de reimpresión</Label>
            <Textarea
              id="reprintReason"
              aria-describedby={reprintReasonError ? 'reprintReason-help reprintReason-error' : 'reprintReason-help'}
              aria-invalid={Boolean(reprintReasonError)}
              value={reprintReason}
              disabled={registeringReprint}
              onChange={(event) => {
                setReprintReason(event.target.value);
                if (reprintReasonError && event.target.value.trim().length >= 5) {
                  setReprintReasonError('');
                }
              }}
              placeholder="Ejemplo: copia solicitada por paciente"
              rows={2}
            />
            <p id="reprintReason-help" className="text-xs text-muted-foreground">
              Registre un motivo claro para conservar la trazabilidad de reimpresiones.
            </p>
            {reprintReasonError ? (
              <p id="reprintReason-error" role="alert" className="text-xs font-medium text-destructive">
                {reprintReasonError}
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
  return formatLocalizedDateTime(value);
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
    patient: searchParams.get('patient') ?? '',
    invoice_number: searchParams.get('invoice_number') ?? '',
    page: Number(searchParams.get('page') || '1'),
    per_page: Number(searchParams.get('per_page') || '10'),
  };
}

function searchParamsFromFilters(filters: InvoiceFilters): Record<string, string> {
  const params: Record<string, string> = {};

  if (filters.date_from && filters.date_from !== today) params.date_from = filters.date_from;
  if (filters.date_to && filters.date_to !== today) params.date_to = filters.date_to;
  if (filters.status) params.status = filters.status;
  if (filters.patient) params.patient = filters.patient;
  if (filters.invoice_number) params.invoice_number = filters.invoice_number;
  if (filters.page && filters.page > 1) params.page = String(filters.page);
  if (filters.per_page && filters.per_page !== 10) params.per_page = String(filters.per_page);

  return params;
}
