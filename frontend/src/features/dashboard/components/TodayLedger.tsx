import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type TodayLedgerItem = {
  id: string;
  label: string;
  value: ReactNode;
  note: string;
  tone: 'neutral' | 'success' | 'attention' | 'danger';
};

const noteTone: Record<TodayLedgerItem['tone'], string> = {
  neutral: 'text-muted-foreground',
  success: 'text-success',
  attention: 'text-warning-foreground',
  danger: 'text-destructive',
};

export function TodayLedger({ items }: { items: TodayLedgerItem[] }) {
  return (
    <section aria-label="Resumen financiero de hoy">
      <h2 className="sr-only">Resumen financiero de hoy</h2>
      <Card>
        <CardContent className="grid gap-px overflow-hidden rounded-lg bg-border p-px sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <div key={item.id} className="flex min-w-0 flex-col gap-2 bg-card p-4">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</span>
              <strong className="text-lg tabular-nums text-foreground">{item.value}</strong>
              <span className={cn('text-sm', noteTone[item.tone])}>{item.note}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
