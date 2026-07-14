import {
  forwardRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/utils';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'destructive';

const toneStyles: Record<Tone, string> = {
  neutral: 'border-border bg-surface text-foreground',
  info: 'border-info/35 bg-info/10 text-info-foreground dark:text-info-foreground',
  success: 'border-success/35 bg-success/10 text-success-foreground dark:text-success-foreground',
  warning: 'border-warning/40 bg-warning/10 text-warning-foreground dark:text-warning-foreground',
  destructive: 'border-error/40 bg-error/10 text-error-foreground dark:text-error-foreground',
};

export const AppSurface = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function AppSurface({
  className,
  ...props
}, ref) {
  return (
    <div
      ref={ref}
      data-slot="app-surface"
      className={cn('min-h-dvh bg-background text-foreground', className)}
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
          <p data-slot="section-header-eyebrow" className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
      <div className="flex">
        <div aria-hidden="true" className={cn('w-1 shrink-0 bg-primary', tone === 'warning' && 'bg-warning', tone === 'destructive' && 'bg-error', tone === 'success' && 'bg-success', tone === 'info' && 'bg-info')} />
        <div className="min-w-0 flex-1 p-5">
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
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{item.value}</p>
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
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
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
