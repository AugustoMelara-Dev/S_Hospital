import { useEffect, useRef, useState } from 'react';
import type React from 'react';
import { useReactToPrint } from 'react-to-print';
import { Alert } from '../../components/ui/alert';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { type ReceiptData } from '../../lib/api';
import { institutionalReceiptPaperSize } from '../../lib/institutionalReceiptPaper';
import { formatLempirasFromCents, parseCents } from '../../lib/moneyCents';
import { formatLocalizedDateTime } from '../../lib/format/formatDate';

type ReceiptPreviewProps = {
  autoPrint?: boolean;
  onNewInvoice?: () => void;
  onPrint?: () => void | Promise<void>;
  receipt: ReceiptData;
};

export function ReceiptPreview({ autoPrint = false, onNewInvoice, onPrint, receipt }: ReceiptPreviewProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const autoPrintedReceiptRef = useRef<string | null>(null);
  const [printError, setPrintError] = useState('');
  const receiptWidth = institutionalReceiptPaperSize(receipt.width);
  const receiptWidthClass = receiptWidth.replace('_', '-');

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
  });

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

    try {
      printReceiptDocument(receiptWidth, () => {
        if (!navigator.userAgent.toLowerCase().includes('jsdom')) {
          handlePrint();
        }
      });
    } catch {
      setPrintError(
        'No se pudo abrir la ventana de impresión. Verifique la impresora y reimprima desde Historial con motivo cuando el supervisor lo autorice.',
      );
    }

  }

  useEffect(() => {
    if (!autoPrint || autoPrintedReceiptRef.current === receipt.invoice.invoice_number) {
      return;
    }

    autoPrintedReceiptRef.current = receipt.invoice.invoice_number;
    window.setTimeout(() => {
      void handlePrintClick();
    }, 150);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint, receipt.invoice.invoice_number]);

  const location = receipt.institutional?.location ?? receipt.hospital.address;
  const taxLabel = `${receipt.invoice.tax_label ?? 'ISV'}${receipt.invoice.tax_rate ? ` ${receipt.invoice.tax_rate}%` : ''}`;

  return (
    <div className="receipt-preview-panel" aria-label="Vista previa del recibo">
      <div className="receipt-preview-controls no-print">
        <Button type="button" onClick={handlePrintClick}>
          Imprimir
        </Button>
        {onNewInvoice ? (
          <Button type="button" variant="secondary" onClick={onNewInvoice}>
            Nueva factura
          </Button>
        ) : null}
      </div>

      {printError ? (
        <div className="no-print mb-3">
          <Alert variant="warning" title="Impresión no completada">
            {printError}
          </Alert>
        </div>
      ) : null}

      <div className="receipt-preview-container">
        <div
          ref={receiptRef}
          className={`institutional-receipt receipt-${receiptWidthClass}`}
          aria-label="Recibo institucional"
          data-receipt-print-root
        >
          <header className="receipt-header">
            {receipt.institutional?.government_line ? <span>{receipt.institutional.government_line}</span> : null}
            {receipt.institutional?.secretariat_line ? <span>{receipt.institutional.secretariat_line}</span> : null}
            <strong className="hospital-name">{receipt.hospital.name}</strong>
            {location ? <span>{location}</span> : null}
            {receipt.hospital.rtn ? <span>RTN: {receipt.hospital.rtn}</span> : null}
            {receipt.hospital.slogan ? <span>{receipt.hospital.slogan}</span> : null}
          </header>

          <div className="receipt-rule" aria-hidden="true" />

          <div className="receipt-title-row">
            <h1 className="receipt-title">RECIBO INSTITUCIONAL</h1>
            <span>{receipt.institutional?.copy_label ?? 'Original'}</span>
          </div>

          <table className="receipt-meta-table">
            <tbody>
              <tr>
                <th scope="row">Serie / No.</th>
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
              {receipt.invoice.cashier ? (
                <tr>
                  <th scope="row">Cajero</th>
                  <td colSpan={3}>{receipt.invoice.cashier}</td>
                </tr>
              ) : null}
              <tr>
                <th scope="row">CAI</th>
                <td>{receipt.fiscal.cai ?? 'Configuración pendiente'}</td>
                <th scope="row">Vence</th>
                <td>{receipt.fiscal.valid_until ? formatDate(receipt.fiscal.valid_until) : 'Configuración pendiente'}</td>
              </tr>
              <tr>
                <th scope="row">Rango</th>
                <td colSpan={3}>{receipt.fiscal.authorized_range ?? 'Configuración pendiente'}</td>
              </tr>
            </tbody>
          </table>

          <div className="receipt-rule" aria-hidden="true" />

          <table className="receipt-items-table">
            <caption>Detalle de servicios</caption>
            <thead>
              <tr>
                <th scope="col">Concepto / servicio</th>
                <th scope="col" data-numeric="true">Cant.</th>
                <th scope="col" data-numeric="true">Precio</th>
                <th scope="col" data-numeric="true">{taxLabel}</th>
                <th scope="col" data-numeric="true">Importe</th>
              </tr>
            </thead>
            <tbody>
              {receipt.items.map((item, index) => (
                <tr key={index}>
                  <td><ItemName item={item} /></td>
                  <td data-numeric="true">{item.quantity}</td>
                  <td data-numeric="true">{moneyLabel(item.unit_price)}</td>
                  <td data-numeric="true">{moneyLabel(item.tax_amount)}</td>
                  <td data-numeric="true"><ItemPrice item={item} /></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="receipt-rule" aria-hidden="true" />

          <table className="receipt-totals-table">
            <tbody>
              <ReceiptTotalRow label="Subtotal" value={moneyLabel(receipt.invoice.subtotal)} />
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
        <Badge variant="secondary" className="special-rule-badge">Regla</Badge>
      ) : null}
    </span>
  );
}

function ItemPrice({ item }: { item: ReceiptData['items'][number] }) {
  return <strong className="item-price">{moneyLabel(item.line_total)}</strong>;
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
  return formatLempirasFromCents(parseCents(value));
}

function formatDate(value: string): string {
  // The receipt sometimes shows calendar dates as YYYY-MM-DD (no time).
  // The shared helper would render them as midnight, so we lift them
  // back to local-noon to avoid the day rolling back in some timezones.
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  return formatLocalizedDateTime(normalizedValue);
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

function printReceiptDocument(width: ReceiptData['width'], print: () => void) {
  const previousWidth = document.body.dataset.receiptWidth;
  const previousPrinting = document.body.dataset.printingReceipt;

  function restorePrintState() {
    if (previousWidth) {
      document.body.dataset.receiptWidth = previousWidth;
    } else {
      delete document.body.dataset.receiptWidth;
    }

    if (previousPrinting) {
      document.body.dataset.printingReceipt = previousPrinting;
    } else {
      delete document.body.dataset.printingReceipt;
    }
  }

  document.body.dataset.receiptWidth = width;
  document.body.dataset.printingReceipt = 'true';

  try {
    print();
  } catch (error) {
    restorePrintState();
    throw error;
  } finally {
    restorePrintState();
  }
}
