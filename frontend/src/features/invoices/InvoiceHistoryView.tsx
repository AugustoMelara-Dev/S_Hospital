import { type FormEvent, useEffect, useState } from 'react';
import {
  type AuthUser,
  type Invoice,
  type InvoiceFilters,
  type PaginatedMeta,
  type ReceiptData,
  apiClient,
  userSafeErrorMessage,
} from '../../lib/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Dialog } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { PaginationControls } from '../../components/ui/pagination';
import { ReceiptPreview } from '../receipts/ReceiptPreview';
import { Textarea } from '../../components/ui/textarea';
import {
  FileClock,
  MoreHorizontal,
  Printer,
  Receipt,
  Search,
  XCircle,
} from 'lucide-react';

type InvoiceHistoryViewProps = {
  user: AuthUser;
  onStatus: (message: string) => void;
};

const today = localDateString();

export function InvoiceHistoryView({ user, onStatus }: InvoiceHistoryViewProps) {
  const [filters, setFilters] = useState<InvoiceFilters>({
    date_from: today,
    date_to: today,
    status: '',
    patient: '',
    invoice_number: '',
    page: 1,
    per_page: 10,
  });
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta>({ current_page: 1, per_page: 10, total: 0 });
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [receiptWidth, setReceiptWidth] = useState<ReceiptData['width']>('80mm');
  const [reprintReason, setReprintReason] = useState('');
  const [voidReason, setVoidReason] = useState('');
  const [confirmingVoid, setConfirmingVoid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<number | null>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  const canReprint = user.permissions.includes('receipts.reprint');
  const canReprintAny = user.permissions.includes('receipts.reprint_any');
  const canVoid = user.permissions.includes('invoices.void');

  useEffect(() => {
    void loadInvoices(filters);
  }, []);

  async function loadInvoices(nextFilters: InvoiceFilters) {
    setLoading(true);

    try {
      const response = await apiClient.getInvoices(nextFilters);
      setInvoices(response.data);
      setMeta(response.meta);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo cargar historial.'));
    } finally {
      setLoading(false);
    }
  }

  async function submitFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFilters = { ...filters, page: 1 };
    setFilters(nextFilters);
    await loadInvoices(nextFilters);
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
    void loadInvoices(clearedFilters);
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
      const receiptData = await apiClient.getReceipt(invoiceId, receiptWidth);
      setReceipt(receiptData);
      setReceiptModalOpen(true);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo cargar recibo.'));
    }
  }

  async function changePage(page: number) {
    const nextFilters = { ...filters, page };
    setFilters(nextFilters);
    await loadInvoices(nextFilters);
  }

  async function reprint(width = receiptWidth) {
    if (!selectedInvoice) {
      return;
    }

    try {
      const nextReceipt = await apiClient.reprintInvoice(selectedInvoice.id, {
        width,
        reason: reprintReason.trim() || null,
      });
      setReceipt(nextReceipt);
      setReceiptWidth(width);
      onStatus(`Reimpresion auditada para ${selectedInvoice.invoice_number}.`);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo reimprimir.'));
    }
  }

  async function voidSelectedInvoice() {
    if (!selectedInvoice || voidReason.trim().length < 5) {
      onStatus('Ingrese un motivo de anulacion de al menos 5 caracteres.');

      return;
    }

    try {
      const voided = await apiClient.voidInvoice(selectedInvoice.id, voidReason.trim());
      setSelectedInvoice(voided);
      setInvoices((current) => current.map((invoice) => (invoice.id === voided.id ? voided : invoice)));
      setReceipt(null);
      setVoidReason('');
      onStatus(`Factura ${voided.invoice_number} anulada.`);
    } catch (error) {
      onStatus(userSafeErrorMessage(error, 'No se pudo anular la factura.'));
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

  const isEmpty = invoices.length === 0;

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
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submitFilters} className="flex flex-wrap gap-4">
            <div className="w-[150px]">
              <Label htmlFor="date_from">Desde</Label>
              <Input
                id="date_from"
                type="date"
                value={filters.date_from ?? ''}
                onChange={(event) => setFilters({ ...filters, date_from: event.target.value })}
              />
            </div>

            <div className="w-[150px]">
              <Label htmlFor="date_to">Hasta</Label>
              <Input
                id="date_to"
                type="date"
                value={filters.date_to ?? ''}
                onChange={(event) => setFilters({ ...filters, date_to: event.target.value })}
              />
            </div>

            <div className="w-[150px]">
              <Label htmlFor="status">Estado</Label>
              <select
                id="status"
                className="flex min-h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                value={filters.status ?? ''}
                onChange={(event) =>
                  setFilters({ ...filters, status: event.target.value as InvoiceFilters['status'] })
                }
              >
                <option value="">Todos</option>
                <option value="issued">Emitida</option>
                <option value="partial">Parcial</option>
                <option value="paid">Pagada</option>
                <option value="void">Anulada</option>
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="patient">Paciente</Label>
              <Input
                id="patient"
                placeholder="Nombre del paciente..."
                value={filters.patient ?? ''}
                onChange={(event) => setFilters({ ...filters, patient: event.target.value })}
              />
            </div>

            <div className="w-[150px]">
              <Label htmlFor="invoice_number">Numero de factura</Label>
              <Input
                id="invoice_number"
                placeholder="A-0001..."
                value={filters.invoice_number ?? ''}
                onChange={(event) => setFilters({ ...filters, invoice_number: event.target.value })}
              />
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit" disabled={loading}>
                <Search className="h-4 w-4" />
                {loading ? 'Buscando...' : 'Buscar'}
              </Button>
              <Button type="button" variant="outline" onClick={clearFilters}>
                Limpiar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isEmpty && !loading ? (
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
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Fecha</th>
                    <th>Paciente</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Pagado</th>
                    <th>Estado</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td className="font-mono text-sm">{invoice.invoice_number}</td>
                      <td>{formatDate(invoice.issued_at)}</td>
                      <td className="font-medium">{invoice.patient_name}</td>
                      <td className="text-right">L. {invoice.total}</td>
                      <td className="text-right">L. {invoice.paid_amount}</td>
                      <td>
                        <StatusBadge status={invoice.status} />
                      </td>
                      <td className="text-right">
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
                              />
                              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-border bg-card shadow-lg">
                                <div className="py-1">
                                  <button
                                    type="button"
                                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                                    onClick={() => void openReceiptModal(invoice.id)}
                                  >
                                    <Receipt className="h-4 w-4" />
                                    Ver Recibo
                                  </button>

                                  {canReprint && (canReprintAny || isOwnInvoiceFromToday(invoice)) && (
                                    <button
                                      type="button"
                                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                                      onClick={async () => {
                                        setOpenActionsId(null);
                                        await openDetail(invoice.id);
                                        const nextReceipt = await apiClient.reprintInvoice(invoice.id, {
                                          width: receiptWidth,
                                          reason: null,
                                        });
                                        setReceipt(nextReceipt);
                                        setReceiptModalOpen(true);
                                      }}
                                    >
                                      <Printer className="h-4 w-4" />
                                      Reimprimir
                                    </button>
                                  )}

                                  {canVoid && invoice.status !== 'void' && (
                                    <>
                                      <div className="my-1 border-t border-border" />
                                      <button
                                        type="button"
                                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted"
                                        onClick={() => {
                                          setOpenActionsId(null);
                                          void openDetail(invoice.id);
                                          setConfirmingVoid(true);
                                        }}
                                      >
                                        <XCircle className="h-4 w-4" />
                                        Anular
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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
      >
        {receipt && selectedInvoice && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label htmlFor="receipt-width" className="text-sm font-semibold">Ancho</label>
                <select
                  id="receipt-width"
                  className="flex min-h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground outline-none"
                  value={receiptWidth}
                  onChange={(e) => {
                    const newWidth = e.target.value as ReceiptData['width'];
                    setReceiptWidth(newWidth);
                    void reprint(newWidth);
                  }}
                >
                  <option value="80mm">80mm</option>
                  <option value="58mm">58mm</option>
                </select>
              </div>

              <div className="flex items-center gap-2 flex-1">
                <label htmlFor="reprint-reason" className="text-sm font-semibold">Motivo</label>
                <Input
                  id="reprint-reason"
                  placeholder="Motivo de reimpresión (opcional)"
                  value={reprintReason}
                  onChange={(e) => setReprintReason(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>

            <ReceiptPreview
              receipt={receipt}
              onWidthChange={(width) => {
                setReceipt({ ...receipt, width });
                setReceiptWidth(width);
              }}
              onPrint={() => {
                onStatus(`Recibo ${selectedInvoice.invoice_number} enviado a impresión.`);
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
  return new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}
