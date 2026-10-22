import { BanknoteIcon, CreditCardIcon, LandmarkIcon, WalletCardsIcon } from 'lucide-react';
import { AdminPanel, AdminPanelHeader, MoneyText } from '@/design-system/admin/components';
import { parseCents } from '@/lib/moneyCents';
import { formatCashCents } from '../cashMoney';

type Props = { paymentsByMethod?: { cash: string; transfer: string; card: string; other: string }; paymentsCount?: number; pendingAmount?: string | null };

const methods = [
  { key: 'cash', label: 'Efectivo', icon: BanknoteIcon },
  { key: 'transfer', label: 'Transferencia', icon: LandmarkIcon },
  { key: 'card', label: 'Tarjeta', icon: CreditCardIcon },
  { key: 'other', label: 'Otros', icon: WalletCardsIcon },
] as const;

const GRID_COLUMNS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-2 xl:grid-cols-4',
};

/**
 * Único resumen monetario por método del turno. Solo muestra lo cobrado según
 * el servidor; nunca un "contado" por método que no existe (el cierre compara
 * únicamente efectivo físico contra efectivo esperado).
 *
 * Los métodos en cero no dibujan un contenedor: cuando no hay ningún cobro se
 * declara en una línea discreta.
 */
export function CashMethodSummary({ paymentsByMethod, paymentsCount = 0, pendingAmount = null }: Props) {
  if (!paymentsByMethod) return null;

  const recorded = methods
    .map((method) => ({ ...method, cents: parseCents(paymentsByMethod[method.key]) }))
    .filter((method) => method.cents !== null && method.cents > 0);

  if (recorded.length === 0) {
    // Mismo molde que el estado con datos: la superficie de la pestaña
    // Resumen siempre existe y su contenido real es el estado del turno
    // (no una tarjeta decorativa vacía ni texto suelto sobre el fondo).
    return (
      <AdminPanel as="section" aria-labelledby="cash-method-summary-title" className="overflow-hidden">
        <AdminPanelHeader id="cash-method-summary-title" title="Cobros por método" />
        <p
          role="status"
          data-cash-methods="clear"
          className="px-4 py-3.5 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]"
        >
          Sin cobros registrados en este turno.
        </p>
      </AdminPanel>
    );
  }

  const pendingCents = parseCents(pendingAmount);
  const description = [
    `${paymentsCount} ${paymentsCount === 1 ? 'pago registrado' : 'pagos registrados'}`,
    pendingCents !== null && pendingCents > 0 ? `${formatCashCents(pendingCents)} por cobrar` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');

  return (
    <AdminPanel as="section" aria-labelledby="cash-method-summary-title" className="overflow-hidden">
      <AdminPanelHeader id="cash-method-summary-title" title="Cobros por método" description={description} />
      <dl className={`grid grid-cols-1 ${GRID_COLUMNS[recorded.length] ?? 'sm:grid-cols-2'}`}>
        {recorded.map(({ key, label, icon: Icon, cents }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-4 border-b border-[var(--ui-line)] px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
          >
            <dt className="flex min-w-0 items-center gap-2 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
              <Icon aria-hidden="true" data-icon className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
            </dt>
            <dd className="shrink-0 font-semibold tabular-nums"><MoneyText cents={cents} /></dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-[var(--ui-line)] px-4 py-2.5 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
        Solo el efectivo entra a la gaveta y al arqueo; tarjeta, transferencia y otros no se cuentan como efectivo físico.
      </p>
    </AdminPanel>
  );
}
