import { Banknote, ClipboardCheck, HandCoins, ReceiptText, Scale } from 'lucide-react';
import { MetricCard } from '@/components/ui/metric-card';
import { finiteNumber, formatLempirasUI } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { CashSession } from '@/lib/api';

interface SessionSummaryProps {
  session: CashSession;
  closingAmount: string | null;
  difference: number | null;
}

export function SessionSummary({
  session,
  closingAmount,
  difference,
}: SessionSummaryProps) {
  const openingAmount = finiteNumber(session.opening_amount);
  const expectedAmount = finiteNumber(session.expected_cash_amount ?? session.expected_amount ?? session.opening_amount);
  const cashPayments = finiteNumber(session.payments_by_method?.cash);
  const pendingAmount = finiteNumber(session.pending_amount);
  const pendingCount = session.pending_invoice_count ?? 0;
  const hasCountedAmount = closingAmount !== null;

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Resumen de caja actual">
      <MetricCard
        icon={<Banknote />}
        label="Monto Apertura"
        value={formatLempirasUI(openingAmount)}
        helper="Efectivo inicial registrado"
      />
      <MetricCard
        icon={<Scale />}
        label="Efectivo esperado"
        value={formatLempirasUI(expectedAmount)}
        helper="Apertura + pagos en efectivo"
        variant="info"
      />
      <MetricCard
        icon={<HandCoins />}
        label="Cobros en efectivo"
        value={formatLempirasUI(cashPayments)}
        helper="Solo pagos posteados con método efectivo"
        variant="success"
      />
      <MetricCard
        className={cn(hasCountedAmount && difference !== 0 ? 'border-warning/35 bg-warning/10' : '')}
        icon={<ClipboardCheck />}
        label="Contado y diferencia"
        value={hasCountedAmount ? formatLempirasUI(closingAmount) : 'Pendiente'}
        helper={!hasCountedAmount
          ? 'Ingrese monto contado para calcular diferencia.'
          : difference === null || difference === 0
            ? 'L. 0.00'
            : formatSignedLempiras(difference)}
        trend={hasCountedAmount && difference !== null && difference !== 0 ? {
          label: difference > 0 ? 'Sobrante registrado' : 'Faltante registrado',
          tone: difference > 0 ? 'positive' : 'negative',
        } : undefined}
        variant={hasCountedAmount && difference !== 0 ? 'warning' : 'neutral'}
      />
      <MetricCard
        className={cn(pendingAmount > 0 ? 'border-warning/35 bg-warning/10' : '')}
        icon={<ReceiptText />}
        label="Saldo pendiente"
        value={formatLempirasUI(pendingAmount)}
        helper={pendingCount === 0
          ? 'Sin facturas pendientes en esta caja.'
          : `${pendingCount} factura(s) emitidas o parciales.`}
        variant={pendingAmount > 0 ? 'warning' : 'neutral'}
      />
    </section>
  );
}

function formatSignedLempiras(value: number | null | undefined): string {
  const safeValue = finiteNumber(value);

  if (safeValue === 0) {
    return 'L 0.00';
  }

  const sign = safeValue > 0 ? '+' : '-';
  return formatLempirasUI(Math.abs(safeValue)).replace('L ', `L ${sign}`);
}
