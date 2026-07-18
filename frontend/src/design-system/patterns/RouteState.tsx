import { useId, type ReactNode } from 'react';
import {
  CircleAlertIcon,
  CircleXIcon,
  FileQuestionIcon,
  InboxIcon,
  LoaderCircleIcon,
  UnplugIcon,
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';

export type RouteStateKind = 'loading' | 'empty' | 'error' | 'denied' | 'offline' | 'not-found';

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

const stateIcons: Record<RouteStateKind, ReactNode> = {
  denied: <CircleXIcon />,
  empty: <InboxIcon />,
  error: <CircleAlertIcon />,
  loading: <LoaderCircleIcon className="animate-spin" />,
  offline: <UnplugIcon />,
  'not-found': <FileQuestionIcon />,
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
  const Heading = `h${headingLevel}` as 'h1' | 'h2' | 'h3';
  const headingId = `route-state-${useId()}-title`.replaceAll(':', '');
  const role = kind === 'error' ? 'alert' : kind === 'loading' ? 'status' : undefined;
  const actionable = action?.href || action?.onClick ? action : undefined;

  return (
    <section
      aria-labelledby={headingId}
      className="w-full overflow-hidden rounded-xl bg-card px-5 py-8 text-card-foreground ring-1 ring-foreground/10 sm:px-8 sm:py-10"
      role={role}
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground [&_svg]:size-6">
          {stateIcons[kind]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stateLabels[kind]}</p>
          <Heading id={headingId} className="mt-2 text-balance text-2xl font-semibold leading-tight sm:text-3xl">
            {title}
          </Heading>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
          {detail ? (
            <Accordion type="single" collapsible className="mt-4 text-left">
              <AccordionItem value="detail" className="rounded-lg border px-3">
                <AccordionTrigger>Ver detalle</AccordionTrigger>
                <AccordionContent forceMount>
                  <p className="border-l border-border pl-3 leading-6 text-muted-foreground">{detail}</p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : null}
          {actionable ? (
            <div className="mt-6">
              {actionable.href ? (
                <Button asChild size="lg"><a href={actionable.href}>{actionable.label}</a></Button>
              ) : (
                <Button size="lg" onClick={actionable.onClick}>{actionable.label}</Button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
