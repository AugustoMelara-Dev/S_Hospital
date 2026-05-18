import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Select } from '../../components/ui/select';
import { type ReceiptData } from '../../lib/api';

type ReceiptPreviewProps = {
  receipt: ReceiptData;
  onWidthChange: (width: ReceiptData['width']) => void;
  onPrint?: () => void;
};

export function ReceiptPreview({ receipt, onWidthChange, onPrint }: ReceiptPreviewProps) {
  function printReceipt() {
    const previousWidth = document.body.dataset.receiptWidth;
    document.body.dataset.receiptWidth = receipt.width;
    (onPrint ?? (() => window.print()))();

    if (previousWidth) {
      document.body.dataset.receiptWidth = previousWidth;
    } else {
      delete document.body.dataset.receiptWidth;
    }
  }

  return (
    <Card className="receipt-preview-panel" aria-labelledby="receipt-title">
      <CardHeader className="print-hidden md:flex-row md:items-end md:justify-between">
        <div>
          <CardDescription>Documento fiscal</CardDescription>
          <CardTitle id="receipt-title">Preview termico</CardTitle>
        </div>
        <div className="receipt-actions">
          <Select
            aria-label="Ancho del recibo"
            value={receipt.width}
            onChange={(event) => onWidthChange(event.target.value as ReceiptData['width'])}
          >
            <option value="80mm">80mm</option>
            <option value="58mm">58mm</option>
          </Select>
          <Button type="button" onClick={printReceipt}>
            Imprimir
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex justify-center">
        <article className={`thermal-receipt receipt-${receipt.width}`} aria-label="Recibo termico">
        <header>
          <strong>{receipt.hospital.name}</strong>
          <span>Tocoa, Colon, Honduras</span>
          {receipt.hospital.rtn ? <span>RTN: {receipt.hospital.rtn}</span> : null}
          {receipt.fiscal.valid_until ? <span>Fecha limite {formatDate(receipt.fiscal.valid_until)}</span> : null}
        </header>

        <div className="receipt-rule" aria-hidden="true" />
        <h3>FACTURA / RECIBO</h3>

        <div className="receipt-meta-grid">
          <span>No.</span>
          <strong>{receipt.invoice.invoice_number}</strong>
          <span>Fecha</span>
          <strong>{formatDate(receipt.invoice.issued_at)}</strong>
          <span>Paciente</span>
          <strong>{receipt.invoice.patient_name}</strong>
          <span>Pago</span>
          <strong>{paymentLabel(receipt.payments[receipt.payments.length - 1]?.method)}</strong>
          <span>CAI</span>
          <strong>{receipt.fiscal.cai ?? 'PENDIENTE-CONFIGURAR'}</strong>
        </div>

        <div className="receipt-rule" aria-hidden="true" />
        <div className="receipt-table-head">
          <strong>Servicio</strong>
          <strong>Valor</strong>
        </div>
        <div className="receipt-rule solid" aria-hidden="true" />

        <div className="receipt-items">
          {receipt.items.map((item, index) => (
            <div key={`${item.service_name}-${index}`}>
              <span>
                {item.category_name ? <small>{item.category_name}</small> : null}
                {item.service_name}
                {Number(item.quantity) !== 1 ? ` x ${item.quantity}` : ''}
                {item.special_rule_applied ? <Badge variant="secondary">Regla aplicada</Badge> : null}
              </span>
              <strong>L. {item.line_total}</strong>
            </div>
          ))}
        </div>

        <div className="receipt-rule solid" aria-hidden="true" />
        <dl className="receipt-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>L. {receipt.invoice.subtotal}</dd>
          </div>
          <div>
            <dt>ISV</dt>
            <dd>L. {receipt.invoice.tax_amount}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>L. {receipt.invoice.total}</dd>
          </div>
        </dl>

        <div className="receipt-rule" aria-hidden="true" />
        <footer>
          <span>Gracias por su visita</span>
          <span>Conserve su factura</span>
          <span>La factura es beneficio de todos, exigala.</span>
        </footer>
        </article>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string): string {
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;

  return new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(normalizedValue));
}

function paymentLabel(method?: ReceiptData['payments'][number]['method']): string {
  const labels: Record<ReceiptData['payments'][number]['method'], string> = {
    cash: 'Efectivo',
    transfer: 'Transferencia',
    card: 'Tarjeta',
    other: 'Otro',
  };

  return method ? labels[method] : 'Pendiente';
}
