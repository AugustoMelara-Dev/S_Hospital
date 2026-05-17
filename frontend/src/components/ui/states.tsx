import { AlertTriangle, Loader2, SearchX } from 'lucide-react';
import { type ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';

export function LoadingState({ label = 'Cargando...' }: { label?: string }) {
  return (
    <Card>
      <CardContent className="flex min-h-32 items-center gap-3 pt-5 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        <span>{label}</span>
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
  description,
  title = 'No se pudo cargar',
}: {
  description?: string;
  title?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <AlertTriangle className="size-5 text-destructive" aria-hidden="true" />
          <CardTitle>{title}</CardTitle>
        </div>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
    </Card>
  );
}
