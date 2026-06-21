import { AlertTriangle, RefreshCcw, SearchX } from 'lucide-react';
import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

export function Skeleton({
  'aria-hidden': ariaHidden = true,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden={ariaHidden}
      data-slot="skeleton"
      className={cn('rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export function LoadingState({
  className,
  label = 'Cargando...',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <Card role="status" aria-live="polite" aria-busy="true" data-slot="loading-state" className={className}>
      <CardContent className="flex min-h-32 flex-col gap-4 pt-5 text-muted-foreground">
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-semibold">{label}</span>
          <Skeleton className="h-3 w-20" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  action,
  className,
  description,
  title = 'Sin datos',
}: {
  action?: ReactNode;
  className?: string;
  description?: string;
  title?: string;
}) {
  return (
    <Card data-slot="empty-state" className={className}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <SearchX data-icon className="size-5 text-muted-foreground" aria-hidden="true" />
          <CardTitle>{title}</CardTitle>
        </div>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      {action ? <CardContent>{action}</CardContent> : null}
    </Card>
  );
}

export function ErrorState({
  action,
  className,
  description,
  message,
  onRetry,
  retryLabel = 'Reintentar',
  title = 'No se pudo cargar',
}: {
  action?: ReactNode;
  className?: string;
  description?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  title?: string;
}) {
  const resolvedDescription = description ?? message;

  return (
    <Card role="alert" aria-live="assertive" data-slot="error-state" className={className}>
      <CardHeader>
        <div className="flex items-center gap-3">
          <AlertTriangle data-icon className="size-5 text-destructive" aria-hidden="true" />
          <CardTitle>{title}</CardTitle>
        </div>
        {resolvedDescription ? <CardDescription>{resolvedDescription}</CardDescription> : null}
      </CardHeader>
      {(action || onRetry) ? (
        <CardContent className="flex flex-wrap items-center gap-2">
          {action}
          {onRetry ? (
            <Button type="button" variant="secondary" onClick={onRetry}>
              <RefreshCcw data-icon aria-hidden="true" />
              {retryLabel}
            </Button>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
