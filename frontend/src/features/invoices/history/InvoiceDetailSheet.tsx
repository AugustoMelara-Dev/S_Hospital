import { Download, Printer, Receipt, ReceiptText, XCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Sheet } from '../../../components/ui/sheet';
import { StatusBadge } from '../../../components/ui/status-badge';
import { ErrorState, LoadingState } from '../../../components/ui/states';
import type { Invoice } from '../../../lib/api';
import { formatDateTimeEs } from '../../../lib/format/formatDate';
import {
  getIssuedInstitutionalReceipt,
  invoiceActionPolicy,
  type InvoiceActionPermissions,
} from '../../../modules/invoices/application/invoiceActionPolicy';

type InvoiceDetailSheetProps = {
  error: string;
  invoice: Invoice | null;
  loading: boolean;
  loadingActionInvoiceId: number | null;
  moneyLabel: (value: string | number | null | undefined) => string;
  onDownloadInstitutionalReceipt: (invoice: Invoice) => void;
  onGenerateInstitutionalReceipt: (invoiceId: number) => void;
  onOpenChange: (open: boolean) => void;
  onOpenReceipt: (invoiceId: number) => void;
  onPrepareInvoiceAction: (invoiceId: number, action: 'void' | 'reverse') => void;
  onReprint: (invoice: Invoice) => void;
  open: boolean;
  permissions: InvoiceActionPermissions | null;
};

const statusLabels: Record<Invoice['status'], string> = {
  issued: 'Emitida',
  partial: 'Parcial',
  paid: 'Pagada',
  void: 'Anulada',
};

const paymentLabels = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  other: 'Otro',
} as const;

export function InvoiceDetailSheet({
  error,
  invoice,
  loading,
  loadingActionInvoiceId,
  moneyLabel,
  onDownloadInstitutionalReceipt,
  onGenerateInstitutionalReceipt,
  onOpenChange,
  onOpenReceipt,
  onPrepareInvoiceAction,
  onReprint,
  open,
  permissions,
}: InvoiceDetailSheetProps) {
  const actions = invoice && permissions ? invoiceActionPolicy(invoice, permissions) : null;
  const institutionalReceipt = invoice ? getIssuedInstitutionalReceipt(invoice) : null;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Factura ${invoice?.invoice_number ?? ''}`.trim()}
      description="Detalle histórico de la factura y sus acciones autorizadas."
    >
      {loading ? <LoadingState label="Cargando detalle de factura..." /> : null}
      {!loading && error ? <ErrorState title="No se pudo cargar el detalle" description={error} /> : null}
      {!loading && !error && invoice ? (
        <div className="flex flex-col gap-6">
          <section aria-label="Resumen de factura" className="border-b border-border pb-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Paciente</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{patientName(invoice)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Emitida por {invoice.issuer?.name ?? 'Usuario no disponible'}
                </p>
                <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                  {formatDateTimeEs(invoice.issued_at)}
                </p>
              </div>
              <StatusBadge status={invoice.status === 'paid' ? 'paid' : invoice.status === 'void' ? 'void' : invoice.status === 'partial' ? 'partial' : 'info'}>
                {statusLabels[invoice.status]}
              </StatusBadge>
            </div>
          </section>

          <section aria-labelledby="invoice-detail-totals">
            <h3 id="invoice-detail-totals" className="text-sm font-semibold text-foreground">Resumen financiero</h3>
            <dl className="mt-3 divide-y divide-border rounded-md border border-border bg-muted/20 px-4">
              <AmountRow label="Subtotal" value={moneyLabel(invoice.subtotal)} />
              <AmountRow label="ISV" value={moneyLabel(invoice.tax_amount)} />
              <AmountRow label="Descuento" value={moneyLabel(invoice.discount_amount)} />
              <AmountRow label="Total" value={moneyLabel(invoice.total)} strong />
              <AmountRow label="Pagado" value={moneyLabel(invoice.paid_amount)} />
              <AmountRow label="Pendiente" value={moneyLabel(invoice.balance_due)} strong={invoice.balance_due !== '0.00'} />
            </dl>
          </section>

          <section aria-labelledby="invoice-detail-items">
            <h3 id="invoice-detail-items" className="text-sm font-semibold text-foreground">Servicios facturados</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Los nombres y precios corresponden al snapshot guardado al emitir la factura.</p>
            {invoice.items.length > 0 ? (
              <ul className="mt-3 divide-y divide-border rounded-md border border-border" aria-label="Ítems históricos de la factura">
                {invoice.items.map((item) => (
                  <li key={item.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <p className="break-words font-medium text-foreground">{item.service_name}</p>
                      <p className="text-xs text-muted-foreground">{item.category_name} · {item.quantity} × {moneyLabel(item.unit_price)}</p>
                    </div>
                    <p className="font-semibold tabular-nums text-foreground">{moneyLabel(item.line_total)}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-md border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">Esta respuesta no incluye el detalle de servicios.</p>
            )}
          </section>

          <section aria-labelledby="invoice-detail-payments">
            <h3 id="invoice-detail-payments" className="text-sm font-semibold text-foreground">Pagos y caja</h3>
            {invoice.payments?.length ? (
              <ul className="mt-3 divide-y divide-border rounded-md border border-border">
                {invoice.payments.map((payment) => (
                  <li key={payment.id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{paymentLabels[payment.method]}</span>
                        <StatusBadge status={payment.status === 'void' ? 'void' : 'paid'}>
                          {payment.status === 'void' ? 'Pago anulado' : 'Pago registrado'}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                        {formatDateTimeEs(payment.paid_at)} · Caja #{payment.cash_session_id}
                        {payment.reference ? ` · Ref. ${payment.reference}` : ''}
                      </p>
                      {payment.status === 'void' && payment.void_reason ? (
                        <p className="mt-1 text-xs text-muted-foreground">Motivo: {payment.void_reason}</p>
                      ) : null}
                    </div>
                    <span
                      aria-label={payment.status === 'void' ? `Monto anulado ${moneyLabel(payment.amount)}` : undefined}
                      className={payment.status === 'void'
                        ? 'font-semibold tabular-nums text-muted-foreground line-through'
                        : 'font-semibold tabular-nums text-foreground'}
                    >
                      {moneyLabel(payment.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Sin pagos registrados.</p>
            )}
            {invoice.cash_session ? (
              <p className="mt-2 text-xs text-muted-foreground">Caja #{invoice.cash_session.id} · {invoice.cash_session.user?.name ?? 'Cajero no disponible'}</p>
            ) : null}
          </section>

          {actions && Object.values(actions).some(Boolean) ? (
            <section aria-labelledby="invoice-detail-actions" className="border-t border-border pt-5">
              <h3 id="invoice-detail-actions" className="text-sm font-semibold text-foreground">Acciones autorizadas</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {actions.openReceipt ? (
                  <Button type="button" variant="outline" onClick={() => onOpenReceipt(invoice.id)}>
                    {actions.auditedOpen ? <Printer aria-hidden="true" /> : <Receipt aria-hidden="true" />}
                    {actions.auditedOpen ? 'Reimprimir PDF' : 'Ver recibo'}
                  </Button>
                ) : null}
                {actions.downloadInstitutionalReceipt && institutionalReceipt ? (
                  <Button type="button" variant="outline" disabled={loadingActionInvoiceId === invoice.id} onClick={() => onDownloadInstitutionalReceipt(invoice)}>
                    <Download aria-hidden="true" /> Descargar
                  </Button>
                ) : null}
                {actions.generateInstitutionalReceipt ? (
                  <Button type="button" variant="outline" disabled={loadingActionInvoiceId === invoice.id} onClick={() => onGenerateInstitutionalReceipt(invoice.id)}>
                    <ReceiptText aria-hidden="true" /> Generar PDF
                  </Button>
                ) : null}
                {actions.reprint ? (
                  <Button type="button" variant="outline" onClick={() => onReprint(invoice)}>
                    <Printer aria-hidden="true" /> Reimprimir
                  </Button>
                ) : null}
                {actions.reverse ? (
                  <Button type="button" variant="danger" onClick={() => onPrepareInvoiceAction(invoice.id, 'reverse')}>
                    <XCircle aria-hidden="true" /> Reversar pago
                  </Button>
                ) : null}
                {actions.void ? (
                  <Button type="button" variant="danger" onClick={() => onPrepareInvoiceAction(invoice.id, 'void')}>
                    <XCircle aria-hidden="true" /> Anular factura
                  </Button>
                ) : null}
              </div>
            </section>
          ) : null}

        </div>
      ) : null}
    </Sheet>
  );
}

function AmountRow({ label, strong = false, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={strong ? 'font-semibold tabular-nums text-foreground' : 'text-sm tabular-nums text-foreground'}>{value}</dd>
    </div>
  );
}

function patientName(invoice: Invoice) {
  return invoice.patient_name.trim() || 'Paciente sin nombre';
}
