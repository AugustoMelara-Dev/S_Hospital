import { useEffect, useRef } from 'react';
import type React from 'react';
import { useReactToPrint } from 'react-to-print';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { type ReceiptData } from '../../lib/api';

type ReceiptPreviewProps = {
  autoPrint?: boolean;
  onNewInvoice?: () => void;
  onPrint?: () => void;
  receipt: ReceiptData;
  onWidthChange: (width: ReceiptData['width']) => void;
};

const CONFIGURATION_PENDING = 'Configuración pendiente';

export function ReceiptPreview({ autoPrint = false, onNewInvoice, onPrint, receipt, onWidthChange }: ReceiptPreviewProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const autoPrintedReceiptRef = useRef<string | null>(null);
  const paperSize = receipt.width;

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
  });

  function handlePrintClick() {
    printReceiptDocument(paperSize, () => {
      if (!navigator.userAgent.toLowerCase().includes('jsdom')) {
        handlePrint();
      }
      onPrint?.();
    });
  }

  useEffect(() => {
    if (!autoPrint || autoPrintedReceiptRef.current === receipt.invoice.invoice_number) {
      return;
    }

    autoPrintedReceiptRef.current = receipt.invoice.invoice_number;
    window.setTimeout(handlePrintClick, 150);
  }, [autoPrint, receipt.invoice.invoice_number]);

  const location = receipt.institutional?.location ?? receipt.hospital.address;
  const taxLabel = `${receipt.invoice.tax_label ?? 'ISV'}${receipt.invoice.tax_rate ? ` ${receipt.invoice.tax_rate}%` : ''}`;

  return (
    <div className="receipt-preview-panel" aria-label="Vista previa del recibo">
      <div className="receipt-preview-controls no-print">
        <Select value={paperSize} onValueChange={(v) => onWidthChange(v as ReceiptData['width'])}>
          <SelectTrigger aria-label="Tamano del recibo" className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="half_letter">Media carta</SelectItem>
            <SelectItem value="letter">Carta</SelectItem>
            <SelectItem value="a5">A5</SelectItem>
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

      <div className="receipt-preview-container">
        <div ref={receiptRef} className={`institutional-receipt receipt-${paperSize}`} aria-label="Recibo institucional">
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
            <span>{receipt.institutional?.copy_label ?? 'Original'}</span>
          </div>

          <div className="receipt-meta">
            <Row label="Serie / No." value={receipt.invoice.invoice_number} />
            <Row label="Fecha" value={formatDate(receipt.invoice.issued_at)} />
            <Row label="Paciente / enterante" value={receipt.invoice.patient_name} />
            {receipt.invoice.cashier ? <Row label="Cajero" value={receipt.invoice.cashier} /> : null}
            <Row label="Estado" value={statusLabel(receipt.invoice.status)} />
            <Row label="CAI" value={configuredValue(receipt.fiscal.cai)} />
            <Row label="Rango autorizado" value={configuredValue(receipt.fiscal.authorized_range)} />
            <Row label="Fecha limite" value={receipt.fiscal.valid_until ? formatDate(receipt.fiscal.valid_until) : CONFIGURATION_PENDING} />
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
            <Row label="Subtotal" value={`L. ${receipt.invoice.subtotal}`} />
            <Row label={taxLabel} value={`L. ${receipt.invoice.tax_amount}`} />
            <Row label="Valor en lempiras" value={`L. ${receipt.invoice.total}`} />
            <Row label="TOTAL" value={`L. ${receipt.invoice.total}`} strong />
            {Number(receipt.invoice.paid_amount) > 0 ? (
              <Row label="Pagado" value={`L. ${receipt.invoice.paid_amount}`} />
            ) : null}
            {Number(receipt.invoice.balance_due) > 0 ? (
              <Row label="Saldo" value={`L. ${receipt.invoice.balance_due}`} />
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
                    <strong>L. {payment.amount}</strong>
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
  return <strong className="item-price">L. {item.line_total}</strong>;
}

function formatDate(value: string): string {
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;
  return new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(normalizedValue));
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

function configuredValue(value: string | null | undefined): string {
  return value && value.trim() !== '' ? value : CONFIGURATION_PENDING;
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
  document.body.dataset.receiptWidth = width;
  document.body.dataset.printingReceipt = 'true';
  print();

  window.setTimeout(() => {
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
  }, 1000);
}
