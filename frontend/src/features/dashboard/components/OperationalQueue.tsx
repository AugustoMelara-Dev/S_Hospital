import { ArrowRight, CircleAlert } from 'lucide-react';

export type OperationalQueueItem = {
  id: string;
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
  priority: 'normal' | 'attention' | 'danger';
};

type OperationalQueueProps = {
  items: OperationalQueueItem[];
};

const priorityClass = {
  attention: 'text-warning',
  danger: 'text-destructive',
  normal: 'text-primary',
} satisfies Record<OperationalQueueItem['priority'], string>;

export function OperationalQueue({ items }: OperationalQueueProps) {
  return (
    <section aria-labelledby="operational-queue-title" className="min-w-0 overflow-hidden rounded-xl border border-operational-border bg-operational-surface shadow-operational">
      <header className="border-b border-operational-border bg-muted/35 px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Prioridad del turno</p>
        <h2 id="operational-queue-title" className="mt-1 text-lg font-semibold">Próxima acción</h2>
      </header>
      <ol className="space-y-2 p-3">
        {items.map((item, index) => (
          <li key={item.id} className="flex min-w-0 items-start gap-3 rounded-xl border border-transparent px-4 py-4 transition hover:border-operational-border hover:bg-muted/30">
            <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted ${priorityClass[item.priority]}`}>
              {index === 0 ? <CircleAlert aria-hidden="true" className="size-5" /> : <span aria-hidden="true" className="text-xs font-semibold tabular-nums">{index + 1}</span>}
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-foreground">{item.title}</h3>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{item.description}</p>
              {item.href && item.actionLabel ? (
                <a
                  href={item.href}
                  className="mt-2 inline-flex min-h-11 items-center gap-2 py-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.actionLabel}
                  <ArrowRight aria-hidden="true" className="size-4" />
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
