import { useId, type ReactNode } from 'react';
import {
  CloseCircleOutlined,
  DisconnectOutlined,
  ExclamationCircleOutlined,
  FileUnknownOutlined,
  InboxOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { Button, Collapse } from 'antd';

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

const stateIcons: Record<RouteStateKind, ReactNode> = {
  denied: <CloseCircleOutlined />,
  empty: <InboxOutlined />,
  error: <ExclamationCircleOutlined />,
  loading: <LoadingOutlined />,
  offline: <DisconnectOutlined />,
  'not-found': <FileUnknownOutlined />,
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
      className="w-full overflow-hidden border border-border bg-surface px-5 py-8 text-foreground sm:px-8 sm:py-10"
      role={role}
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center sm:gap-5">
        <span className="flex size-14 shrink-0 items-center justify-center bg-accent text-secondary text-xl">
          {stateIcons[kind]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {stateLabels[kind]}
          </p>
          <Heading id={headingId} className="mt-2 text-balance text-2xl font-semibold leading-tight sm:text-3xl">
            {title}
          </Heading>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
          {detail ? (
            <Collapse
              className="mt-4 border border-border bg-muted/30 text-left text-sm"
              items={[{
                key: 'detail',
                label: 'Ver detalle',
                forceRender: true,
                children: <p className="border-l border-border pl-3 leading-6 text-muted-foreground">{detail}</p>,
              }]}
            />
          ) : null}
          {actionable ? (
            <div className="mt-6">
              {actionable.href ? (
                <Button type="primary" href={actionable.href} className="min-h-11">
                  {actionable.label}
                </Button>
              ) : (
                <Button
                  type="primary"
                  onClick={actionable.onClick}
                  className="min-h-11"
                >
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
