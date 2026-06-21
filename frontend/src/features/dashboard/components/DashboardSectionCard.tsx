import { AlertTriangle, Lock, RefreshCcw } from 'lucide-react';
import { type ReactNode } from 'react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Skeleton } from '../../../components/ui/states';
import { cn } from '../../../lib/utils';
import { type DashboardSectionCardProps, type DashboardSectionState } from './dashboardTypes';

export function DashboardSectionCard({
  actions,
  children,
  className,
  contentClassName,
  description,
  emptyDescription = 'No hay datos disponibles.',
  emptyTitle = 'Sin datos',
  errorMessage,
  loadingLabel = 'Cargando seccion...',
  onRetry,
  state,
  title,
}: DashboardSectionCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-base font-bold">{title}</CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{actions}</div> : null}
      </CardHeader>
      <CardContent className={cn('px-2 sm:px-5', contentClassName)}>
        {state === 'loading' ? (
          <div
            className="flex min-h-40 items-center justify-center"
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={loadingLabel}
          >
            <Skeleton className="h-32 w-full" />
          </div>
        ) : state === 'error' ? (
          <DashboardSectionError message={errorMessage} onRetry={onRetry} />
        ) : state === 'empty' ? (
          <DashboardSectionEmpty title={emptyTitle} description={emptyDescription} />
        ) : state === 'permission-locked' ? (
          <DashboardPermissionLocked />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

type DashboardSectionErrorProps = {
  message?: string;
  onRetry?: () => void;
};

function DashboardSectionError({ message, onRetry }: DashboardSectionErrorProps) {
  return (
    <div
      role="alert"
      className="flex min-h-40 flex-col items-center justify-center gap-3 px-4 py-8 text-center"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">No se pudo cargar</p>
        {message ? (
          <p className="mx-auto max-w-sm text-xs text-muted-foreground">{message}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCcw aria-hidden="true" className="size-3.5" />
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}

type DashboardSectionEmptyProps = {
  title: string;
  description: string;
};

function DashboardSectionEmpty({ title, description }: DashboardSectionEmptyProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-32 flex-col items-center justify-center gap-1 px-4 py-8 text-center"
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mx-auto max-w-sm text-xs text-muted-foreground">{description}</p>
    </div>
  );
}

function DashboardPermissionLocked() {
  return (
    <div
      role="alert"
      className="flex min-h-40 flex-col items-center justify-center gap-3 px-4 py-8 text-center"
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Lock aria-hidden="true" className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">Sin permiso para ver este resumen</p>
        <p className="mx-auto max-w-xs text-xs text-muted-foreground">
          El resto de acciones disponibles para su rol siguen visibles en el menu.
        </p>
      </div>
    </div>
  );
}

export type DashboardSectionFallbackProps = {
  children: ReactNode;
  height?: string;
  loadingLabel: string;
  state: DashboardSectionState;
};

export function DashboardSectionFallback({
  children,
  height = 'min-h-40',
  loadingLabel,
  state,
}: DashboardSectionFallbackProps) {
  if (state === 'loading') {
    return (
      <div
        className={cn('flex w-full items-center justify-center', height)}
        role="status"
        aria-live="polite"
        aria-busy="true"
        aria-label={loadingLabel}
      >
        <Skeleton className="h-full w-full" />
      </div>
    );
  }

  if (state === 'error') {
    return <DashboardSectionError />;
  }

  return <>{children}</>;
}
