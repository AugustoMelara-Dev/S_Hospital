import type { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
    <section aria-label="Resumen financiero de hoy" className="min-w-0">
      <Card>
        <CardHeader className="gap-1 px-5 pt-5 pb-4 sm:px-6">
          <CardDescription className="text-xs font-semibold uppercase tracking-wider">Estado del turno</CardDescription>
          <CardTitle><h2 className="text-lg">Resumen de hoy</h2></CardTitle>
        </CardHeader>
        <CardContent className="grid gap-px overflow-hidden rounded-lg bg-border p-px sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <div key={item.id} className="flex min-w-0 flex-col gap-2 bg-card p-4">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</span>
              <strong className="text-xl tracking-tight tabular-nums text-foreground">{item.value}</strong>
              <span className={cn('text-sm', noteTone[item.tone])}>{item.note}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
