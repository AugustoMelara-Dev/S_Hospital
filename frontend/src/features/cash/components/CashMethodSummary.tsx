import { BanknoteIcon, CreditCardIcon, LandmarkIcon, WalletCardsIcon } from 'lucide-react';
import { formatLempirasUI } from '@/lib/money';

type Props = { paymentsByMethod?: { cash: string; transfer: string; card: string; other: string }; paymentsCount?: number; pendingAmount?: string };
const methods = [{ key: 'cash', label: 'Efectivo', icon: BanknoteIcon }, { key: 'transfer', label: 'Transferencia', icon: LandmarkIcon }, { key: 'card', label: 'Tarjeta', icon: CreditCardIcon }, { key: 'other', label: 'Otros', icon: WalletCardsIcon }] as const;

export function CashMethodSummary({ paymentsByMethod, paymentsCount = 0, pendingAmount = '0.00' }: Props) {
  if (!paymentsByMethod) return null;
  return <section className="rounded-xl border border-border bg-card p-5 shadow-xs" aria-labelledby="cash-method-summary-title">
    <h2 id="cash-method-summary-title" className="text-lg font-semibold">Métodos de pago</h2>
    <p className="mt-1 text-sm text-muted-foreground">{paymentsCount} pagos registrados · {formatLempirasUI(pendingAmount)} pendiente</p>
    <dl className="mt-4 grid overflow-hidden rounded-lg border border-border sm:grid-cols-2">
      {methods.map(({ key, label, icon: Icon }) => <div key={key} className="flex items-center justify-between gap-4 border-b border-border p-4 last:border-b-0 sm:odd:border-r"><dt className="flex items-center gap-2 text-sm text-muted-foreground"><Icon aria-hidden="true" className="size-4" />{label}</dt><dd className="font-semibold tabular-nums">{formatLempirasUI(paymentsByMethod[key])}</dd></div>)}
    </dl>
    <p className="mt-3 text-xs text-muted-foreground">El sistema no recibe conteos separados por método. El cierre compara únicamente el efectivo físico con el efectivo esperado.</p>
  </section>;
}
