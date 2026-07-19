import { ArrowRight, CircleAlert, CircleCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type OperationalQueueItem = {
  id: string;
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
  priority: 'normal' | 'attention' | 'danger';
};

const priorityLabel = { normal: 'Normal', attention: 'Atención', danger: 'Urgente' } as const;

export function OperationalQueue({ items }: { items: OperationalQueueItem[] }) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardDescription>Prioridad del turno</CardDescription>
        <CardTitle><h2 id="operational-queue-title">Próxima acción</h2></CardTitle>
      </CardHeader>
      <CardContent aria-labelledby="operational-queue-title" role="list" className="flex flex-col p-0">
        {items.map((item) => {
          const StatusIcon = item.priority === 'normal' ? CircleCheck : CircleAlert;
          return (
            <div key={item.id} role="listitem" className="flex flex-col gap-3 border-t p-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <StatusIcon
                  aria-hidden="true"
                  className={cn('mt-0.5 shrink-0', item.priority === 'normal' ? 'text-success' : item.priority === 'danger' ? 'text-destructive' : 'text-warning-foreground')}
                />
                <div className="flex min-w-0 flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{item.title}</strong>
                    <Badge variant={item.priority === 'danger' ? 'destructive' : 'secondary'}>{priorityLabel[item.priority]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
              {item.href && item.actionLabel ? (
                <Button asChild variant="ghost" className="shrink-0 self-start">
                  <a href={item.href}>{item.actionLabel}<ArrowRight data-icon="inline-end" /></a>
                </Button>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
