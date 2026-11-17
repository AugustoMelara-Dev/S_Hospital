import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { FileText, Plus, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatCents } from '@/lib/money';
import { PAYMENT_METHOD_LABEL, type Invoice, type Payment, type ReceiptSummary } from '@/api/types';
import { Button, StatusGlyph } from '@/ui';
import { ReceiptButtons } from '@/features/recibos/components/ReceiptButtons';

/** One cell of the ledger grid (label over value, ruled by juntas). */
function Cell({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1 bg-surface px-4 py-3', className)}>
      <dt className="text-[12px] leading-4 font-semibold text-ink-2">{label}</dt>
      <dd className="min-w-0 text-[15px] leading-5 break-words text-ink">{children}</dd>
    </div>
  );
}

const ledger = 'grid overflow-hidden border-y border-junta bg-junta [gap:1px]';

const newOpButton = (onNew: () => void) => (
  <Button size="lg" leftIcon={<Plus />} onClick={onNew} kbd="F2" aria-keyshortcuts="F2">
    Nueva operación
  </Button>
);

/** Document masthead: state line, the document number as the headline, patient. */
function Masthead({ glyph, tone, heading, invoice, note }: { glyph: 'filled' | 'hollow'; tone: string; heading: string; invoice: Invoice; note: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-6 pt-5 pb-5">
      <h2 className="flex items-center gap-2 text-[15px] leading-5 font-bold text-ink">
        <StatusGlyph shape={glyph} className={cn('size-3', tone)} />
        {heading}
      </h2>
      <p className="num text-[40px] leading-[44px] font-bold tracking-[-0.01em] text-ink">{invoice.number}</p>
      <p className="text-[13.5px] leading-5 text-ink-2">{note}</p>
    </div>
  );
}

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
  const cash = payment?.method === 'cash';
  const extras = (cash && payment.received_cents != null ? 1 : 0) + (payment?.reference ? 1 : 0);
  return (
    <section className="anim-pop-in mx-auto w-full max-w-[880px] overflow-hidden rounded-[var(--radius-md)] border border-junta bg-surface">
      <div role="status" aria-live="polite" className="flex flex-col">
        <div className="grid md:grid-cols-[minmax(0,1fr)_300px]">
          <Masthead
            glyph="filled"
            tone="text-ok"
            heading={noCharge ? 'Operación emitida sin cobro' : 'Operación cobrada'}
            invoice={invoice}
            note={
              receipt ? (
                <>
                  Recibo <span className="num font-semibold text-ink">{receipt.number_full}</span> listo para imprimir.
                </>
              ) : (
                receiptError || 'El recibo institucional aún no está disponible.'
              )
            }
          />
          {cash && (
            <div className="flex flex-col justify-end gap-1 border-t border-junta bg-surface-2 px-6 py-5 text-right text-ink md:border-t-0 md:border-l">
              <span className="text-[13px] font-bold tracking-[0.06em] text-ink-2 uppercase">Cambio</span>
              <span className="num text-[52px] leading-[56px] font-bold tracking-[-0.02em]">{formatCents(payment.change_cents ?? 0)}</span>
            </div>
          )}
        </div>
        <dl className={cn(ledger, 'grid-cols-2 sm:grid-cols-4')}>
          <Cell label="Paciente" className={extras > 0 ? undefined : 'col-span-2'}>
            {invoice.patient_name}
          </Cell>
          <Cell label="Total">
            <span className="num font-semibold">{formatCents(invoice.total_cents)}</span>
          </Cell>
          <Cell label="Método">{payment ? PAYMENT_METHOD_LABEL[payment.method] : 'Sin cobro'}</Cell>
          {cash && payment.received_cents != null && (
            <Cell label="Recibido">
              <span className="num">{formatCents(payment.received_cents)}</span>
            </Cell>
          )}
          {payment?.reference && (
            <Cell label="Referencia">
              <span className="num">{payment.reference}</span>
            </Cell>
          )}
        </dl>
        <div className="flex flex-wrap items-center gap-2 px-6 py-4">
          {receipt ? (
            <ReceiptButtons receipt={receipt} primary size="lg" />
          ) : (
            <Link
              to={`/recibos/${invoice.id}`}
              className="pressable inline-flex h-10 items-center gap-2 rounded-[var(--radius-md)] border border-junta bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-2 [&_svg]:size-4"
            >
              <FileText aria-hidden="true" />
              Ver documento
            </Link>
          )}
          <span className="flex-1" />
          {newOpButton(onNew)}
        </div>
      </div>
    </section>
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
    <section className="anim-pop-in mx-auto w-full max-w-[880px] overflow-hidden rounded-[var(--radius-md)] border border-junta bg-surface">
      <Masthead
        glyph="hollow"
        tone="text-warn"
        heading="Emitido pendiente de cobro"
        invoice={invoice}
        note="La factura se emitió, pero el cobro no se registró."
      />
      <p role="alert" className="mx-6 mb-4 rounded-[var(--radius-md)] border border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger">
        {error}
      </p>
      <dl className={cn(ledger, 'grid-cols-2 sm:grid-cols-3')}>
        <Cell label="Paciente" className="col-span-2">
          {invoice.patient_name}
        </Cell>
        <Cell label="Saldo">
          <span className="num text-[20px] font-bold">{formatCents(invoice.balance_cents)}</span>
        </Cell>
      </dl>
      <div className="flex flex-wrap items-center gap-2 px-6 py-4">
        <Button variant="primary" size="lg" leftIcon={<RotateCcw />} onClick={onRetry}>
          Cobrar pendiente
        </Button>
        <Link
          to={`/recibos/${invoice.id}`}
          className="pressable inline-flex h-10 items-center rounded-[var(--radius-md)] px-4 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink"
        >
          Ver en Recibos
        </Link>
        <span className="flex-1" />
        {newOpButton(onNew)}
      </div>
    </section>
  );
}
