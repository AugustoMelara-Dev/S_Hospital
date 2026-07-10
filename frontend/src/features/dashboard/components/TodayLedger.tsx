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
    <section aria-label="Resumen financiero de hoy" className="border-y border-operational-border bg-operational-surface">
      <h2 className="sr-only">Resumen financiero de hoy</h2>
      <dl className="grid sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`relative min-w-0 px-4 py-5 before:absolute before:inset-y-5 before:left-0 before:w-0.5 ${toneClass[item.tone]} ${
              index > 0 ? 'border-t border-operational-border sm:border-l sm:border-t-0' : ''
            } ${index === 2 ? 'sm:border-l-0 xl:border-l' : ''}`}
          >
            <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{item.label}</dt>
            <dd className="mt-2 min-h-8 text-xl font-semibold tabular-nums text-foreground">{item.value}</dd>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.note}</p>
          </div>
        ))}
      </dl>
    </section>
  );
}
