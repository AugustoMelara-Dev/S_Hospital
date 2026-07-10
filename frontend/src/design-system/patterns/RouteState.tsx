import { useId, type ComponentType } from 'react';
import {
  AlertTriangle,
  Ban,
  CircleDashed,
  FileQuestion,
  Inbox,
  RotateCw,
  WifiOff,
} from 'lucide-react';
import { Button } from '../../components/ui/button';

export type RouteStateKind =
  | 'loading'
  | 'empty'
  | 'error'
  | 'denied'
  | 'offline'
  | 'not-found';

export type RouteStateAction = {
  label: string;
  onClick?: () => void;
  href?: string;
};

export type RouteStateProps = {
  kind: RouteStateKind;
  title: string;
  description: string;
  action?: RouteStateAction;
  detail?: string;
  headingLevel?: 1 | 2 | 3;
};

const stateIcons: Record<RouteStateKind, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  denied: Ban,
  empty: Inbox,
  error: AlertTriangle,
  loading: CircleDashed,
  offline: WifiOff,
  'not-found': FileQuestion,
};

const stateLabels: Record<RouteStateKind, string> = {
  denied: 'Acceso restringido',
  empty: 'Sin resultados',
  error: 'Atención requerida',
  loading: 'Cargando',
  offline: 'Sin conexión local',
  'not-found': 'Ruta no disponible',
};

export function RouteState({ action, description, detail, headingLevel = 1, kind, title }: RouteStateProps) {
  const Icon = stateIcons[kind];
  const Heading = `h${headingLevel}` as 'h1' | 'h2' | 'h3';
  const headingId = `route-state-${useId()}-title`.replaceAll(':', '');
  const role = kind === 'error' ? 'alert' : kind === 'loading' ? 'status' : undefined;
  const actionable = action?.href || action?.onClick ? action : undefined;

  return (
    <section
      aria-labelledby={headingId}
      className="relative isolate w-full overflow-hidden border-l-4 border-primary bg-background px-5 py-8 text-foreground sm:px-8 sm:py-10"
      role={role}
    >
      <div className="flex max-w-2xl items-start gap-4 sm:gap-5">
        <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-primary">
          <Icon
            aria-hidden={true}
            className={kind === 'loading' ? 'size-5 motion-safe:animate-spin motion-reduce:animate-none' : 'size-5'}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {stateLabels[kind]}
          </p>
          <Heading id={headingId} className="mt-2 text-balance text-2xl font-semibold leading-tight sm:text-3xl">
            {title}
          </Heading>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
          {detail ? (
            <details className="mt-4 text-sm text-muted-foreground">
              <summary className="min-h-11 cursor-pointer py-3 font-medium text-foreground">Ver detalle</summary>
              <p className="border-l border-border pl-3 leading-6">{detail}</p>
            </details>
          ) : null}
          {actionable ? (
            <div className="mt-6">
              {actionable.href ? (
                <Button asChild className="min-h-11">
                  <a href={actionable.href}>{actionable.label}</a>
                </Button>
              ) : (
                <Button type="button" onClick={actionable.onClick} className="min-h-11">
                  {kind === 'error' ? <RotateCw data-icon="inline-start" aria-hidden="true" /> : null}
                  {actionable.label}
                </Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
