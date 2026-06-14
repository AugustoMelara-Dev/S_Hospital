import { AlertTriangle, SearchX } from 'lucide-react';
import { type ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded bg-muted before:absolute before:inset-y-0 before:w-1/2 before:animate-[shimmer_1.4s_ease-in-out_infinite] before:bg-gradient-to-r before:from-transparent before:via-card/70 before:to-transparent ${className ?? ''}`}
    />
  );
}

export function LoadingState({ label = 'Cargando...' }: { label?: string }) {
  return (
    <Card role="status" aria-live="polite" aria-busy="true">
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
  description,
  title = 'Sin datos',
}: {
  action?: ReactNode;
  description?: string;
  title?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <SearchX className="size-5 text-muted-foreground" aria-hidden="true" />
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
  description,
  title = 'No se pudo cargar',
}: {
  action?: ReactNode;
  description?: string;
  title?: string;
}) {
  return (
    <Card role="alert">
      <CardHeader>
        <div className="flex items-center gap-3">
          <AlertTriangle className="size-5 text-destructive" aria-hidden="true" />
          <CardTitle>{title}</CardTitle>
        </div>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      {action ? <CardContent>{action}</CardContent> : null}
    </Card>
  );
}
