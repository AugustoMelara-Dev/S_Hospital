import { PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/api/types';
import { formatCents } from '@/lib/money';
import { Money } from '@/ui';

export type MethodBarRow = { method: PaymentMethod; amount_cents: number; count?: number };

/**
 * Horizontal magnitude bars per payment method: one series, one hue (slate),
 * values in ink on the right, tabular. Rendered as a list so screen readers
 * read label + amount.
 */
export function MethodBars({ rows, label }: { rows: MethodBarRow[]; label: string }) {
  const max = Math.max(0, ...rows.map((r) => r.amount_cents));
  const total = rows.reduce((s, r) => s + r.amount_cents, 0);
  return (
    <ul aria-label={label} className="flex flex-col gap-2.5">
      {rows.map((r) => {
        const pct = max > 0 ? (r.amount_cents / max) * 100 : 0;
        const share = total > 0 ? Math.round((r.amount_cents / total) * 100) : 0;
        return (
          <li key={r.method} className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-3 text-[13px]">
            <span className="text-ink-2">{PAYMENT_METHOD_LABEL[r.method]}</span>
            <span className="relative h-2.5 bg-surface-2" aria-hidden="true">
              <span
                className="absolute inset-y-0 left-0 rounded-r-[2px] bg-slate transition-[width] duration-[180ms] ease-[var(--ease-out)]"
                style={{ width: `${pct}%`, minWidth: r.amount_cents > 0 ? 3 : 0 }}
              />
            </span>
            <span className="flex items-baseline justify-end gap-2 text-right">
              <Money cents={r.amount_cents} className={r.amount_cents > 0 ? 'text-ink' : 'text-ink-3'} />
              <span className="num w-9 text-[12px] text-ink-3" aria-label={`${share} % del total`} title={formatCents(r.amount_cents)}>
                {share}%
              </span>
              {r.count !== undefined && <span className="sr-only">{r.count} cobros</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
