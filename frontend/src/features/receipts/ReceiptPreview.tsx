import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type React from 'react';
import { FreeMedicationBadge, AdminCallout } from '@/design-system/admin/components';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/features/invoices/history/adminOverlayUi';
import { type ReceiptData } from '../../lib/api';
import { receiptPrintPaperSize } from '../../lib/institutionalReceiptPaper';
import { formatLempirasFromCents, parseCents } from '../../lib/moneyCents';
import { formatLocalizedDateTime } from '../../lib/format/formatDate';
import { receiptPaperPresentation } from '../../modules/receipts/paperPolicy';
import { printReceiptDocument } from '../../printing/browserPrint';

type ReceiptPreviewProps = {
  onNewInvoice?: () => void;
  onPrint?: () => void | Promise<void>;
  receipt: ReceiptData;
};

export function ReceiptPreview({ onNewInvoice, onPrint, receipt }: ReceiptPreviewProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [printError, setPrintError] = useState('');
  const [printPending, setPrintPending] = useState(false);
  const receiptWidth = receiptPrintPaperSize(receipt.width);
  const receiptPresentation = receiptPaperPresentation(receiptWidth);
  const isThermal = receiptWidth === '80mm' || receiptWidth === '58mm';
  const copyLabel = receivedCopyLabel(receipt);
  const customPaper = receiptWidth === 'custom'
    ? customReceiptPaper(receipt.institutional)
    : undefined;

  async function handlePrintClick() {
    setPrintError('');

    try {
      await onPrint?.();
    } catch {
      setPrintError(
        'No se pudo preparar la impresión del recibo. No repita la factura ni el cobro; revise Historial y pida soporte si la impresora no responde.',
      );
      return;

    }

    // The authorized callback may have queued a receipt update (for example the
    // audited REIMPRESIÓN response). Defer the browser print to the next committed
    // render so the printed copy label is the one from the response, never a stale
    // chip; this uses React commit timing, not timers. If the callback never
    // resolves (interactive reprint still pending/cancelled), no print happens.
    setPrintPending(true);
  }

  useLayoutEffect(() => {
    if (!printPending) return;

    setPrintPending(false);

    try {
      printReceiptDocument(receiptWidth);
    } catch {
      setPrintError(
        'No se pudo abrir la ventana de impresión. Verifique la impresora y reimprima desde Historial con motivo cuando el supervisor lo autorice.',
      );
    }
  }, [printPending, receiptWidth]);

  useEffect(() => {
    setPrintError('');
  }, [receipt.invoice.invoice_number]);

  const location = receipt.institutional?.location ?? receipt.hospital.address;
  const taxLabel = `${receipt.invoice.tax_label ?? 'ISV'}${receipt.invoice.tax_rate ? ` ${receipt.invoice.tax_rate}%` : ''}`;

  return (
    <div
      className="receipt-preview-panel text-[length:var(--ui-text-base)] text-[color:var(--ui-ink)]"
      aria-label="Vista previa del comprobante histórico"
    >
      {customPaper ? (
        <style data-receipt-custom-page>{customPaper.pageRule}</style>
      ) : null}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ui-line)] pb-3">
        <p className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
          Copia histórica conservada para consulta.
        </p>
        <div className="receipt-preview-controls" role="group" aria-label="Acciones del comprobante histórico">
          <button type="button" className={`${PRIMARY_BUTTON} min-h-11`} onClick={handlePrintClick}>
            Imprimir
          </button>
          {onNewInvoice ? (
            <button type="button" className={`${SECONDARY_BUTTON} min-h-11`} onClick={onNewInvoice}>
              Nueva operación
            </button>
          ) : null}
        </div>
      </div>

      {printError ? (
        <div className="no-print mb-3">
          <AdminCallout tone="error" title="Impresión no completada">{printError}</AdminCallout>
        </div>
      ) : null}

      <div className="receipt-preview-container bg-[var(--ui-surface-alt)]">
        <div
          ref={receiptRef}
          className={`institutional-receipt ${receiptPresentation.printClass}`}
          style={customPaper?.style}
          aria-label="Comprobante histórico de factura no institucional"
          data-receipt-print-root
        >
          <header className="receipt-header">
            {receipt.institutional?.government_line ? <span>{receipt.institutional.government_line}</span> : null}
            {receipt.institutional?.secretariat_line ? <span>{receipt.institutional.secretariat_line}</span> : null}
            <strong className="hospital-name">{receipt.hospital.name}</strong>
            {location ? <span>{location}</span> : null}
            {receipt.hospital.rtn ? <span>RTN: {receipt.hospital.rtn}</span> : null}
            {receipt.hospital.phone ? <span>Tel. {receipt.hospital.phone}</span> : null}
            {receipt.hospital.slogan ? <span>{receipt.hospital.slogan}</span> : null}
          </header>

          <div className="receipt-rule" aria-hidden="true" />

          <div className="receipt-title-row">
            <h1 className="receipt-title">COMPROBANTE HISTÓRICO DE FACTURA</h1>
          </div>

          {copyLabel ? (
            <div
              className={copyLabel.isReprint ? 'receipt-copy-label receipt-copy-label--reprint' : 'receipt-copy-label'}
              data-receipt-copy-label
              data-receipt-reprint-label={copyLabel.isReprint ? 'true' : undefined}
            >
              {copyLabel.label}
            </div>
          ) : null}


          <p className="receipt-historical-notice">
            No sustituye el recibo institucional.
          </p>

          <table className="receipt-meta-table">
            <tbody>
              <tr>
                <th scope="row">Factura No.</th>
                <td>{receipt.invoice.invoice_number}</td>
                <th scope="row">Fecha</th>
                <td>{formatDate(receipt.invoice.issued_at)}</td>
              </tr>
              <tr>
                <th scope="row">Paciente / enterante</th>
                <td>{receipt.invoice.patient_name}</td>
                <th scope="row">Estado</th>
                <td>{statusLabel(receipt.invoice.status)}</td>
              </tr>
              {receipt.invoice.cashier || receipt.invoice.cash_register_label ? (
                <tr>
                  <th scope="row">Cajero</th>
                  <td>{receipt.invoice.cashier ?? 'No registrado'}</td>
                  <th scope="row">Caja</th>
                  <td>{receipt.invoice.cash_register_label ?? 'No registrada'}</td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <div className="receipt-rule" aria-hidden="true" />

          <table className="receipt-items-table">
            <caption>Detalle de servicios</caption>
            <thead>
              <tr>
                <th scope="col">Concepto / servicio</th>
                <th scope="col" data-numeric="true">Cant.</th>
                {!isThermal ? <th scope="col" data-numeric="true">Precio</th> : null}
                {!isThermal ? <th scope="col" data-numeric="true">{taxLabel}</th> : null}
                <th scope="col" data-numeric="true">Importe</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((item, index) => (
                <tr key={index}>
                  <td><ItemName item={item} /></td>
                  <td data-numeric="true">{item.quantity}</td>
                  {!isThermal ? <td data-numeric="true">{moneyLabel(item.unit_price)}</td> : null}
                  {!isThermal ? <td data-numeric="true">{moneyLabel(item.tax_amount)}</td> : null}
                  <td data-numeric="true"><ItemPrice item={item} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="receipt-summary" data-receipt-summary>
            <div className="receipt-rule" aria-hidden="true" />

            <table className="receipt-totals-table">
              <tbody>
                <ReceiptTotalRow label="Subtotal" value={moneyLabel(receipt.invoice.subtotal)} />
                <ReceiptTotalRow label="Exento" value={moneyLabel(receipt.exempt_amount ?? 0)} />
                {(parseCents(receipt.invoice.discount_amount) ?? 0) > 0 ? (
                  <ReceiptTotalRow label="Descuento" value={moneyLabel(receipt.invoice.discount_amount)} />
                ) : null}
                <ReceiptTotalRow label={taxLabel} value={moneyLabel(receipt.invoice.tax_amount)} />
                <ReceiptTotalRow label="TOTAL" value={moneyLabel(receipt.invoice.total)} strong />
                {(parseCents(receipt.invoice.paid_amount) ?? 0) > 0 ? (
                  <ReceiptTotalRow label="Pagado" value={moneyLabel(receipt.invoice.paid_amount)} />
                ) : null}
                {(parseCents(receipt.invoice.balance_due) ?? 0) > 0 ? (
                  <ReceiptTotalRow label="Saldo" value={moneyLabel(receipt.invoice.balance_due)} />
                ) : null}
              </tbody>
            </table>
            {receipt.amount_words ? (
              <div className="receipt-amount-words">
                <strong>Monto en letras</strong>
                <span>{receipt.amount_words}</span>
              </div>
            ) : null}
          </div>

          {receipt.fiscal.cai || receipt.fiscal.authorized_range || receipt.fiscal.valid_until ? (
            <div className="receipt-fiscal-data">
              {receipt.fiscal.cai ? (
                <>
                  <strong>CAI</strong>
                  <span>{receipt.fiscal.cai}</span>
                </>
              ) : null}
              {receipt.fiscal.authorized_range ? (
                <>
                  <strong>Rango autorizado</strong>
                  <span>{receipt.fiscal.authorized_range}</span>
                </>
              ) : null}
              {receipt.fiscal.valid_until ? (
                <>
                  <strong>Fecha límite de emisión</strong>
                  <span>{formatCalendarDate(receipt.fiscal.valid_until)}</span>
                </>
              ) : null}
            </div>
          ) : null}

          {receipt.payments.length > 0 ? (
            <>
              <div className="receipt-rule" aria-hidden="true" />
              <h2 className="receipt-section-title">Pagos</h2>
              <div className="receipt-items">
                {receipt.payments.map((payment, index) => (
                  <Row key={`${payment.method}-${payment.paid_at}-${payment.reference ?? 'sin-referencia'}-${index}`}>
                    <span>
                      {paymentLabel(payment.method)}
                      {payment.reference ? ` / Ref: ${payment.reference}` : ''}
                      {payment.cashier ? ` / ${payment.cashier}` : ''}
                      {payment.paid_at ? (
                        <><br /><time dateTime={payment.paid_at}>{formatDate(payment.paid_at)}</time></>
                      ) : null}
                    </span>
                    <strong>{moneyLabel(payment.amount)}</strong>
                  </Row>
                ))}
              </div>
            </>
          ) : null}

          <div className="receipt-rule" aria-hidden="true" />

          <footer className="receipt-footer">
            <div className="receipt-signature-line" aria-hidden="true" />
            <span>{receipt.institutional?.signature_label ?? 'Firma y sello del receptor de fondos'}</span>
            {receipt.institutional?.footer_text ? <span>{receipt.institutional.footer_text}</span> : null}
          </footer>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  children,
}: {
  label?: string;
  value?: string;
  strong?: boolean;
  children?: React.ReactNode;
}) {
  if (children) {
    return <div className="receipt-row">{children}</div>;
  }
  return (
    <div className="receipt-row">
      <span className={strong ? 'strong' : ''}>{label}</span>
      <span className={strong ? 'strong' : ''}>{value}</span>
    </div>
  );
}

function ItemName({ item }: { item: ReceiptData['items'][number] }) {
  return (
    <span className="item-name">
      {item.category_name ? <small className="category">{item.category_name}</small> : null}
      <span className="name">{item.service_name}</span>
      {Number(item.quantity) !== 1 ? <span className="qty"> x {item.quantity}</span> : null}
      {item.special_rule_applied ? (
        <FreeMedicationBadge className="special-rule-badge" />
      ) : null}
    </span>
  );
}

function ItemPrice({ item }: { item: ReceiptData['items'][number] }) {
  return <strong className="item-price">{moneyLabel(item.line_total)}</strong>;
}

type ReceivedCopyLabel = {
  label: string;
  isReprint: boolean;
};

/**
 * Secondary compatibility path for historical (non-institutional) invoices.
 *
 * The backend decides the copy semantics and sends them in `copy_label`: the
 * first authorized print/view arrives as "Original" and an explicit legacy
 * reprint arrives as "REIMPRESIÓN #n", numbered from the durable per-invoice
 * counter `invoices.legacy_reprint_count` (T3-004; never from prunable audit
 * logs). This component renders exactly the received label: it never adds a
 * copy legend, never invents nor renumbers a reprint and never marks a first
 * print as a reprint. The institutional receipt PDF is the primary document
 * and keeps its own persistent `REIMPRESIÓN #n` legend.
 */
function receivedCopyLabel(receipt: ReceiptData): ReceivedCopyLabel | null {
  const label = receipt.institutional?.copy_label?.trim();
  if (!label) return null;

  return {
    label,
    isReprint: /reimpresi[oó]n/i.test(label),
  };
}

function customReceiptPaper(
  institutional: ReceiptData['institutional'],
): { pageRule: string; style: React.CSSProperties } | undefined {
  const width = positiveMillimetres(institutional?.paper_width_mm);
  const height = positiveMillimetres(institutional?.paper_height_mm);
  if (width === null || height === null) return undefined;

  return {
    pageRule: `@page receipt-custom { size: ${width}mm ${height}mm; margin: 6mm; }`,
    style: {
      '--receipt-custom-width': `${width}mm`,
      '--receipt-custom-height': `${height}mm`,
    } as React.CSSProperties,
  };
}

function positiveMillimetres(value: string | null | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function ReceiptTotalRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <tr className={strong ? 'strong' : undefined}>
      <th scope="row">{label}</th>
      <td data-numeric="true">{value}</td>
    </tr>
  );
}

function moneyLabel(value: string | number | null | undefined): string {
  const cents = parseCents(value);
  // Receipt-surface contract: a missing/invalid amount must never be painted as
  // a legitimate zero. `formatLempirasFromCents(null)` still yields "L. 0.00"
  // (owned by hs-frontend), so the receipt surface guards here and shows a
  // neutral placeholder instead.
  return cents === null ? '—' : formatLempirasFromCents(cents);
}

function formatDate(value: string): string {
  // The receipt sometimes shows calendar dates as YYYY-MM-DD (no time).
  // The shared helper would render them as midnight, so we lift them
  // back to local-noon to avoid the day rolling back in some timezones.
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  return formatLocalizedDateTime(normalizedValue);
}

function formatCalendarDate(value: string): string {
  const calendarDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return calendarDate
    ? `${calendarDate[3]}/${calendarDate[2]}/${calendarDate[1]}`
    : formatDate(value);
}

function paymentLabel(method?: ReceiptData['payments'][number]['method']): string {
  const labels: Record<NonNullable<ReceiptData['payments'][number]['method']>, string> = {
    cash: 'Efectivo',
    transfer: 'Transferencia',
    card: 'Tarjeta',
    other: 'Otro',
  };
  return method ? labels[method] : 'Pendiente';
}

function statusLabel(status: ReceiptData['invoice']['status']): string {
  return {
    issued: 'Emitida',
    partial: 'Parcial',
    paid: 'Pagada',
    void: 'Anulada',
  }[status] ?? status;
}
