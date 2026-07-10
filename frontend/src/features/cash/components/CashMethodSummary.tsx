import { CreditCard, HandCoins, Landmark, WalletCards } from 'lucide-react';
import { formatLempirasUI } from '@/lib/money';

type CashMethodSummaryProps = {
  paymentsByMethod?: {
    cash: string;
    transfer: string;
    card: string;
    other: string;
  };
  paymentsCount?: number;
  pendingAmount?: string;
};

const methodMeta = [
  { key: 'cash', label: 'Efectivo', detail: 'Aumenta el efectivo esperado', icon: HandCoins },
  { key: 'transfer', label: 'Transferencia', detail: 'Conciliación bancaria separada', icon: Landmark },
  { key: 'card', label: 'Tarjeta', detail: 'No aumenta el efectivo en gaveta', icon: CreditCard },
  { key: 'other', label: 'Otros', detail: 'Método no efectivo registrado', icon: WalletCards },
] as const;

export function CashMethodSummary({
  paymentsByMethod,
  paymentsCount = 0,
  pendingAmount = '0.00',
}: CashMethodSummaryProps) {
  if (!paymentsByMethod) return null;

  return (
    <section
      aria-labelledby="cash-method-summary-title"
      className="overflow-hidden rounded-lg border border-operational-border bg-operational-surface"
    >
      <div className="border-b border-border px-4 pb-4 pt-5 sm:px-5">
        <h2 id="cash-method-summary-title" className="text-lg font-semibold tracking-tight text-foreground">
          Métodos de pago
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {paymentsCount} pagos registrados · {formatLempirasUI(pendingAmount)} pendiente
        </p>
      </div>

      <dl className="divide-y divide-border">
        {methodMeta.map(({ key, label, detail, icon: Icon }) => (
          <div key={key} className="grid min-h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-5">
            <dt className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded bg-muted text-secondary">
                <Icon data-icon aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block font-medium text-foreground">{label}</span>
                <span className="block text-xs leading-relaxed text-muted-foreground">{detail}</span>
              </span>
            </dt>
            <dd className="font-semibold tabular-nums text-foreground">{formatLempirasUI(paymentsByMethod[key])}</dd>
          </div>
        ))}
      </dl>

      <p className="border-t border-border bg-muted/25 px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:px-5">
        El sistema no recibe conteos separados por método. El cierre compara únicamente el efectivo físico con el efectivo esperado.
      </p>
    </section>
  );
}
