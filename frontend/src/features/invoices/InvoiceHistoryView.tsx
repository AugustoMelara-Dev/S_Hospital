import { type FormEvent, useEffect, useState } from 'react';
import {
  type AuthUser,
  type Invoice,
  type InvoiceFilters,
  type PaginatedMeta,
  type ReceiptData,
  apiClient,
} from '../../lib/api';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { ReceiptPreview } from '../receipts/ReceiptPreview';

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

  const canReprint = user.permissions.includes('receipts.reprint');
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
      onStatus(error instanceof Error ? error.message : 'No se pudo cargar historial.');
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

  async function openDetail(invoiceId: number) {
    setReceipt(null);

    try {
      const invoice = await apiClient.getInvoice(invoiceId);
      setSelectedInvoice(invoice);
      onStatus(`Factura ${invoice.invoice_number} cargada.`);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'No se pudo cargar detalle.');
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
      onStatus(error instanceof Error ? error.message : 'No se pudo reimprimir.');
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
      onStatus(`Factura ${voided.invoice_number} anulada.`);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'No se pudo anular la factura.');
    }
  }

  return (
    <section id="historial" className="flex flex-col gap-5" aria-labelledby="invoice-history-title">
      <Card>
        <CardHeader className="md:flex-row md:items-end md:justify-between">
          <div>
            <CardDescription>Auditoria de facturas</CardDescription>
            <CardTitle id="invoice-history-title">Historial de facturas</CardTitle>
          </div>
          <Badge variant="secondary">{meta.total} registros</Badge>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <form className="history-filters" onSubmit={submitFilters}>
            <label>
              Desde
              <Input
                type="date"
                value={filters.date_from ?? ''}
                onChange={(event) => setFilters({ ...filters, date_from: event.target.value })}
              />
            </label>
            <label>
              Hasta
              <Input
                type="date"
                value={filters.date_to ?? ''}
                onChange={(event) => setFilters({ ...filters, date_to: event.target.value })}
              />
            </label>
            <label>
              Paciente
              <Input
                value={filters.patient ?? ''}
                onChange={(event) => setFilters({ ...filters, patient: event.target.value })}
              />
            </label>
            <label>
              Numero de factura
              <Input
                value={filters.invoice_number ?? ''}
                onChange={(event) => setFilters({ ...filters, invoice_number: event.target.value })}
              />
            </label>
            <label>
              Estado
              <Select
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
              </Select>
            </label>
            <Button type="submit" disabled={loading}>
              {loading ? 'Buscando...' : 'Filtrar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Numero</th>
              <th>Fecha</th>
              <th>Paciente</th>
              <th>Total</th>
              <th>Pagado</th>
              <th>Saldo</th>
              <th>Estado</th>
              <th>Cajero</th>
              <th>Accion</th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={9}>No hay facturas para los filtros seleccionados.</td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.invoice_number}</td>
                  <td>{formatDate(invoice.issued_at)}</td>
                  <td>{invoice.patient_name}</td>
                  <td>L. {invoice.total}</td>
                  <td>L. {invoice.paid_amount}</td>
                  <td>L. {invoice.balance_due}</td>
                  <td><StatusBadge status={invoice.status} /></td>
                  <td>{invoice.issuer?.name ?? 'No registrado'}</td>
                  <td>
                    <Button type="button" variant="secondary" size="sm" onClick={() => openDetail(invoice.id)}>
                      Ver
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination-row">
        <Button
          type="button"
          variant="secondary"
          disabled={meta.current_page <= 1}
          onClick={() => changePage(meta.current_page - 1)}
        >
          Anterior
        </Button>
        <span>
          Pagina {meta.current_page} de {Math.max(1, Math.ceil(meta.total / meta.per_page))}
        </span>
        <Button
          type="button"
          variant="secondary"
          disabled={meta.current_page >= Math.ceil(meta.total / meta.per_page)}
          onClick={() => changePage(meta.current_page + 1)}
        >
          Siguiente
        </Button>
      </div>

      {selectedInvoice ? (
        <Card aria-labelledby="invoice-detail-title">
          <CardHeader className="md:flex-row md:items-end md:justify-between">
            <div>
              <CardDescription>Detalle auditado</CardDescription>
              <CardTitle id="invoice-detail-title">{selectedInvoice.invoice_number}</CardTitle>
            </div>
            <StatusBadge status={selectedInvoice.status} />
          </CardHeader>

          <CardContent className="flex flex-col gap-5">
            <dl className="detail-grid">
              <div>
                <dt>Paciente</dt>
                <dd>{selectedInvoice.patient_name}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>L. {selectedInvoice.total}</dd>
              </div>
              <div>
                <dt>Pagado</dt>
                <dd>L. {selectedInvoice.paid_amount}</dd>
              </div>
              <div>
                <dt>Saldo</dt>
                <dd>L. {selectedInvoice.balance_due}</dd>
              </div>
              <div>
                <dt>Caja</dt>
                <dd>{selectedInvoice.cash_session?.id ? `#${selectedInvoice.cash_session.id}` : 'Sin caja'}</dd>
              </div>
              <div>
                <dt>Motivo anulacion</dt>
                <dd>{selectedInvoice.void_reason ?? 'No aplica'}</dd>
              </div>
            </dl>

            <h4>Items snapshot</h4>
            <div className="snapshot-list">
              {selectedInvoice.items.map((item) => (
                <div key={item.id} className="snapshot-item">
                  <span>{item.quantity} x {item.service_name}</span>
                  <small>{item.category_name}</small>
                  <strong>L. {item.line_total}</strong>
                </div>
              ))}
            </div>

            <h4>Pagos</h4>
            {selectedInvoice.payments && selectedInvoice.payments.length > 0 ? (
              <div className="snapshot-list">
                {selectedInvoice.payments.map((payment) => (
                  <div key={payment.id} className="snapshot-item">
                    <span>{payment.method}</span>
                    <small>{formatDate(payment.paid_at)}</small>
                    <strong>L. {payment.amount}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">Sin pagos registrados.</p>
            )}

            <div className="history-actions">
              {canReprint ? (
                <div className="action-box">
                  <label>
                    Ancho
                    <Select
                      value={receiptWidth}
                      onChange={(event) => setReceiptWidth(event.target.value as ReceiptData['width'])}
                    >
                      <option value="80mm">80mm</option>
                      <option value="58mm">58mm</option>
                    </Select>
                  </label>
                  <label>
                    Motivo reimpresion
                    <Input
                      value={reprintReason}
                      onChange={(event) => setReprintReason(event.target.value)}
                    />
                  </label>
                  <Button type="button" onClick={() => reprint()}>
                    Reimprimir
                  </Button>
                </div>
              ) : null}

              {canVoid ? (
                <div className="action-box danger-zone">
                  <label>
                    Motivo de anulacion
                    <textarea
                      value={voidReason}
                      onChange={(event) => setVoidReason(event.target.value)}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={selectedInvoice.status === 'void'}
                    onClick={() => {
                      if (voidReason.trim().length < 5) {
                        onStatus('Ingrese un motivo de anulacion de al menos 5 caracteres.');
                        return;
                      }
                      setConfirmingVoid(true);
                    }}
                  >
                    Anular factura
                  </Button>
                </div>
              ) : null}
            </div>
          </CardContent>

          {receipt ? (
            <ReceiptPreview
              receipt={receipt}
              onWidthChange={(width) => {
                setReceipt({ ...receipt, width });
                setReceiptWidth(width);
              }}
            />
          ) : null}
        </Card>
      ) : null}

      <ConfirmDialog
        confirmLabel="Confirmar anulacion"
        onCancel={() => setConfirmingVoid(false)}
        onConfirm={() => {
          setConfirmingVoid(false);
          void voidSelectedInvoice();
        }}
        open={confirmingVoid}
        title="Anular factura"
      >
        <div className="flex flex-col gap-2">
          <p>Factura: <strong>{selectedInvoice?.invoice_number}</strong></p>
          <p>Paciente: <strong>{selectedInvoice?.patient_name}</strong></p>
          <p>Motivo: <strong>{voidReason.trim()}</strong></p>
          <p>Esta accion queda auditada y no borra la factura historica.</p>
        </div>
      </ConfirmDialog>
    </section>
  );
}

function labelStatus(status: Invoice['status']): string {
  return {
    issued: 'Emitida',
    partial: 'Parcial',
    paid: 'Pagada',
    void: 'Anulada',
  }[status];
}

function StatusBadge({ status }: { status: Invoice['status'] }) {
  const variant = status === 'void' ? 'destructive' : status === 'paid' ? 'default' : 'secondary';

  return <Badge variant={variant}>{labelStatus(status)}</Badge>;
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
