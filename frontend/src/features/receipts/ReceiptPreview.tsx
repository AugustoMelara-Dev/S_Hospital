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
    <section className="receipt-preview-panel" aria-labelledby="receipt-title">
      <div className="section-heading print-hidden">
        <div>
          <p className="app-kicker">Recibo MVP</p>
          <h2 id="receipt-title">Preview termico</h2>
        </div>
        <div className="receipt-actions">
          <select
            aria-label="Ancho del recibo"
            value={receipt.width}
            onChange={(event) => onWidthChange(event.target.value as ReceiptData['width'])}
          >
            <option value="80mm">80mm</option>
            <option value="58mm">58mm</option>
          </select>
          <button type="button" onClick={printReceipt}>
            Imprimir
          </button>
        </div>
      </div>

      <article className={`thermal-receipt receipt-${receipt.width}`} aria-label="Recibo termico">
        <header>
          <strong>{receipt.hospital.name}</strong>
          {receipt.hospital.rtn ? <span>RTN {receipt.hospital.rtn}</span> : null}
          {receipt.fiscal.cai ? <span>CAI {receipt.fiscal.cai}</span> : null}
          {receipt.fiscal.authorized_range ? <span>Rango {receipt.fiscal.authorized_range}</span> : null}
          {receipt.fiscal.valid_until ? (
            <span>Fecha limite {formatDate(receipt.fiscal.valid_until)}</span>
          ) : null}
        </header>

        <div className="receipt-lines">
          <span>Factura {receipt.invoice.invoice_number}</span>
          <span>Fecha {formatDate(receipt.invoice.issued_at)}</span>
          <span>Cajero {receipt.invoice.cashier ?? 'No registrado'}</span>
          <span>Paciente {receipt.invoice.patient_name}</span>
        </div>

        <div className="receipt-items">
          {receipt.items.map((item, index) => (
            <div key={`${item.service_name}-${index}`}>
              <span>{item.quantity} x {item.service_name}</span>
              <strong>L. {item.line_total}</strong>
              {item.special_rule_applied ? <small>Regla aplicada</small> : null}
            </div>
          ))}
        </div>

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
          <div>
            <dt>Pagado</dt>
            <dd>L. {receipt.invoice.paid_amount}</dd>
          </div>
          <div>
            <dt>Saldo</dt>
            <dd>L. {receipt.invoice.balance_due}</dd>
          </div>
        </dl>

        <footer>
          {receipt.payments.map((payment) => (
            <span key={payment.id}>
              {payment.method} L. {payment.amount}
            </span>
          ))}
          <strong>Gracias por su visita</strong>
        </footer>
      </article>
    </section>
  );
}

function formatDate(value: string): string {
  const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value;

  return new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(normalizedValue));
}
