import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { TaxBreakdownEntry } from '@/api/types';
import { Amount } from './Amount';

export type TotalsLike = {
  subtotal_cents: number;
  exempt_cents: number;
  tax_cents: number;
  total_cents: number;
  tax_breakdown: TaxBreakdownEntry[];
  /** Receta ajuste already taken out of subtotal_cents by the server. */
  rule_adjustment_cents?: number;
};

/** One ledger line: label left, amount hard right, ruled by the junta. */
function Row({ label, children, strong, className }: { label: ReactNode; children: ReactNode; strong?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 border-b border-junta last:border-b-0',
        strong ? 'pt-3 pb-1 text-ink' : 'h-8 items-center text-ink-2',
        className,
      )}
    >
      <dt className={cn(strong ? 'text-[13px] font-bold tracking-[0.06em] uppercase' : 'text-[13.5px]')}>{label}</dt>
      <dd className={cn('num text-right text-ink', strong ? 'text-[32px] leading-9 font-bold tracking-[-0.02em]' : 'text-[14px] font-medium')}>
        {children}
      </dd>
    </div>
  );
}

/**
 * Subtotal, Ajuste por receta, Exento, ISV por tasa y Total — server values. With a receta
 * ajuste the Subtotal shows the gross (subtotal + ajuste) so the column adds up.
 */
export function TotalsList({
  totals,
  extra,
  className,
  showTotal = true,
}: {
  totals: TotalsLike | undefined;
  extra?: ReactNode;
  className?: string;
  /** Hide the Total row when the surrounding view already shows it large. */
  showTotal?: boolean;
}) {
  const taxes = totals?.tax_breakdown.filter((t) => t.rate_bp > 0) ?? [];
  const adjustment = totals?.rule_adjustment_cents ?? 0;
  return (
    <dl className={cn('flex flex-col', className)}>
      <Row label="Subtotal">
        <Amount cents={totals ? totals.subtotal_cents + adjustment : undefined} />
      </Row>
      {adjustment > 0 && (
        <Row label="Ajuste por receta">
          <Amount cents={adjustment} negative />
        </Row>
      )}
      <Row label="Exento">
        <Amount cents={totals?.exempt_cents} />
      </Row>
      {taxes.length > 0 ? (
        taxes.map((t) => (
          <Row key={t.rate_bp} label={t.label}>
            <Amount cents={t.tax_cents ?? null} />
          </Row>
        ))
      ) : (
        <Row label="ISV 15 %">
          <Amount cents={totals?.tax_cents} />
        </Row>
      )}
      {showTotal && (
        <Row label="Total" strong>
          <Amount cents={totals?.total_cents} />
        </Row>
      )}
      {extra}
    </dl>
  );
}

export { Row as TotalsRow };
