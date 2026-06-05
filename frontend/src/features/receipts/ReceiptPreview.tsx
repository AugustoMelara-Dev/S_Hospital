import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { useReactToPrint } from 'react-to-print';
import { Alert } from '../../components/ui/alert';
import { Button } from '../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { type ReceiptData } from '../../lib/api';
import { INSTITUTIONAL_RECEIPT_PAPER_OPTIONS, institutionalReceiptPaperSize } from '../../lib/institutionalReceiptPaper';
import { formatLempirasFromCents, parseCents } from '../../lib/moneyCents';
import { formatLocalizedDateTime } from '../../lib/format/formatDate';

type ReceiptPreviewProps = {
  autoPrint?: boolean;
  onNewInvoice?: () => void;
  onPrint?: () => void | Promise<void>;
  receipt: ReceiptData;
  onWidthChange: (width: ReceiptData['width']) => void;
};

export function ReceiptPreview({ autoPrint = false, onNewInvoice, onPrint, receipt, onWidthChange }: ReceiptPreviewProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const autoPrintedReceiptRef = useRef<string | null>(null);
  const [printError, setPrintError] = useState('');
  const receiptWidth = institutionalReceiptPaperSize(receipt.width);

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
  });

  const handlePrintClick = useCallback(async () => {
    setPrintError('');

    try {
      await onPrint?.();
    } catch {
      setPrintError(
        'No se pudo preparar la impresion del recibo. No repita la factura ni el cobro; revise Historial y pida soporte si la impresora no responde.',
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
        'No se pudo abrir la ventana de impresion. Verifique la impresora y reimprima desde Historial con motivo cuando el supervisor lo autorice.',
      );
    }
  }, [handlePrint, onPrint, receiptWidth]);

  useEffect(() => {
    if (!autoPrint || autoPrintedReceiptRef.current === receipt.invoice.invoice_number) {
      return;
    }

    autoPrintedReceiptRef.current = receipt.invoice.invoice_number;
    window.setTimeout(() => {
      void handlePrintClick();
    }, 150);
  }, [autoPrint, handlePrintClick, receipt.invoice.invoice_number]);

  const location = receipt.institutional?.location ?? receipt.hospital.address;
  const taxLabel = `${receipt.invoice.tax_label ?? 'ISV'}${receipt.invoice.tax_rate ? ` ${receipt.invoice.tax_rate}%` : ''}`;

  return (
    <div className="receipt-preview-panel" aria-label="Vista previa del recibo">
      <div className="receipt-preview-controls no-print">
        <Select value={receiptWidth} onValueChange={(v) => onWidthChange(institutionalReceiptPaperSize(v))}>
          <SelectTrigger aria-label="Tamano del recibo" className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INSTITUTIONAL_RECEIPT_PAPER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <Alert variant="warning" title="Impresion no completada">
            {printError}
          </Alert>
        </div>
      ) : null}

      <div className="receipt-preview-container">
        <div ref={receiptRef} className={`institutional-receipt receipt-${receiptWidth}`} aria-label="Recibo institucional">
          <header className="receipt-header">
            <span>{receipt.institutional?.government_line ?? 'Gobierno de Honduras'}</span>
            <span>{receipt.institutional?.secretariat_line ?? 'Secretaria de Salud Publica'}</span>
            <strong className="hospital-name">{receipt.hospital.name}</strong>
            {location ? <span>{location}</span> : null}
            {receipt.hospital.rtn ? <span>RTN: {receipt.hospital.rtn}</span> : null}
            {receipt.hospital.slogan ? <span>{receipt.hospital.slogan}</span> : null}
          </header>

          <div className="receipt-rule" aria-hidden="true" />

          <div className="receipt-title-row">
            <h1 className="receipt-title">RECIBO INSTITUCIONAL</h1>
            <span>{receipt.institutional?.copy_label ?? 'Original / Copia'}</span>
          </div>

          <div className="receipt-meta">
            <Row label="Serie / No." value={receipt.invoice.invoice_number} />
            <Row label="Fecha" value={formatDate(receipt.invoice.issued_at)} />
            <Row label="Paciente / enterante" value={receipt.invoice.patient_name} />
            {receipt.invoice.cashier ? <Row label="Cajero" value={receipt.invoice.cashier} /> : null}
            <Row label="Estado" value={statusLabel(receipt.invoice.status)} />
            <Row label="CAI" value={receipt.fiscal.cai ?? 'Pendiente de configurar'} />
            {receipt.fiscal.authorized_range ? <Row label="Rango" value={receipt.fiscal.authorized_range} /> : null}
            {receipt.fiscal.valid_until ? <Row label="Vence" value={formatDate(receipt.fiscal.valid_until)} /> : null}
          </div>

          <div className="receipt-rule" aria-hidden="true" />

          <div className="receipt-table-head">
            <span>Concepto / servicio</span>
            <span>Valor</span>
          </div>

          <div className="receipt-items">
            {receipt.items.map((item, index) => (
              <Row key={index}>
                <ItemName item={item} />
                <ItemPrice item={item} />
              </Row>
            ))}
          </div>

          <div className="receipt-rule" aria-hidden="true" />

          <div className="receipt-totals">
            <Row label="Subtotal" value={moneyLabel(receipt.invoice.subtotal)} />
            <Row label={taxLabel} value={moneyLabel(receipt.invoice.tax_amount)} />
            <Row label="TOTAL" value={moneyLabel(receipt.invoice.total)} strong />
            {receipt.invoice.total_in_words ? (
              <Row label="Valor en lempiras" value={receipt.invoice.total_in_words} />
            ) : null}
            {(parseCents(receipt.invoice.paid_amount) ?? 0) > 0 ? (
              <Row label="Pagado" value={moneyLabel(receipt.invoice.paid_amount)} />
            ) : null}
            {(parseCents(receipt.invoice.balance_due) ?? 0) > 0 ? (
              <Row label="Saldo" value={moneyLabel(receipt.invoice.balance_due)} />
            ) : null}
          </div>

          {receipt.payments.length > 0 ? (
            <>
              <div className="receipt-rule" aria-hidden="true" />
              <h2 className="receipt-section-title">Pagos</h2>
              <div className="receipt-items">
                {receipt.payments.map((payment) => (
                  <Row key={payment.id}>
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
    </span>
  );
}

function ItemPrice({ item }: { item: ReceiptData['items'][number] }) {
  return <strong className="item-price">{moneyLabel(item.line_total)}</strong>;
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
  }

  window.setTimeout(restorePrintState, 1000);
}
