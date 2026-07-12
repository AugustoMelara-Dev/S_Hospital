import { useId as useReactId } from 'react';
import {
  WarningOutlined,
  DollarOutlined,
  CheckOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { Tag, Radio } from 'antd';
import { cn } from '../../lib/utils';
import { MoneyText } from '../ui/money-text';
import { formatDateTimeEs } from '../../lib/format/formatDate';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'destructive';

const toneStyles: Record<Tone, string> = {
  neutral: 'border-border bg-surface text-foreground',
  info: 'border-info/35 bg-info/10 text-info-foreground dark:text-info-foreground',
  success: 'border-success/35 bg-success/10 text-success-foreground dark:text-success-foreground',
  warning: 'border-warning/40 bg-warning/10 text-warning-foreground dark:text-warning-foreground',
  destructive: 'border-error/40 bg-error/10 text-error-foreground dark:text-error-foreground',
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
      className={cn('min-h-[100dvh] bg-background text-foreground', className)}
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
      className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-border pb-4', className)}
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
      className={cn('border bg-surface p-5', toneStyles[tone], className)}
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
        'border border-border bg-surface p-5',
        className,
      )}
      {...props}
    >
      {title || description || actions ? (
        <div data-slot="command-panel-header" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-3">
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
      {footer ? <div data-slot="command-panel-footer" className="mt-4 border-t border-border pt-4">{footer}</div> : null}
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
      className={cn('border border-border bg-surface p-5', className)}
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
      {footer ? <div className="mt-4 border-t border-border pt-4">{footer}</div> : null}
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
      className={cn('overflow-hidden border bg-surface', toneStyles[tone], className)}
      {...props}
    >
      <div className="grid grid-cols-[0.35rem_minmax(0,1fr)]">
        <div aria-hidden="true" className={cn('bg-primary', tone === 'warning' && 'bg-warning', tone === 'destructive' && 'bg-error', tone === 'success' && 'bg-success', tone === 'info' && 'bg-info')} />
        <div className="min-w-0 p-5">
          {title || description || actions || status ? (
            <div data-slot="workflow-panel-header" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-3">
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
          {footer ? <div data-slot="workflow-panel-footer" className="mt-4 border-t border-border pt-4">{footer}</div> : null}
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
      className={cn('border border-border bg-surface p-5', className)}
      {...props}
    >
      {title || description || actions ? (
        <figcaption data-slot="chart-card-header" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-3">
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
      {footer ? <div data-slot="chart-card-footer" className="mt-4 border-t border-border pt-4">{footer}</div> : null}
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
            className="size-2.5 border border-black/5"
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
          className={cn('relative overflow-hidden border border-border bg-surface p-5 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-secondary/70', item.tone && toneStyles[item.tone])}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
              <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-foreground tabular-nums">{item.value}</p>
            </div>
            {item.icon ? <span className="shrink-0 text-primary [&_svg]:size-4">{item.icon}</span> : null}
          </div>
          {item.helper ? <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{item.helper}</p> : null}
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
        'relative overflow-hidden border border-border bg-surface p-5 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-secondary/70',
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
          <p className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-foreground tabular-nums">{value}</p>
        </div>
        {icon ? (
          <span className={cn('shrink-0 text-primary [&_svg]:size-4', align === 'vertical' && 'self-end')}>
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
        'border border-border bg-surface p-5',
        className,
      )}
      {...props}
    >
      {title || description || actions ? (
        <div data-slot="section-card-header" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-border pb-3">
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
      {footer ? <div data-slot="section-card-footer" className="mt-4 border-t border-border pt-4">{footer}</div> : null}
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
  return (
    <div
      data-slot="info-panel"
      role={tone === 'warning' || tone === 'destructive' ? 'alert' : 'status'}
      className={cn('flex flex-col gap-3 border p-4 text-sm sm:flex-row sm:items-start sm:justify-between', toneStyles[tone], className)}
      {...props}
    >
      <div className="flex min-w-0 gap-3">
        <span aria-hidden="true" className="mt-0.5 shrink-0 [&_svg]:size-4">
          {icon ?? <WarningOutlined />}
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
  description = 'Verifique la conexion local con el servidor antes de continuar.',
  title = 'Servidor local no disponible',
  ...props
}: HTMLAttributes<HTMLDivElement> & { action?: ReactNode; description?: ReactNode; title?: ReactNode }) {
  return (
    <div
      data-slot="offline-state"
      role="alert"
      className={cn('border border-warning/40 bg-warning/10 p-5 text-warning-foreground dark:text-warning-foreground', className)}
      {...props}
    >
      <div className="flex gap-3">
        <WarningOutlined aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
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
      icon: WarningOutlined,
      title: 'Acceso restringido',
      description: 'Tu usuario no tiene permiso para esta acción.',
    },
    readonly: {
      icon: WarningOutlined,
      title: 'Solo lectura',
      description: 'Puedes revisar esta información, pero no modificarla.',
    },
    unavailable: {
      icon: WarningOutlined,
      title: 'Acción no disponible',
      description: 'La acción está bloqueada por el estado actual.',
    },
  }[state];
  const Icon = content.icon;

  return (
    <div
      data-slot="permission-state"
      role="status"
      className={cn('border border-warning/40 bg-warning/10 p-5 text-warning-foreground dark:text-warning-foreground', className)}
      {...props}
    >
      <div className="flex gap-3">
        <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
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
      data-tone={tone}
      className={cn(
        'relative isolate overflow-hidden border border-border bg-slate-900 p-5 text-white sm:p-7',
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          {meta ? <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">{meta}</div> : null}
          <TitleTag className="text-2xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-3xl">{title}</TitleTag>
          {description ? <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-300">{description}</p> : null}
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

  const tagColorMap = {
    open: 'success',
    closed: 'default',
    pending: 'warning',
    attention: 'error',
  } as const;

  return (
    <section
      data-slot="cash-status-card"
      className={cn('border bg-surface p-5', toneStyles[tone], className)}
      {...props}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <DollarOutlined className="size-5 text-primary" />
            <strong className="text-2xl font-semibold tabular-nums text-foreground">{amount ?? statusLabel}</strong>
          </div>
        </div>
        <Tag color={tagColorMap[status]}>{statusLabel}</Tag>
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
      {actions ? <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">{actions}</div> : null}
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
      icon: CheckOutlined,
      label: 'Permitido',
      color: 'success' as const,
    },
    readonly: {
      icon: CheckOutlined,
      label: 'Solo lectura',
      color: 'processing' as const,
    },
    denied: {
      icon: WarningOutlined,
      label: 'Restringido',
      color: 'warning' as const,
    },
    system: {
      icon: WarningOutlined,
      label: 'Sistema',
      color: 'default' as const,
    },
  }[state];
  const Icon = config.icon;

  return (
    <Tag
      data-slot="permission-badge"
      color={config.color}
      className={cn('text-[11px] px-2 py-0.5', className)}
      title={permission ? `${config.label}: ${permission}` : config.label}
      {...props}
    >
      <span className="inline-flex items-center gap-1">
        <Icon className="text-[10px]" />
        {children ?? config.label}
      </span>
    </Tag>
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
        'group flex h-auto min-h-24 w-full items-start justify-start gap-3 border border-border bg-surface p-4 text-left transition hover:border-primary/45 hover:bg-slate-50 dark:hover:bg-slate-800',
        className,
      )}
      {...props}
    >
      <span className="flex size-9 shrink-0 items-center justify-center bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white">
        {icon ?? <FileTextOutlined className="size-4" />}
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
      className={cn('border border-border bg-surface p-5', className)}
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
      className={cn('sticky bottom-0 z-30 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur md:hidden', className)}
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
      className={cn('border border-border bg-muted p-5', className)}
      {...props}
    >
      <div className="receipt-preview-controls no-print flex flex-wrap items-center gap-2 pb-3">
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
  code: 'carta' | 'media_carta' | 'a5';
  description: string;
  label: string;
  size: string;
};

export const PAPER_PROFILES: readonly PaperProfile[] = [
  { code: 'carta', label: 'Carta', size: '216 × 279 mm', description: 'Documento completo' },
  { code: 'media_carta', label: 'Media carta', size: '216 × 140 mm', description: 'Recibo institucional' },
  { code: 'a5', label: 'A5', size: '148 × 210 mm', description: 'Formato compacto' },
] as const;

type PaperProfileSelectorProps = {
  className?: string;
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
}: PaperProfileSelectorProps & Record<string, unknown>) {
  const helperId = useReactId();
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <Radio.Group
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 w-full"
        aria-label="Tipo de papel del recibo"
        aria-describedby={helperText ? helperId : undefined}
        {...props}
      >
        {options.map((option) => {
          const isActive = option.code === value;
          return (
            <label
              key={option.code}
              className={cn(
                'flex flex-col items-start gap-1 border bg-surface p-4 text-left transition cursor-pointer select-none',
                isActive
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/40'
                  : 'border-border',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="text-sm font-semibold leading-tight text-foreground">{option.label}</span>
                <Radio value={option.code} />
              </span>
              <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{option.size}</span>
              <span className="text-xs leading-relaxed text-muted-foreground">{option.description}</span>
            </label>
          );
        })}
      </Radio.Group>
      {helperText ? (
        <p id={helperId} className="text-xs leading-5 text-muted-foreground">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

export function MoneyDisplay({
  amountCents,
  className,
  emphasis = 'normal',
  tone = 'default',
}: {
  amountCents: number;
  className?: string;
  emphasis?: 'normal' | 'strong';
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'muted';
}) {
  return (
    <MoneyText
      amountCents={amountCents}
      className={className}
      emphasis={emphasis}
      tone={tone}
    />
  );
}

export function DateDisplay({
  value,
  className,
}: {
  value: string | Date | null | undefined;
  className?: string;
}) {
  return (
    <span className={cn('tabular-nums text-muted-foreground', className)}>
      {formatDateTimeEs(value)}
    </span>
  );
}

export function NumberDisplay({
  value,
  className,
  decimals = 0,
}: {
  value: number;
  className?: string;
  decimals?: number;
}) {
  const formattedValue = new Intl.NumberFormat('es-HN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);

  return (
    <span className={cn('tabular-nums font-mono', className)}>
      {formattedValue}
    </span>
  );
}
