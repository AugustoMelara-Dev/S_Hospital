import { useId as useReactId } from 'react';
import {
  AlertTriangle,
  Banknote,
  Check,
  ReceiptText,
  type LucideIcon,
} from 'lucide-react';
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/badge';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'destructive';

const toneStyles: Record<Tone, string> = {
  neutral: 'border-operational-border bg-operational-surface text-foreground',
  info: 'border-info/35 bg-info/10 text-info-foreground dark:text-info-foreground',
  success: 'border-success/35 bg-success/10 text-success-foreground dark:text-success-foreground',
  warning: 'border-warning/40 bg-warning/10 text-warning-foreground dark:text-warning-foreground',
  destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
};

const toneIcons: Record<Tone, LucideIcon> = {
  neutral: AlertTriangle,
  info: AlertTriangle,
  success: AlertTriangle,
  warning: AlertTriangle,
  destructive: AlertTriangle,
};

const receiptFormatClasses = {
  letter: 'receipt-letter',
  'half-letter': 'receipt-half-letter',
  a5: 'receipt-a5',
  '80mm': 'receipt-80mm',
  '58mm': 'receipt-58mm',
};

export type ReceiptFormat = keyof typeof receiptFormatClasses;

export const AppSurface = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function AppSurface({
  className,
  ...props
}, ref) {
  return (
    <div
      ref={ref}
      data-slot="app-surface"
      className={cn('min-h-[100dvh] bg-operational-bg text-foreground', className)}
      {...props}
    />
  );
});

export const PageShell = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(function PageShell({
  className,
  ...props
}, ref) {
  return (
    <main
      ref={ref}
      data-slot="page-shell"
      className={cn('mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8', className)}
      {...props}
    />
  );
});

type SectionHeaderProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  headingLevel?: 1 | 2 | 3 | 4;
  title: ReactNode;
};

export function SectionHeader({
  actions,
  className,
  description,
  eyebrow,
  headingLevel = 2,
  title,
  ...props
}: SectionHeaderProps) {
  const HeadingTag = `h${headingLevel}` as 'h1' | 'h2' | 'h3' | 'h4';

  return (
    <header
      data-slot="section-header"
      className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}
      {...props}
    >
      <div data-slot="section-header-main" className="min-w-0">
        {eyebrow ? (
          <p data-slot="section-header-eyebrow" className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </p>
        ) : null}
        <HeadingTag data-slot="section-header-title" className="text-xl font-semibold leading-tight text-foreground sm:text-2xl">
          {title}
        </HeadingTag>
        {description ? (
          <p data-slot="section-header-description" className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div data-slot="section-header-actions" className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export const ModuleHeader = SectionHeader;

type CommandCenterHeaderProps = OperationalBannerProps & {
  metrics?: ReactNode;
};

export function CommandCenterHeader({
  actions,
  className,
  description,
  meta,
  metrics,
  status,
  title,
  tone = 'neutral',
  ...props
}: CommandCenterHeaderProps) {
  return (
    <section
      data-slot="command-center-header"
      className={cn('rounded-panel border bg-operational-surface p-panel shadow-command', toneStyles[tone], className)}
      {...props}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0">
          {meta ? <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{meta}</div> : null}
          <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">{title}</h1>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
          {metrics ? <div className="mt-5">{metrics}</div> : null}
        </div>
        {(status || actions) ? (
          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            {status}
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}

type PanelProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  title?: ReactNode;
  titleLevel?: 1 | 2 | 3;
};

export const CommandPanel = forwardRef<HTMLElement, PanelProps>(function CommandPanel({
  actions,
  children,
  className,
  description,
  footer,
  title,
  titleLevel = 2,
  ...props
}, ref) {
  const TitleTag = `h${titleLevel}` as const;

  return (
    <section
      ref={ref}
      data-slot="command-panel"
      className={cn(
        'rounded-panel border border-operational-border bg-operational-surface p-panel shadow-operational',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
        className,
      )}
      {...props}
    >
      {title || description || actions ? (
        <div data-slot="command-panel-header" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? <TitleTag className="text-base font-semibold text-foreground">{title}</TitleTag> : null}
            {description ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div data-slot="command-panel-content" className="min-w-0">
        {children}
      </div>
      {footer ? <div data-slot="command-panel-footer" className="mt-4 border-t border-operational-border pt-4">{footer}</div> : null}
    </section>
  );
});

export const PrimaryActionPanel = forwardRef<HTMLElement, PanelProps & { emphasis?: ReactNode }>(function PrimaryActionPanel({
  actions,
  children,
  className,
  description,
  emphasis,
  footer,
  title,
  ...props
}, ref) {
  return (
    <section
      ref={ref}
      data-slot="primary-action-panel"
      className={cn('rounded-panel border border-hospital-border bg-hospital-surface p-panel shadow-command', className)}
      {...props}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          {title ? <h2 className="text-lg font-semibold text-foreground">{title}</h2> : null}
          {description ? <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
          {children ? <div className="mt-4 min-w-0">{children}</div> : null}
        </div>
        {(emphasis || actions) ? (
          <div className="flex shrink-0 flex-col gap-3 lg:items-end">
            {emphasis ? <div className="text-2xl font-semibold tabular-nums text-foreground">{emphasis}</div> : null}
            {actions ? <div className="flex flex-wrap items-center gap-2 lg:justify-end">{actions}</div> : null}
          </div>
        ) : null}
      </div>
      {footer ? <div className="mt-4 border-t border-operational-border pt-4">{footer}</div> : null}
    </section>
  );
});

export const WorkflowPanel = forwardRef<HTMLElement, PanelProps & { status?: ReactNode; tone?: Tone }>(function WorkflowPanel({
  actions,
  children,
  className,
  description,
  footer,
  status,
  title,
  tone = 'neutral',
  ...props
}, ref) {
  return (
    <section
      ref={ref}
      data-slot="workflow-panel"
      className={cn('overflow-hidden rounded-panel border bg-operational-surface shadow-operational', toneStyles[tone], className)}
      {...props}
    >
      <div className="grid grid-cols-[0.35rem_minmax(0,1fr)]">
        <div aria-hidden="true" className={cn('bg-hospital-primary', tone === 'warning' && 'bg-warning', tone === 'destructive' && 'bg-destructive', tone === 'success' && 'bg-success', tone === 'info' && 'bg-info')} />
        <div className="min-w-0 p-panel">
          {title || description || actions || status ? (
            <div data-slot="workflow-panel-header" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : null}
                {description ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
              </div>
              {(actions || status) ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {status}
                  {actions}
                </div>
              ) : null}
            </div>
          ) : null}
          <div data-slot="workflow-panel-content" className="min-w-0">
            {children}
          </div>
          {footer ? <div data-slot="workflow-panel-footer" className="mt-4 border-t border-operational-border pt-4">{footer}</div> : null}
        </div>
      </div>
    </section>
  );
});

type ChartCardProps = PanelProps & {
  caption?: ReactNode;
};

export function ChartCard({
  actions,
  caption,
  children,
  className,
  description,
  footer,
  title,
  ...props
}: ChartCardProps) {
  const titleId = useReactId();
  const descriptionId = useReactId();

  return (
    <figure
      data-slot="chart-card"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={description || caption ? descriptionId : undefined}
      className={cn('rounded-panel border border-operational-border bg-operational-surface p-panel shadow-operational', className)}
      {...props}
    >
      {title || description || actions ? (
        <figcaption data-slot="chart-card-header" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? <h2 id={titleId} className="text-base font-semibold text-foreground">{title}</h2> : null}
            {description ? <p id={descriptionId} className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </figcaption>
      ) : null}
      <div data-slot="chart-card-content" className="min-h-64 min-w-0">
        {children}
      </div>
      {caption && !description ? <p id={descriptionId} className="mt-3 text-xs text-muted-foreground">{caption}</p> : null}
      {footer ? <div data-slot="chart-card-footer" className="mt-4 border-t border-operational-border pt-4">{footer}</div> : null}
    </figure>
  );
}

type ChartLegendItem = {
  color?: string;
  label: ReactNode;
  value?: ReactNode;
};

export function ChartLegend({
  className,
  items,
  ...props
}: HTMLAttributes<HTMLDivElement> & { items: ChartLegendItem[] }) {
  return (
    <div data-slot="chart-legend" className={cn('flex flex-wrap items-center gap-3 text-xs text-muted-foreground', className)} {...props}>
      {items.map((item, index) => (
        <span key={index} className="inline-flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-sm border border-black/5"
            style={{ backgroundColor: item.color ?? `var(--color-chart-${(index % 8) + 1})` }}
          />
          <span className="font-medium text-foreground">{item.label}</span>
          {item.value ? <span className="tabular-nums">{item.value}</span> : null}
        </span>
      ))}
    </div>
  );
}

type StatGridItem = {
  helper?: ReactNode;
  icon?: ReactNode;
  label: ReactNode;
  tone?: Tone;
  value: ReactNode;
};

type StatGridProps = HTMLAttributes<HTMLDivElement> & {
  items?: StatGridItem[];
};

export function StatGrid({ children, className, items, ...props }: StatGridProps) {
  return (
    <div
      data-slot="stat-grid"
      className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', className)}
      {...props}
    >
      {items?.map((item, index) => (
        <div
          key={index}
          data-slot="stat-grid-item"
          className={cn('rounded-panel border border-operational-border bg-operational-surface p-4 shadow-sm', item.tone && toneStyles[item.tone])}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{item.label}</p>
              <p className="mt-2 text-xl font-semibold text-foreground tabular-nums">{item.value}</p>
            </div>
            {item.icon ? <span className="shrink-0 text-hospital-primary [&_svg]:size-4">{item.icon}</span> : null}
          </div>
          {item.helper ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.helper}</p> : null}
        </div>
      ))}
      {children}
    </div>
  );
}

type StatCardProps = HTMLAttributes<HTMLDivElement> & StatGridItem & {
  align?: 'horizontal' | 'vertical';
};

export function StatCard({
  align = 'horizontal',
  className,
  helper,
  icon,
  label,
  tone = 'neutral',
  value,
  ...props
}: StatCardProps) {
  return (
    <div
      data-slot="stat-card"
      className={cn(
        'rounded-panel border border-operational-border bg-operational-surface p-4 shadow-sm',
        toneStyles[tone],
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'flex gap-3',
          align === 'vertical' ? 'flex-col' : 'items-start justify-between',
        )}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-xl font-semibold text-foreground tabular-nums">{value}</p>
        </div>
        {icon ? (
          <span className={cn('shrink-0 text-hospital-primary [&_svg]:size-4', align === 'vertical' && 'self-end')}>
            {icon}
          </span>
        ) : null}
      </div>
      {helper ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

type SectionCardProps = HTMLAttributes<HTMLElement> & PanelProps & {
  as?: 'section' | 'div';
};

export const SectionCard = forwardRef<HTMLElement, SectionCardProps>(function SectionCard({
  actions,
  as = 'section',
  children,
  className,
  description,
  footer,
  title,
  ...props
}, ref) {
  const Comp = as as unknown as 'section';
  return (
    <Comp
      ref={ref as never}
      data-slot="section-card"
      className={cn(
        'rounded-panel border border-operational-border bg-operational-surface p-panel shadow-operational',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background',
        className,
      )}
      {...props}
    >
      {title || description || actions ? (
        <div data-slot="section-card-header" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div data-slot="section-card-content" className="min-w-0">
        {children}
      </div>
      {footer ? <div data-slot="section-card-footer" className="mt-4 border-t border-operational-border pt-4">{footer}</div> : null}
    </Comp>
  );
});

type InfoPanelProps = HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
  tone?: Tone;
};

export function InfoPanel({
  actions,
  children,
  className,
  description,
  icon,
  title,
  tone = 'info',
  ...props
}: InfoPanelProps) {
  const Icon = toneIcons[tone];

  return (
    <div
      data-slot="info-panel"
      role={tone === 'warning' || tone === 'destructive' ? 'alert' : 'status'}
      className={cn('flex flex-col gap-3 rounded-panel border p-4 text-sm sm:flex-row sm:items-start sm:justify-between', toneStyles[tone], className)}
      {...props}
    >
      <div className="flex min-w-0 gap-3">
        <span aria-hidden="true" className="mt-0.5 shrink-0 [&_svg]:size-4">
          {icon ?? <Icon data-icon />}
        </span>
        <div className="min-w-0">
          <p className="font-semibold leading-tight">{title}</p>
          {description ? <p className="mt-1 leading-relaxed text-current/80">{description}</p> : null}
          {children ? <div className="mt-2 text-current/85">{children}</div> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function OfflineState({
  action,
  className,
  description = 'Verifique la conexion LAN con el servidor local antes de continuar.',
  title = 'Servidor local no disponible',
  ...props
}: HTMLAttributes<HTMLDivElement> & { action?: ReactNode; description?: ReactNode; title?: ReactNode }) {
  return (
    <div
      data-slot="offline-state"
      role="alert"
      className={cn('rounded-panel border border-warning/40 bg-warning/10 p-panel text-warning-foreground dark:text-warning-foreground', className)}
      {...props}
    >
      <div className="flex gap-3">
        <AlertTriangle data-icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm leading-relaxed text-current/85">{description}</p>
          {action ? <div className="mt-4 flex flex-wrap items-center gap-2">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

type PermissionStateProps = HTMLAttributes<HTMLDivElement> & {
  action?: ReactNode;
  description?: ReactNode;
  state?: 'denied' | 'readonly' | 'unavailable';
  title?: ReactNode;
};

export function PermissionState({
  action,
  className,
  description,
  state = 'denied',
  title,
  ...props
}: PermissionStateProps) {
  const content = {
    denied: {
      icon: AlertTriangle,
      title: 'Acceso restringido',
      description: 'Tu usuario no tiene permiso para esta accion.',
    },
    readonly: {
      icon: AlertTriangle,
      title: 'Solo lectura',
      description: 'Puedes revisar esta informacion, pero no modificarla.',
    },
    unavailable: {
      icon: AlertTriangle,
      title: 'Accion no disponible',
      description: 'La accion esta bloqueada por el estado actual.',
    },
  }[state];
  const Icon = content.icon;

  return (
    <div
      data-slot="permission-state"
      role="status"
      className={cn('rounded-panel border border-warning/40 bg-warning/10 p-panel text-warning-foreground dark:text-warning-foreground', className)}
      {...props}
    >
      <div className="flex gap-3">
        <Icon data-icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{title ?? content.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-current/85">{description ?? content.description}</p>
          {action ? <div className="mt-4 flex flex-wrap items-center gap-2">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

type OperationalBannerProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  status?: ReactNode;
  title: ReactNode;
  titleLevel?: 1 | 2 | 3;
  tone?: Tone;
};

export function OperationalBanner({
  actions,
  className,
  description,
  meta,
  status,
  title,
  titleLevel = 1,
  tone = 'neutral',
  ...props
}: OperationalBannerProps) {
  const TitleTag = `h${titleLevel}` as const;

  return (
    <section
      data-slot="operational-banner"
      className={cn('rounded-panel border bg-operational-surface p-panel shadow-operational', toneStyles[tone], className)}
      {...props}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          {meta ? <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{meta}</div> : null}
          <TitleTag className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">{title}</TitleTag>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
        {(status || actions) ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            {status}
            {actions}
          </div>
        ) : null}
      </div>
    </section>
  );
}

type CashStatusCardProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  amount?: ReactNode;
  cashier?: ReactNode;
  helper?: ReactNode;
  label?: ReactNode;
  status: 'open' | 'closed' | 'pending' | 'attention';
  timestamp?: ReactNode;
};

export function CashStatusCard({
  actions,
  amount,
  cashier,
  className,
  helper,
  label = 'Estado de caja',
  status,
  timestamp,
  ...props
}: CashStatusCardProps) {
  const tone: Tone = status === 'open' ? 'success' : status === 'closed' ? 'neutral' : 'warning';
  const statusLabel = {
    open: 'Abierta',
    closed: 'Cerrada',
    pending: 'Pendiente',
    attention: 'Requiere atencion',
  }[status];

  return (
    <section
      data-slot="cash-status-card"
      className={cn('rounded-panel border bg-operational-surface p-panel shadow-operational', toneStyles[tone], className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Banknote data-icon aria-hidden="true" className="size-5 text-hospital-primary" />
            <strong className="text-2xl font-semibold tabular-nums text-foreground">{amount ?? statusLabel}</strong>
          </div>
        </div>
        <Badge variant={tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : 'secondary'}>{statusLabel}</Badge>
      </div>
      {(cashier || timestamp) ? (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {cashier ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Cajero</dt>
              <dd className="mt-1 text-foreground">{cashier}</dd>
            </div>
          ) : null}
          {timestamp ? (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Actualizacion</dt>
              <dd className="mt-1 text-foreground">{timestamp}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {helper ? <p className="mt-4 text-sm text-muted-foreground">{helper}</p> : null}
      {actions ? <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-operational-border pt-4">{actions}</div> : null}
    </section>
  );
}

type PermissionBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  permission?: string;
  state?: 'granted' | 'readonly' | 'denied' | 'system';
};

export function PermissionBadge({
  children,
  className,
  permission,
  state = 'granted',
  ...props
}: PermissionBadgeProps) {
  const config = {
    granted: {
      icon: Check,
      label: 'Permitido',
      variant: 'success' as const,
    },
    readonly: {
      icon: Check,
      label: 'Solo lectura',
      variant: 'info' as const,
    },
    denied: {
      icon: Check,
      label: 'Restringido',
      variant: 'warning' as const,
    },
    system: {
      icon: AlertTriangle,
      label: 'Sistema',
      variant: 'secondary' as const,
    },
  }[state];
  const Icon = config.icon;

  return (
    <Badge
      data-slot="permission-badge"
      variant={config.variant}
      className={cn('rounded-md border border-current/10 text-[11px]', className)}
      title={permission ? `${config.label}: ${permission}` : config.label}
      {...props}
    >
      <Icon data-icon aria-hidden="true" className="size-3" />
      {children ?? config.label}
    </Badge>
  );
}

type QuickActionTileProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title'> & {
  description?: ReactNode;
  icon?: ReactNode;
  title: ReactNode;
};

export function QuickActionTile({
  className,
  description,
  icon,
  title,
  type = 'button',
  ...props
}: QuickActionTileProps) {
  return (
    <button
      type={type}
      data-slot="quick-action-tile"
      className={cn(
        'group flex min-h-24 w-full items-start gap-3 rounded-card border border-operational-border bg-operational-surface p-4 text-left shadow-sm transition hover:border-hospital-primary/45 hover:shadow-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-operational-ring',
        className,
      )}
      {...props}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-hospital-primary/10 text-hospital-primary group-hover:bg-hospital-primary group-hover:text-primary-foreground">
        {icon ?? <ReceiptText data-icon aria-hidden="true" className="size-4" />}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-foreground">{title}</span>
        {description ? <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">{description}</span> : null}
      </span>
    </button>
  );
}

export function SummaryRail({
  children,
  className,
  title,
  ...props
}: Omit<HTMLAttributes<HTMLElement>, 'title'> & { title?: ReactNode }) {
  return (
    <aside
      data-slot="summary-rail"
      className={cn('rounded-panel border border-operational-border bg-operational-surface p-panel shadow-panel', className)}
      {...props}
    >
      {title ? <h2 className="mb-4 text-base font-semibold text-foreground">{title}</h2> : null}
      <div className="grid gap-4">{children}</div>
    </aside>
  );
}

export function MobileStickyActionBar({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="mobile-sticky-action-bar"
      className={cn('sticky bottom-0 z-30 -mx-4 border-t border-operational-border bg-operational-surface/95 px-4 py-3 shadow-command backdrop-blur md:hidden', className)}
      {...props}
    >
      <div className="flex items-center justify-between gap-3">{children}</div>
    </div>
  );
}

type ReceiptDocumentShellProps = HTMLAttributes<HTMLDivElement> & {
  format?: ReceiptFormat;
  title?: ReactNode;
};

export function ReceiptDocumentShell({
  children,
  className,
  format = 'letter',
  title,
  ...props
}: ReceiptDocumentShellProps) {
  return (
    <div
      data-slot="receipt-document-shell"
      data-receipt-format={format}
      data-receipt-print-root
      className={cn('institutional-receipt border border-receipt-border', receiptFormatClasses[format], className)}
      {...props}
    >
      {title ? (
        <>
          <div className="receipt-header">
            <strong className="hospital-name">{title}</strong>
          </div>
          <div className="receipt-rule" />
        </>
      ) : null}
      {children}
    </div>
  );
}

type PrintPreviewFrameProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  description?: ReactNode;
  title?: ReactNode;
};

export function PrintPreviewFrame({
  actions,
  children,
  className,
  description,
  title = 'Vista previa',
  ...props
}: PrintPreviewFrameProps) {
  return (
    <section
      data-slot="print-preview-frame"
      className={cn('rounded-panel border border-operational-border bg-operational-panel p-panel', className)}
      {...props}
    >
      <div className="receipt-preview-controls no-print">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div data-slot="print-preview-viewport" className="receipt-preview-container mt-4">
        {children}
      </div>
    </section>
  );
}

export type PaperProfile = {
  code: 'carta' | 'media_carta' | 'a5' | '80mm' | '58mm';
  description: string;
  label: string;
  size: string;
};

export const PAPER_PROFILES: readonly PaperProfile[] = [
  { code: 'carta', label: 'Carta', size: 'US Letter 8.5 × 11 in', description: 'Formal, vertical' },
  { code: 'media_carta', label: 'Media carta', size: '8.5 × 5.5 in', description: 'Recomendado por defecto' },
  { code: 'a5', label: 'A5', size: '148 × 210 mm', description: 'Folleto apaisado' },
  { code: '80mm', label: 'Ticket 80 mm', size: '80 mm auto', description: 'Termica' },
  { code: '58mm', label: 'Ticket 58 mm', size: '58 mm auto', description: 'Termica compacta' },
] as const;

type PaperProfileSelectorProps = Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> & {
  disabled?: boolean;
  helperText?: string;
  onChange: (code: PaperProfile['code']) => void;
  options?: readonly PaperProfile[];
  value: PaperProfile['code'];
};

export function PaperProfileSelector({
  className,
  disabled = false,
  helperText,
  onChange,
  options = PAPER_PROFILES,
  value,
  ...props
}: PaperProfileSelectorProps) {
  return (
    <div
      data-slot="paper-profile-selector"
      role="radiogroup"
      aria-label="Tipo de papel del recibo"
      aria-describedby={helperText ? 'paper-profile-helper' : undefined}
      className={cn('grid gap-3 sm:grid-cols-2 lg:grid-cols-3', className)}
      {...props}
    >
      {options.map((option) => {
        const isActive = option.code === value;
        return (
          <button
            key={option.code}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={disabled}
            onClick={() => onChange(option.code)}
            className={cn(
              'flex flex-col items-start gap-1 rounded-panel border bg-operational-surface p-4 text-left shadow-sm transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'hover:border-hospital-primary/45 hover:shadow-panel',
              isActive
                ? 'border-hospital-primary bg-hospital-primary/5 ring-2 ring-hospital-primary/40'
                : 'border-operational-border',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="text-sm font-semibold leading-tight text-foreground">{option.label}</span>
              {isActive ? (
                <Check aria-hidden="true" className="size-4 text-hospital-primary" />
              ) : (
                <span aria-hidden="true" className="size-4 rounded-full border border-operational-border" />
              )}
            </span>
            <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{option.size}</span>
            <span className="text-xs leading-relaxed text-muted-foreground">{option.description}</span>
          </button>
        );
      })}
      {helperText ? (
        <p id="paper-profile-helper" className="col-span-full text-xs leading-5 text-muted-foreground">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
