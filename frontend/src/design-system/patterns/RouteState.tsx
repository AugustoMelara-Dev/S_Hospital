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
import { AdminCallout, type AdminCalloutTone } from '@/design-system/admin/components';

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

/* El detalle técnico es un aviso; el tono sigue el estado sin cambiar su semántica. */
const detailTones: Record<RouteStateKind, AdminCalloutTone> = {
  denied: 'warn',
  empty: 'info',
  error: 'error',
  loading: 'info',
  offline: 'warn',
  'not-found': 'info',
};

/*
 * Acciones admin: control nativo (permitido en superficie admin) con el
 * lenguaje "Panel administrativo": acción cobalto, contorno hairline y foco
 * navy de 2 px. `data-variant` conserva el contrato observable de la acción
 * secundaria (denied) sin depender del primitivo shadcn.
 */
const actionBase =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--ui-radius-control)] px-4 text-[length:var(--ui-text-base)] font-semibold outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';
const actionPrimary =
  'bg-[var(--ui-action)] text-[color:var(--ui-action-foreground)] hover:bg-[var(--ui-action-hover)]';
const actionOutline =
  'border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] text-[color:var(--ui-ink)] hover:bg-[var(--ui-surface-alt)]';

export function RouteState({ action, description, detail, headingLevel = 1, kind, title }: RouteStateProps) {
  const Heading = `h${headingLevel}` as 'h1' | 'h2' | 'h3';
  const headingId = `route-state-${useId()}-title`.replaceAll(':', '');
  const role = kind === 'error' ? 'alert' : kind === 'loading' ? 'status' : undefined;
  const actionable = action?.href || action?.onClick ? action : undefined;
  const actionVariant = kind === 'denied' ? 'outline' : 'default';
  const actionClassName = `${actionBase} ${actionVariant === 'outline' ? actionOutline : actionPrimary}`;

  return (
    <section
      aria-labelledby={headingId}
      className="w-full overflow-hidden rounded-[var(--ui-radius-panel)] border border-[var(--ui-line)] bg-[var(--ui-surface)] px-5 py-8 text-[color:var(--ui-ink)] sm:px-8 sm:py-10"
      role={role}
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] text-[color:var(--ui-navy)] [&_svg]:size-6">
          {stateIcons[kind]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-wider text-[color:var(--ui-ink-soft)]">
            {stateLabels[kind]}
          </p>
          <Heading
            id={headingId}
            className="mt-2 text-balance text-[length:var(--ui-text-xl)] font-semibold leading-tight text-[color:var(--ui-ink)] sm:text-[length:var(--ui-text-2xl)]"
          >
            {title}
          </Heading>
          <p className="mx-auto mt-3 max-w-xl text-[length:var(--ui-text-sm)] leading-6 text-[color:var(--ui-ink-soft)] sm:text-[length:var(--ui-text-base)]">
            {description}
          </p>
          {detail ? (
            <Accordion type="single" collapsible className="mt-4 text-left">
              <AccordionItem
                value="detail"
                className="rounded-[var(--ui-radius-control)] border border-[var(--ui-line)] px-3"
              >
                <AccordionTrigger>Ver detalle</AccordionTrigger>
                <AccordionContent forceMount>
                  <AdminCallout tone={detailTones[kind]}>{detail}</AdminCallout>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : null}
          {actionable ? (
            <div className="mt-6">
              {actionable.href ? (
                <a
                  href={actionable.href}
                  data-variant={actionVariant}
                  data-ui-press
                  className={actionClassName}
                >
                  {actionable.label}
                </a>
              ) : (
                <button
                  type="button"
                  data-variant={actionVariant}
                  data-ui-press
                  className={actionClassName}
                  onClick={actionable.onClick}
                >
                  {actionable.label}
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
