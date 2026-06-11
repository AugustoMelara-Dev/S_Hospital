import { type FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  type AuthUser,
  type Invoice,
  type InvoiceFilters,
  type PaginatedMeta,
  type ReceiptData,
  apiClient,
  userSafeErrorMessage,
} from '../../lib/api';
import { useInvoices } from '../../hooks/useInvoices';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Alert } from '../../components/ui/alert';
import { Card, CardContent } from '../../components/ui/card';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { PaginationControls } from '../../components/ui/pagination';
import { NativeSelect, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { LoadingState } from '../../components/ui/states';
import { ReceiptPreview } from '../receipts/ReceiptPreview';
import { Textarea } from '../../components/ui/textarea';
import { DateRangePicker } from '../../components/ui/date-range-picker';
import { FilterBar } from '../../components/ui/filter-bar';
import { INSTITUTIONAL_RECEIPT_PAPER_OPTIONS, institutionalReceiptPaperSize } from '../../lib/institutionalReceiptPaper';
import { formatLempirasFromCents, parseCents } from '../../lib/moneyCents';
import { formatLocalizedDateTime } from '../../lib/format/formatDate';
import {
  FileClock,
  MoreHorizontal,
  Printer,
  Receipt,
  XCircle,
} from 'lucide-react';

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
  const [reprintReason, setReprintReason] = useState('');
  const [confirmingVoid, setConfirmingVoid] = useState(false);
  const [reprintTarget, setReprintTarget] = useState<Invoice | null>(null);
  const [openActionsId, setOpenActionsId] = useState<number | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  const canReprint = user.permissions.includes('receipts.reprint');
  const canReprintAny = user.permissions.includes('receipts.reprint_any');
  const canViewReceipt = user.permissions.includes('receipts.view');
  const canVoid = user.permissions.includes('invoices.void');

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

  async function openDetail(invoiceId: number) {
    try {
      const invoice = await apiClient.getInvoice(invoiceId);
      setSelectedInvoice(invoice);
      onStatus(`Factura ${invoice.invoice_number} cargada.`);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo cargar detalle.'));
    }
  }

  async function openReceiptModal(invoiceId: number) {
    setOpenActionsId(null);
    setReceipt(null);

    try {
      const invoice = await apiClient.getInvoice(invoiceId);
      setSelectedInvoice(invoice);
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
      reason: 'Impresion desde vista de recibo.',
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

  async function voidSelectedInvoice() {
    if (!selectedInvoice || voidReason.trim().length < 5) {
      onStatus('Ingrese un motivo de anulacion de al menos 5 caracteres.');

      return;
    }

    try {
      const voided = await apiClient.voidInvoice(selectedInvoice.id, voidReason.trim());
      // Notify the rest of the app (dashboard, cashier list, second PC
      // in LAN) that this invoice and the cash session are stale.
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setSelectedInvoice(voided);
      setReceipt(null);
      setVoidReason('');
      onStatus(`Factura ${voided.invoice_number} anulada.`);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo anular la factura.'));
    }
  }

  async function confirmReprintInvoice() {
    if (!reprintTarget) return;

    try {
      const invoice = await apiClient.getInvoice(reprintTarget.id);
      setSelectedInvoice(invoice);
      const requestedWidth = institutionalReceiptPaperSize(receiptWidth);
      const nextReceipt = await apiClient.reprintInvoice(reprintTarget.id, {
        width: requestedWidth,
        reason: reprintReason.trim() || 'Reimpresion solicitada desde historial.',
      });
      // Reprint posts an audit log entry that other views (dashboard,
      // cashier list) may display; let them refetch.
      queryClient.invalidateQueries({ queryKey: ['audit'] });
      const normalizedWidth = institutionalReceiptPaperSize(nextReceipt.width);
      setReceiptWidth(normalizedWidth);
      setReceipt({ ...nextReceipt, width: normalizedWidth });
      setReceiptModalOpen(true);
      onStatus(`Recibo ${invoice.invoice_number} listo para imprimir.`);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo reimprimir el recibo.'));
    } finally {
      setReprintTarget(null);
      setReprintReason('');
    }
  }

  function isOwnInvoiceFromToday(invoice: Invoice): boolean {
    const issuedDate = localDateString(new Date(invoice.issued_at));

    return invoice.issuer?.id === user.id && issuedDate === localDateString();
  }

  const hasActiveFilters = !!(
    filters.patient ||
    filters.invoice_number ||
    filters.status
  );

  const isEmpty = invoicesList.length === 0;

  return (
    <section id="historial" className="flex flex-col gap-5" aria-labelledby="invoice-history-title">
      <div>
        <h1 id="invoice-history-title" className="text-2xl font-bold tracking-tight">
          Historial de facturas
        </h1>
        <p className="text-sm text-muted-foreground">
          Consulte facturas recientes, reimprima recibos y gestione anulaciones autorizadas.
        </p>
      </div>
      <FilterBar
        onSearch={(e) => void submitFilters(e)}
        onClear={clearFilters}
        isLoading={loading}
        hasActiveFilters={hasActiveFilters}
      >
        <DateRangePicker
          startDate={filters.date_from ?? ''}
          endDate={filters.date_to ?? ''}
          onStartDateChange={(val) => setFilters({ ...filters, date_from: val })}
          onEndDateChange={(val) => setFilters({ ...filters, date_to: val })}
          className="col-span-1 sm:col-span-2"
        />

        <div className="space-y-1.5">
          <Label htmlFor="status" className="text-xs font-semibold text-slate-600 dark:text-slate-400">Estado</Label>
          <Select
            value={filters.status ?? 'all'}
            onValueChange={(v) => setFilters({ ...filters, status: v === 'all' ? '' : v as InvoiceFilters['status'] })}
          >
            <SelectTrigger id="status" className="h-10">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="issued">Emitida</SelectItem>
              <SelectItem value="partial">Parcial</SelectItem>
              <SelectItem value="paid">Pagada</SelectItem>
              <SelectItem value="void">Anulada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="patient" className="text-xs font-semibold text-slate-600 dark:text-slate-400">Paciente</Label>
          <Input
            id="patient"
            placeholder="Nombre del paciente..."
            value={filters.patient ?? ''}
            onChange={(event) => setFilters({ ...filters, patient: event.target.value })}
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invoice_number" className="text-xs font-semibold text-slate-600 dark:text-slate-400">Número de factura</Label>
          <Input
            id="invoice_number"
            placeholder="A-0001..."
            value={filters.invoice_number ?? ''}
            onChange={(event) => setFilters({ ...filters, invoice_number: event.target.value })}
            className="h-10"
          />
        </div>
      </FilterBar>

      {loadError ? (
        <Alert variant="destructive" title="No se pudo cargar el historial">
          {loadError}
        </Alert>
      ) : null}

      {isEmpty && !loading && !loadError ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileClock className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay facturas</h3>
            <p className="text-muted-foreground text-center mb-4">
              {hasActiveFilters
                ? 'No se encontraron facturas con los filtros seleccionados.'
                : 'No hay facturas registradas aún.'}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters}>
                Limpiar filtros
              </Button>
            )}
          </CardContent>
        </Card>
      ) : loading ? (
        <LoadingState label="Cargando facturas..." />
      ) : !loadError ? (
        <Card>
          <CardContent className="p-0">
            <div className="table-wrap">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>No.</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pagado</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesList.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="text-sm font-medium">{invoice.invoice_number}</TableCell>
                      <TableCell>{formatDate(invoice.issued_at)}</TableCell>
                      <TableCell className="font-medium">{invoice.patient_name}</TableCell>
                      <TableCell className="text-right">{moneyLabel(invoice.total)}</TableCell>
                      <TableCell className="text-right">{moneyLabel(invoice.paid_amount)}</TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canViewReceipt && (canReprintAny || canVoid || isOwnInvoiceFromToday(invoice)) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => void openReceiptModal(invoice.id)}
                            >
                              <Receipt className="h-4 w-4" aria-hidden="true" />
                              Ver recibo
                            </Button>
                          )}

                          {canReprint && (canReprintAny || isOwnInvoiceFromToday(invoice)) && (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => setReprintTarget(invoice)}
                            >
                              <Printer className="h-4 w-4" aria-hidden="true" />
                              Reimprimir
                            </Button>
                          )}

                          {canVoid && invoice.status !== 'void' && (
                        <div className="relative inline-block">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Ver acciones de factura ${invoice.invoice_number}`}
                            onClick={() =>
                              setOpenActionsId(openActionsId === invoice.id ? null : invoice.id)
                            }
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>

                          {openActionsId === invoice.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setOpenActionsId(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape' || e.key === 'Enter') {
                                    setOpenActionsId(null);
                                  }
                                }}
                                role="button"
                                tabIndex={0}
                                aria-label="Cerrar menú de acciones"
                              />
                              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-border bg-card shadow-lg">
                                <div className="py-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-destructive hover:bg-destructive/10"
                                        onClick={() => {
                                          setOpenActionsId(null);
                                          void openDetail(invoice.id);
                                          setConfirmingVoid(true);
                                        }}
                                      >
                                        <XCircle className="h-4 w-4" aria-hidden="true" />
                                        Anular
                                      </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!isEmpty && (
        <div className="flex items-center justify-between">
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
        title={`Recibo - ${selectedInvoice?.invoice_number ?? ''}`}
        description="Vista previa de recibo institucional. Cambiar el tamano no registra reimpresion."
      >
        {receipt && selectedInvoice && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="receipt-width" className="text-sm font-semibold">Tamano</label>
                <NativeSelect
                  id="receipt-width"
                  aria-label="Tamano de vista previa"
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
        confirmLabel="Anular Factura"
        danger
        onCancel={() => {
          setConfirmingVoid(false);
          setVoidReason('');
        }}
        onConfirm={() => {
          setConfirmingVoid(false);
          void voidSelectedInvoice();
        }}
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
              aria-label="Motivo de anulacion"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Explique el motivo de la anulación (mínimo 5 caracteres)..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Esta acción no se puede deshacer. La factura será marcada como anulada.
            </p>
          </div>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        confirmLabel="Registrar reimpresión"
        onCancel={() => {
          setReprintTarget(null);
          setReprintReason('');
        }}
        onConfirm={() => void confirmReprintInvoice()}
        open={Boolean(reprintTarget)}
        title={`¿Reimprimir ${reprintTarget?.invoice_number ?? 'recibo'}?`}
      >
        <div className="flex flex-col gap-3">
          <p>
            Esta acción queda auditada. Cambiar el tamaño en la vista previa no registra reimpresión; este botón sí.
          </p>
          <div className="space-y-2">
            <Label htmlFor="reprintReason">Motivo opcional</Label>
            <Textarea
              id="reprintReason"
              value={reprintReason}
              onChange={(event) => setReprintReason(event.target.value)}
              placeholder="Ejemplo: copia solicitada por paciente"
              rows={2}
            />
          </div>
        </div>
      </ConfirmDialog>
    </section>
  );
}

const statusConfig = {
  issued: { label: 'Emitida', className: 'bg-blue-100 text-blue-800' },
  partial: { label: 'Parcial', className: 'bg-amber-100 text-amber-800' },
  paid: { label: 'Pagada', className: 'bg-emerald-100 text-emerald-800' },
  void: { label: 'Anulada', className: 'bg-red-100 text-red-800' },
} as const;

function StatusBadge({ status }: { status: Invoice['status'] }) {
  const config = statusConfig[status] ?? statusConfig.issued;

  return (
    <Badge className={config.className}>
      {config.label}
    </Badge>
  );
}

function formatDate(value: string): string {
  return formatLocalizedDateTime(value);
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasFromCents(parseCents(value));
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
