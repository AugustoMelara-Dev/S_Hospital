import type { ReactNode } from 'react';

export type TodayLedgerItem = {
  id: string;
  label: string;
  value: ReactNode;
  note: string;
  tone: 'neutral' | 'success' | 'attention' | 'danger';
};

type TodayLedgerProps = {
  items: TodayLedgerItem[];
};

const toneClass = {
  attention: 'before:bg-warning',
  danger: 'before:bg-destructive',
  neutral: 'before:bg-muted-foreground/45',
  success: 'before:bg-success',
} satisfies Record<TodayLedgerItem['tone'], string>;

export function TodayLedger({ items }: TodayLedgerProps) {
  return (
    <section aria-label="Resumen financiero de hoy">
      <h2 className="sr-only">Resumen financiero de hoy</h2>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`relative min-w-0 overflow-hidden rounded-xl border border-operational-border bg-operational-surface px-5 py-5 shadow-operational before:absolute before:inset-y-0 before:left-0 before:w-1 ${toneClass[item.tone]}`}
          >
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{item.label}</dt>
            <dd className="mt-3 min-h-8 text-2xl font-semibold tracking-[-0.03em] tabular-nums text-foreground">{item.value}</dd>
            <dd className="mt-1 text-xs leading-5 text-muted-foreground">{item.note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
