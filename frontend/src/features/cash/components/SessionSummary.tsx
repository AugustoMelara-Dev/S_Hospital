import { Banknote, HandCoins } from 'lucide-react';
import { finiteNumber, formatLempirasUI } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { CashSession } from '@/lib/api';

interface SessionSummaryProps {
  session: CashSession;
  closingAmount: string | null;
  difference: number | null;
}

export function SessionSummary({ session, closingAmount, difference }: SessionSummaryProps) {
  const openingAmount = finiteNumber(session.opening_amount);
  const expectedAmount = finiteNumber(
    session.expected_cash_amount ?? session.expected_amount ?? session.opening_amount,
  );
  const cashPayments = finiteNumber(session.payments_by_method?.cash);
  const pendingAmount = finiteNumber(session.pending_amount);
  const pendingCount = session.pending_invoice_count ?? 0;
  const hasCountedAmount = closingAmount !== null;
  const safeDifference = finiteNumber(difference);
  const differenceState = !hasCountedAmount
    ? 'Pendiente de conteo'
    : safeDifference === 0
      ? 'Sin diferencia'
      : safeDifference > 0
        ? 'Sobrante frente al efectivo esperado'
        : 'Faltante frente al efectivo esperado';

  return (
    <section
      aria-labelledby="cash-reconciliation-title"
      className="overflow-hidden rounded-lg border border-operational-border bg-operational-surface"
    >
      <div className="flex flex-col gap-1 border-b border-border px-4 pb-4 pt-5 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Libro operacional
        </p>
        <h2 id="cash-reconciliation-title" className="text-xl font-semibold tracking-tight text-foreground">
          Conciliación de caja
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Compare el efectivo que el sistema espera con el conteo físico antes de cerrar el turno.
        </p>
      </div>

      <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <LedgerValue
          label="Efectivo esperado"
          value={formatLempirasUI(expectedAmount)}
          detail="Apertura y cobros posteados en efectivo"
        />
        <LedgerValue
          label="Monto contado"
          value={hasCountedAmount ? formatLempirasUI(closingAmount) : 'Pendiente'}
          detail={hasCountedAmount ? 'Conteo físico informado' : 'Ingrese el conteo en cierre guiado'}
        />
        <LedgerValue
          label="Diferencia"
          value={hasCountedAmount ? formatSignedLempiras(safeDifference) : 'Pendiente'}
          detail={differenceState}
          describedBy="cash-difference-description"
          valueClassName={cn(
            hasCountedAmount && safeDifference < 0 && 'text-destructive',
            hasCountedAmount && safeDifference > 0 && 'text-warning-foreground',
            hasCountedAmount && safeDifference === 0 && 'text-success-foreground',
          )}
        />
      </div>

      <div className="grid gap-3 border-t border-border bg-muted/25 px-4 py-3 text-sm sm:grid-cols-3 sm:px-5">
        <SupportingFact icon={<Banknote data-icon aria-hidden="true" />} label="Monto de apertura" value={formatLempirasUI(openingAmount)} />
        <SupportingFact icon={<HandCoins data-icon aria-hidden="true" />} label="Cobros en efectivo" value={formatLempirasUI(cashPayments)} />
        <div className="flex items-center justify-between gap-3 sm:justify-start">
          <span className="text-muted-foreground">Saldo pendiente</span>
          <strong className="tabular-nums text-foreground">{formatLempirasUI(pendingAmount)}</strong>
          <span className="sr-only">{pendingCount} facturas pendientes o parciales</span>
        </div>
      </div>
    </section>
  );
}

function LedgerValue({
  describedBy,
  detail,
  label,
  value,
  valueClassName,
}: {
  describedBy?: string;
  detail: string;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-w-0 px-4 py-5 sm:px-5">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p
        aria-describedby={describedBy}
        className={cn('mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground', valueClassName)}
      >
        {value}
      </p>
      <p id={describedBy} className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

function SupportingFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 sm:justify-start">
      <span aria-hidden="true" className="text-secondary [&_svg]:size-4">{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <strong className="tabular-nums text-foreground">{value}</strong>
    </div>
  );
}

function formatSignedLempiras(value: number): string {
  const safeValue = finiteNumber(value);

  if (safeValue === 0) return 'L 0.00';

  return `${safeValue > 0 ? '+' : '-'} ${formatLempirasUI(Math.abs(safeValue))}`;
}
