import { DownloadOutlined as Download, PrinterOutlined as Printer, FileDoneOutlined as Receipt, FileTextOutlined as ReceiptText, CloseCircleOutlined as XCircle, CloseOutlined } from '@ant-design/icons';
import { Button, Alert, Drawer, Skeleton, Tag } from 'antd';
import type { Invoice } from '../../../lib/api';
import { formatDateTimeEs } from '../../../lib/format/formatDate';
import {
  getIssuedInstitutionalReceipt,
  invoiceActionPolicy,
  type InvoiceActionPermissions,
} from '../../../modules/invoices/application/invoiceActionPolicy';

type InvoiceDetailDrawerProps = {
  error: string;
  invoice: Invoice | null;
  loading: boolean;
  loadingActionInvoiceId: number | null;
  moneyLabel: (value: string | number | null | undefined) => string;
  onDownloadInstitutionalReceipt: (invoice: Invoice) => void;
  onAfterClose: () => void;
  onGenerateInstitutionalReceipt: (invoiceId: number) => void;
  onOpenChange: (open: boolean) => void;
  onOpenReceipt: (invoiceId: number) => void;
  onPrepareInvoiceAction: (invoiceId: number, action: 'void' | 'reverse') => void;
  onReprint: (invoice: Invoice) => void;
  open: boolean;
  permissions: InvoiceActionPermissions | null;
};

const paymentLabels = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  other: 'Otro',
} as const;

export function InvoiceDetailDrawer({
  error,
  invoice,
  loading,
  loadingActionInvoiceId,
  moneyLabel,
  onDownloadInstitutionalReceipt,
  onAfterClose,
  onGenerateInstitutionalReceipt,
  onOpenChange,
  onOpenReceipt,
  onPrepareInvoiceAction,
  onReprint,
  open,
  permissions,
}: InvoiceDetailDrawerProps) {
  const actions = invoice && permissions ? invoiceActionPolicy(invoice, permissions) : null;
  const institutionalReceipt = invoice ? getIssuedInstitutionalReceipt(invoice) : null;
  const hasActions = actions ? Object.values(actions).some(Boolean) : false;
  const actionButtons = invoice && actions && hasActions ? (
    <div className="flex flex-wrap items-center justify-end gap-2" aria-label="Acciones autorizadas">
      <span className="mr-auto text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Acciones autorizadas
      </span>
      {actions.openReceipt ? (
        <Button type="default" onClick={() => onOpenReceipt(invoice.id)}>
          <Receipt aria-hidden="true" /> {actions.auditedOpen ? 'Reimprimir PDF' : 'Ver recibo'}
        </Button>
      ) : null}
      {actions.downloadInstitutionalReceipt && institutionalReceipt ? (
        <Button type="default" disabled={loadingActionInvoiceId === invoice.id} onClick={() => onDownloadInstitutionalReceipt(invoice)}>
          <Download aria-hidden="true" /> Descargar
        </Button>
      ) : null}
      {actions.generateInstitutionalReceipt ? (
        <Button type="default" disabled={loadingActionInvoiceId === invoice.id} onClick={() => onGenerateInstitutionalReceipt(invoice.id)}>
          <ReceiptText aria-hidden="true" /> Generar PDF
        </Button>
      ) : null}
      {actions.reprint ? (
        <Button type="default" onClick={() => onReprint(invoice)}>
          <Printer aria-hidden="true" /> Reimprimir
        </Button>
      ) : null}
      {actions.reverse ? (
        <Button type="default" danger onClick={() => onPrepareInvoiceAction(invoice.id, 'reverse')}>
          <XCircle aria-hidden="true" /> Reversar pago
        </Button>
      ) : null}
      {actions.void ? (
        <Button type="default" danger onClick={() => onPrepareInvoiceAction(invoice.id, 'void')}>
          <XCircle aria-hidden="true" /> Anular factura
        </Button>
      ) : null}
    </div>
  ) : undefined;

  return (
    <Drawer
      open={open}
      afterOpenChange={(nextOpen) => { if (!nextOpen) onAfterClose(); }}
      onClose={() => onOpenChange(false)}
      title={`Factura ${invoice?.invoice_number ?? ''}`.trim()}
      closable={false}
      footer={actionButtons}
      extra={
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={() => onOpenChange(false)}
          aria-label="Cerrar panel"
          className="h-8 w-8 flex items-center justify-center p-0 border-0 bg-transparent hover:bg-muted"
        />
      }
      {...{ role: 'dialog', 'aria-label': `Factura ${invoice?.invoice_number ?? ''}`.trim() } as Record<string, unknown>}
    >
      <p className="text-sm text-muted-foreground mb-4">Detalle histórico de la factura y sus acciones autorizadas.</p>
      {loading ? (
        <div role="status">
          <Skeleton active={false} />
          <span>Cargando detalle de factura...</span>
        </div>
      ) : null}
      {!loading && error ? (
        <Alert
          type="error"
          showIcon
          title="No se pudo cargar el detalle"
          description={error}
        />
      ) : null}
      {!loading && !error && invoice ? (
        <div className="flex flex-col gap-6">
          <section aria-label="Resumen de factura" className="border border-border bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paciente</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{patientName(invoice)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Emitida por {invoice.issuer?.name ?? 'Usuario no disponible'}
                </p>
                <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                  {formatDateTimeEs(invoice.issued_at)}
                </p>
              </div>
              <Tag color={invoice.status === 'paid' ? 'success' : invoice.status === 'void' ? 'error' : invoice.status === 'partial' ? 'warning' : 'processing'}>
                {invoice.status === 'paid' ? 'Pagada' : invoice.status === 'void' ? 'Anulada' : invoice.status === 'partial' ? 'Parcial' : 'Emitida'}
              </Tag>
            </div>
          </section>

          <section aria-labelledby="invoice-detail-totals">
            <h3 id="invoice-detail-totals" className="text-sm font-semibold text-foreground">Resumen financiero</h3>
            <dl className="mt-3 divide-y divide-border border border-border bg-muted/25 px-4">
              <AmountRow label="Subtotal" value={moneyLabel(invoice.subtotal)} />
              <AmountRow label="ISV" value={moneyLabel(invoice.tax_amount)} />
              <AmountRow label="Descuento" value={moneyLabel(invoice.discount_amount)} />
              <AmountRow label="Total" value={moneyLabel(invoice.total)} strong />
              <AmountRow label="Pagado" value={moneyLabel(invoice.paid_amount)} />
              <AmountRow label="Pendiente" value={moneyLabel(invoice.balance_due)} strong={invoice.balance_due !== '0.00'} />
            </dl>
          </section>

          {invoice.items && invoice.items.length > 0 ? (
            <section aria-labelledby="invoice-detail-items">
              <h3 id="invoice-detail-items" className="text-sm font-semibold text-foreground">Servicios detallados</h3>
              <div className="mt-3 border border-border divide-y divide-border">
                {invoice.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-4 p-4 bg-muted/5 hover:bg-muted/10">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-foreground leading-snug break-words">{item.service_name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Precio unitario: <span className="font-mono tabular-nums">{moneyLabel(item.unit_price)}</span>
                      </p>
                      {item.special_rule_applied ? (
                        <span className="mt-1 inline-block border border-success/15 bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                          Receta de diálisis (L 0.00)
                        </span>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">Cantidad: <span className="font-mono font-semibold text-foreground tabular-nums">{item.quantity}</span></p>
                      <p className="mt-1 font-mono font-semibold text-sm text-foreground tabular-nums">{moneyLabel(item.line_total)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {invoice.payments && invoice.payments.length > 0 ? (
            <section aria-labelledby="invoice-detail-payments">
              <h3 id="invoice-detail-payments" className="text-sm font-semibold text-foreground">Pagos y caja</h3>
              <div className="mt-3 divide-y divide-border border border-border">
                {invoice.payments.map((payment) => (
                  <div key={payment.id} className="grid gap-2 bg-muted/5 p-4 text-sm sm:grid-cols-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{paymentLabels[payment.method] ?? payment.method}</span>
                        <Tag color={payment.status === 'void' ? 'error' : 'success'}>
                          {payment.status === 'void' ? 'Pago anulado' : 'Pago registrado'}
                        </Tag>
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
                  </div>
                ))}
              </div>
              {invoice.cash_session ? (
                <p className="mt-2 text-xs text-muted-foreground">Caja #{invoice.cash_session.id} · {invoice.cash_session.user?.name ?? 'Cajero no disponible'}</p>
              ) : null}
            </section>
          ) : null}

        </div>
      ) : null}
    </Drawer>
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
