import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { formatCents } from '@/lib/money';
import type { InvoicePreview } from '@/api/types';

function Line({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex h-8 items-center justify-between gap-4 border-b border-ochre-line text-[15px]">
      <dt>{label}</dt>
      <dd className="num font-medium">{children}</dd>
    </div>
  );
}

/**
 * The ochre total field of Cobrar: Subtotal (before the receta ajuste), Ajuste por
 * receta, Exento, ISV and the Total as the largest figure on screen, so the column
 * adds up. The server's subtotal is already net of the ajuste; the gross is
 * subtotal + ajuste (no tax is recomputed here). With an empty account the total is L 0.00;
 * with lines but no server figure yet, a quiet "—".
 */
export function TotalField({ totals, empty, calculating }: { totals: InvoicePreview | undefined; empty: boolean; calculating: boolean }) {
  const fmt = (cents: number | undefined): ReactNode =>
    cents !== undefined ? (
      formatCents(cents)
    ) : empty ? (
      formatCents(0)
    ) : (
      <>
        <span aria-hidden="true">—</span>
        <span className="sr-only">No disponible</span>
      </>
    );
  const taxes = totals?.tax_breakdown.filter((t) => t.rate_bp > 0) ?? [];
  const adjustment = totals?.rule_adjustment_cents ?? 0;
  const totalText = totals ? formatCents(totals.total_cents) : formatCents(0);
  const big = totalText.length > 12 ? 'text-[44px] leading-[52px]' : 'text-[58px] leading-[64px]';

  return (
    <div
      aria-live="polite"
      aria-busy={calculating || undefined}
      className={cn('bg-ochre px-6 pt-4 pb-5 text-ochre-ink transition-opacity duration-[var(--dur-fast)]', calculating && 'opacity-70')}
    >
      <dl>
        <Line label="Subtotal">{fmt(totals ? totals.subtotal_cents + adjustment : undefined)}</Line>
        {adjustment > 0 && <Line label="Ajuste por receta">{`−${formatCents(adjustment)}`}</Line>}
        <Line label="Exento">{fmt(totals?.exempt_cents)}</Line>
        {taxes.length > 0 ? (
          taxes.map((t) => (
            <Line key={t.rate_bp} label={t.label}>
              {fmt(t.tax_cents ?? undefined)}
            </Line>
          ))
        ) : (
          <Line label="ISV 15 %">{fmt(totals?.tax_cents)}</Line>
        )}
        <div className="flex items-baseline justify-between gap-3 pt-3">
          <dt className="text-[15px] leading-5 font-bold tracking-[0.06em] uppercase">Total</dt>
          <dd className={cn('num font-bold tracking-[-0.02em] [font-stretch:88%]', big)}>
            {totals || empty ? (
              totalText
            ) : (
              <>
                <span aria-hidden="true">—</span>
                <span className="sr-only">No disponible</span>
              </>
            )}
          </dd>
        </div>
      </dl>
    </div>
  );
}
