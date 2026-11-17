import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { CircleAlert, CircleCheck, FileText, Plus, RotateCcw } from 'lucide-react';
import { PAYMENT_METHOD_LABEL, type Invoice, type Payment, type ReceiptSummary } from '@/api/types';
import { Button, Card, Kbd, Money } from '@/ui';
import { ReceiptButtons } from '@/features/recibos/components/ReceiptButtons';

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="text-[14px] text-ink">{children}</dd>
    </div>
  );
}

const newOpButton = (onNew: () => void) => (
  <Button leftIcon={<Plus />} onClick={onNew} rightIcon={<Kbd className="ml-1">F2</Kbd>}>
    Nueva operación
  </Button>
);

/** "Operación cobrada": documento, paciente, total, método, cambio + receipt actions. */
export function ChargedPanel({
  invoice,
  payment,
  receipt,
  receiptError = null,
  onNew,
}: {
  invoice: Invoice;
  payment: Payment | null;
  receipt: ReceiptSummary | null;
  /** Set when the payment posted but the institutional receipt could not be issued. */
  receiptError?: string | null;
  onNew: () => void;
}) {
  const noCharge = invoice.total_cents === 0;
  return (
    <Card className="anim-pop-in mx-auto w-full max-w-[640px]">
      <div className="flex flex-col gap-5" role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-ok-soft text-ok [&_svg]:size-5">
            <CircleCheck aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <h2 className="text-[18px] font-semibold text-ink">{noCharge ? 'Operación emitida sin cobro' : 'Operación cobrada'}</h2>
            <p className="text-[13px] text-ink-2">
              {receipt ? (
                <>
                  Recibo <span className="num">{receipt.number_full}</span> listo para imprimir.
                </>
              ) : (
                receiptError || 'El recibo institucional aún no está disponible.'
              )}
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-[var(--radius-sm)] border border-line bg-surface-2/50 p-4 sm:grid-cols-3">
          <Item label="Documento">
            <span className="num font-medium">{invoice.number}</span>
          </Item>
          <Item label="Paciente">{invoice.patient_name}</Item>
          <Item label="Total">
            <Money cents={invoice.total_cents} className="font-semibold" />
          </Item>
          {payment && <Item label="Método">{PAYMENT_METHOD_LABEL[payment.method]}</Item>}
          {payment?.method === 'cash' && (
            <Item label="Cambio">
              <Money cents={payment.change_cents ?? 0} className="text-[18px] font-semibold" />
            </Item>
          )}
          {payment?.reference && (
            <Item label="Referencia">
              <span className="num">{payment.reference}</span>
            </Item>
          )}
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          {receipt ? (
            <ReceiptButtons receipt={receipt} primary />
          ) : (
            <Link
              to={`/recibos/${invoice.id}`}
              className="pressable inline-flex h-9 items-center gap-2 rounded-[var(--radius-sm)] border border-line bg-surface px-3.5 text-sm font-medium text-ink hover:bg-surface-2 [&_svg]:size-4"
            >
              <FileText aria-hidden="true" />
              Ver documento
            </Link>
          )}
          <span className="flex-1" />
          {newOpButton(onNew)}
        </div>
      </div>
    </Card>
  );
}

/** Invoice issued but the payment failed: "Emitido pendiente de cobro" + retry. */
export function PendingPanel({
  invoice,
  error,
  onRetry,
  onNew,
}: {
  invoice: Invoice;
  error: string;
  onRetry: () => void;
  onNew: () => void;
}) {
  return (
    <Card className="anim-pop-in mx-auto w-full max-w-[640px]">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-warn-soft text-warn [&_svg]:size-5">
            <CircleAlert aria-hidden="true" />
          </span>
          <div className="flex flex-col">
            <h2 className="text-[18px] font-semibold text-ink">Emitido pendiente de cobro</h2>
            <p className="text-[13px] text-ink-2">La factura se emitió, pero el cobro no se registró.</p>
          </div>
        </div>
        <p role="alert" className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-[var(--radius-sm)] border border-line bg-surface-2/50 p-4 sm:grid-cols-3">
          <Item label="Documento">
            <span className="num font-medium">{invoice.number}</span>
          </Item>
          <Item label="Paciente">{invoice.patient_name}</Item>
          <Item label="Saldo">
            <Money cents={invoice.balance_cents} className="font-semibold" />
          </Item>
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" leftIcon={<RotateCcw />} onClick={onRetry}>
            Cobrar pendiente
          </Button>
          <Link
            to={`/recibos/${invoice.id}`}
            className="pressable inline-flex h-9 items-center rounded-[var(--radius-sm)] px-3.5 text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            Ver en Recibos
          </Link>
          <span className="flex-1" />
          {newOpButton(onNew)}
        </div>
      </div>
    </Card>
  );
}
