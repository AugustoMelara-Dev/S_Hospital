import type { ReactNode } from 'react';
import { ChartContainer, type ChartConfig } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';

export type ChartState = 'ready' | 'loading' | 'empty' | 'error';

type ChartProps = {
  ariaLabel: string;
  children: React.ComponentProps<typeof ChartContainer>['children'];
  config: ChartConfig;
  state?: ChartState;
  errorMessage?: string;
  emptyMessage?: string;
  loadingMessage?: string;
  summary?: ReactNode;
  alternativeTable?: ReactNode;
  className?: string;
};

export const formatHnl = (value: number) => new Intl.NumberFormat('es-HN', {
  style: 'currency',
  currency: 'HNL',
}).format(value);

export function Chart({
  ariaLabel,
  children,
  config,
  state = 'ready',
  errorMessage = 'No se pudo cargar el gráfico.',
  emptyMessage = 'No hay datos para mostrar.',
  loadingMessage = 'Cargando gráfico…',
  summary,
  alternativeTable,
  className = 'h-72 w-full',
}: ChartProps) {
  return (
    <figure aria-label={ariaLabel} className="flex min-w-0 flex-col gap-3">
      {state === 'ready' ? (
        <div role="img" aria-label={ariaLabel}>
          <ChartContainer config={config} className={className}>{children}</ChartContainer>
        </div>
      ) : state === 'loading' ? (
        <div role="status" aria-label={loadingMessage}><Skeleton className="h-72 w-full" /></div>
      ) : (
        <div role={state === 'error' ? 'alert' : 'status'} className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {state === 'error' ? errorMessage : emptyMessage}
        </div>
      )}
      {summary ? <figcaption className="text-sm text-muted-foreground">{summary}</figcaption> : null}
      {alternativeTable ? (
        <div className="overflow-x-auto rounded-lg border border-border" role="region" aria-label={`Datos tabulares de ${ariaLabel}`} tabIndex={0}>
          {alternativeTable}
        </div>
      ) : null}
    </figure>
  );
}
