import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { TaxBreakdownEntry } from '@/api/types';
import { Money } from '@/ui';

export type TotalsLike = {
  subtotal_cents: number;
  exempt_cents: number;
  tax_cents: number;
  total_cents: number;
  tax_breakdown: TaxBreakdownEntry[];
};

function Row({ label, children, strong }: { label: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4', strong ? 'text-ink' : 'text-ink-2')}>
      <dt className={cn(strong ? 'text-[14px] font-semibold' : 'text-[13px]')}>{label}</dt>
      <dd className={cn('num text-right', strong ? 'text-[22px] font-semibold tracking-[-0.02em]' : 'text-[13.5px] text-ink')}>
        {children}
      </dd>
    </div>
  );
}

/** Subtotal, Exento, ISV por tasa y Total — values exactly as the server returned them. */
export function TotalsList({ totals, extra, className }: { totals: TotalsLike | undefined; extra?: ReactNode; className?: string }) {
  const taxes = totals?.tax_breakdown.filter((t) => t.rate_bp > 0) ?? [];
  return (
    <dl className={cn('flex flex-col gap-1.5', className)}>
      <Row label="Subtotal">
        <Money cents={totals?.subtotal_cents} />
      </Row>
      <Row label="Exento">
        <Money cents={totals?.exempt_cents} />
      </Row>
      {taxes.length > 0 ? (
        taxes.map((t) => (
          <Row key={t.rate_bp} label={t.label}>
            <Money cents={t.tax_cents ?? null} />
          </Row>
        ))
      ) : (
        <Row label="ISV 15 %">
          <Money cents={totals?.tax_cents} />
        </Row>
      )}
      <div className="my-1.5 h-px bg-line" />
      <Row label="Total" strong>
        <Money cents={totals?.total_cents} />
      </Row>
      {extra}
    </dl>
  );
}

export { Row as TotalsRow };
