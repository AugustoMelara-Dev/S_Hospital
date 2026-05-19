import { useRef } from 'react';
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
  onNewInvoice?: () => void;
  onPrint?: () => void;
  receipt: ReceiptData;
  onWidthChange: (width: ReceiptData['width']) => void;
};

export function ReceiptPreview({ onNewInvoice, onPrint, receipt, onWidthChange }: ReceiptPreviewProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
  });

  function handlePrintClick() {
    printReceiptDocument(receipt.width, () => {
      if (!navigator.userAgent.toLowerCase().includes('jsdom')) {
        handlePrint();
      }
      onPrint?.();
    });
  }

  return (
    <div className="receipt-preview-panel" aria-label="Vista previa del recibo">
      <div className="receipt-preview-controls no-print">
        <Select value={receipt.width} onValueChange={(v) => onWidthChange(v as ReceiptData['width'])}>
          <SelectTrigger aria-label="Ancho del recibo" className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="80mm">80mm</SelectItem>
            <SelectItem value="58mm">58mm</SelectItem>
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
        <div ref={receiptRef} className={`thermal-receipt receipt-${receipt.width}`} aria-label="Recibo termico">
          <header className="receipt-header">
            <strong className="hospital-name">{receipt.hospital.name}</strong>
            <span>Tocoa, Colon, Honduras</span>
            {receipt.hospital.rtn && <span>RTN: {receipt.hospital.rtn}</span>}
          </header>

          <div className="receipt-rule" aria-hidden="true" />

          <h1 className="receipt-title">FACTURA / RECIBO</h1>

          <div className="receipt-meta">
            <Row label="No." value={receipt.invoice.invoice_number} />
            <Row label="Fecha" value={formatDate(receipt.invoice.issued_at)} />
            <Row label="Paciente" value={receipt.invoice.patient_name} />
            {receipt.invoice.cashier && <Row label="Cajero" value={receipt.invoice.cashier} />}
            <Row label="Estado" value={statusLabel(receipt.invoice.status)} />
            <Row label="CAI" value={receipt.fiscal.cai ?? 'CAI no configurado'} />
            {receipt.fiscal.authorized_range && <Row label="Rango" value={receipt.fiscal.authorized_range} />}
            {receipt.fiscal.valid_until && (
              <Row label="Vence" value={formatDate(receipt.fiscal.valid_until)} />
            )}
          </div>

          <div className="receipt-rule" aria-hidden="true" />

          <div className="receipt-table-head">
            <span>Servicio</span>
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
            <Row label="ISV 15%" value={`L. ${receipt.invoice.tax_amount}`} />
            <Row label="TOTAL" value={`L. ${receipt.invoice.total}`} strong />
            {Number(receipt.invoice.paid_amount) > 0 && (
              <Row label="Pagado" value={`L. ${receipt.invoice.paid_amount}`} />
            )}
            {Number(receipt.invoice.balance_due) > 0 && (
              <Row label="Saldo" value={`L. ${receipt.invoice.balance_due}`} />
            )}
          </div>

          {receipt.payments.length > 0 && (
            <>
              <div className="receipt-rule" aria-hidden="true" />
              <h2 className="receipt-section-title">PAGOS</h2>
              <div className="receipt-items">
                {receipt.payments.map((payment) => (
                  <Row key={payment.id}>
                    <span>
                      {paymentLabel(payment.method)}
                      {payment.reference && ` / Ref: ${payment.reference}`}
                      {payment.cashier && ` / ${payment.cashier}`}
                    </span>
                    <strong>L. {payment.amount}</strong>
                  </Row>
                ))}
              </div>
            </>
          )}

          <div className="receipt-rule" aria-hidden="true" />

          <footer className="receipt-footer">
            <span>Gracias por su visita</span>
            <span>Conserve su factura</span>
            <span>La factura es beneficio de todos, exijalo.</span>
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
      {item.category_name && <small className="category">{item.category_name}</small>}
      <span className="name">{item.service_name}</span>
      {Number(item.quantity) !== 1 && <span className="qty"> x {item.quantity}</span>}
      {item.special_rule_applied && (
        <Badge variant="secondary" className="special-rule-badge">Regla</Badge>
      )}
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
