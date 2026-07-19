import { finiteNumber, formatLempirasUI } from '@/lib/money';
import type { CashSession } from '@/lib/api';

interface Props { session: CashSession; closingAmount: string | null; difference: number | null }
export function SessionSummary({ session, closingAmount, difference }: Props) {
  const openingAmount = finiteNumber(session.opening_amount);
  const expectedAmount = finiteNumber(session.expected_cash_amount ?? session.expected_amount ?? session.opening_amount);
  const cashPayments = finiteNumber(session.payments_by_method?.cash);
  const pendingAmount = finiteNumber(session.pending_amount);
  const pendingCount = session.pending_invoice_count ?? 0;
  const counted = closingAmount !== null;
  const safeDifference = finiteNumber(difference);
  const detail = !counted ? 'Pendiente de conteo' : safeDifference === 0 ? 'Sin diferencia' : safeDifference > 0 ? 'Sobrante frente al efectivo esperado' : 'Faltante frente al efectivo esperado';
  return <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs" aria-labelledby="cash-reconciliation-title">
    <header className="border-b border-border p-5"><h2 id="cash-reconciliation-title" className="text-xl font-semibold">Conciliación de caja</h2><p className="text-sm text-muted-foreground">Compare el efectivo esperado con el conteo físico antes de cerrar.</p></header>
    <div className="grid gap-px bg-border sm:grid-cols-3">
      <Metric title="Efectivo esperado" value={formatLempirasUI(expectedAmount)} note="Apertura y cobros posteados en efectivo" />
      <Metric title="Monto contado" value={counted ? formatLempirasUI(closingAmount) : 'Pendiente'} note={counted ? 'Conteo físico informado' : 'Ingrese el conteo en cierre guiado'} />
      <Metric title="Diferencia" value={counted ? formatSignedLempiras(safeDifference) : 'Pendiente'} note={detail} />
    </div>
    <dl className="grid border-t border-border sm:grid-cols-3">
      <SummaryItem label="Monto de apertura" value={formatLempirasUI(openingAmount)} />
      <SummaryItem label="Cobros en efectivo" value={formatLempirasUI(cashPayments)} />
      <SummaryItem label="Saldo pendiente" value={formatLempirasUI(pendingAmount)} extra={`${pendingCount} facturas pendientes o parciales`} />
    </dl>
  </section>;
}
function Metric({ title, value, note }: { title: string; value: string; note: string }) { const descriptionId = `cash-${title.toLowerCase().replaceAll(' ', '-')}-description`; return <div className="bg-card p-5"><p className="text-xs text-muted-foreground">{title}</p><strong aria-describedby={descriptionId} className="block text-2xl tabular-nums">{value}</strong><p id={descriptionId} className="text-xs text-muted-foreground">{note}</p></div>; }
function SummaryItem({ extra, label, value }: { extra?: string; label: string; value: string }) { return <div className="border-b border-border p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium tabular-nums">{value}{extra ? <span className="sr-only"> {extra}</span> : null}</dd></div>; }
function formatSignedLempiras(value: number) { const safe = finiteNumber(value); return safe === 0 ? 'L 0.00' : `${safe > 0 ? '+' : '-'} ${formatLempirasUI(Math.abs(safe))}`; }
