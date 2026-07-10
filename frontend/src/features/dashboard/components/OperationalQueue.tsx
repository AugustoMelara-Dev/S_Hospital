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
    <section aria-labelledby="operational-queue-title" className="min-w-0 border border-operational-border bg-operational-surface">
      <header className="border-b border-operational-border px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Prioridad del turno</p>
        <h2 id="operational-queue-title" className="mt-1 text-lg font-semibold">Próxima acción</h2>
      </header>
      <ol className="divide-y divide-operational-border">
        {items.map((item, index) => (
          <li key={item.id} className="flex min-w-0 items-start gap-3 px-5 py-4">
            <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center ${priorityClass[item.priority]}`}>
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
