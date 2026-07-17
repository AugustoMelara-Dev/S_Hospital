import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { Card, Statistic } from 'antd';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'destructive';

const toneStyles: Record<Tone, string> = {
  neutral: 'border-border bg-surface text-foreground',
  info: 'border-info/35 bg-info/10 text-info-foreground dark:text-info-foreground',
  success: 'border-success/35 bg-success/10 text-success-foreground dark:text-success-foreground',
  warning: 'border-warning/40 bg-warning/10 text-warning-foreground dark:text-warning-foreground',
  destructive: 'border-error/40 bg-error/10 text-error-foreground dark:text-error-foreground',
};

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
    <div data-slot="stat-grid" className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-4', className)} {...props}>
      {items?.map((item, index) => (
        <Card
          key={index}
          data-slot="stat-grid-item"
          className={cn('relative overflow-hidden border border-border bg-surface p-5 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-secondary/70', item.tone && toneStyles[item.tone])}
          classNames={{ body: 'p-0' }}
        >
          <div className="flex items-start justify-between gap-3">
            <Statistic
              className="min-w-0"
              title={<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</span>}
              value={0}
              formatter={() => item.value}
              classNames={{ content: 'mt-3 text-2xl font-semibold tracking-tight text-foreground', value: 'tabular-nums' }}
            />
            {item.icon ? <span className="shrink-0 text-primary [&_svg]:size-4">{item.icon}</span> : null}
          </div>
          {item.helper ? <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{item.helper}</p> : null}
        </Card>
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
    <Card
      data-slot="stat-card"
      className={cn(
        'relative overflow-hidden border border-border bg-surface p-5 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-secondary/70',
        toneStyles[tone],
        className,
      )}
      classNames={{ body: 'p-0' }}
      {...props}
    >
      <div className={cn('flex gap-3', align === 'vertical' ? 'flex-col' : 'items-start justify-between')}>
        <Statistic
          className="min-w-0"
          title={<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>}
          value={0}
          formatter={() => value}
          classNames={{ content: 'mt-3 text-2xl font-semibold tracking-tight text-foreground', value: 'tabular-nums' }}
        />
        {icon ? (
          <span className={cn('shrink-0 text-primary [&_svg]:size-4', align === 'vertical' && 'self-end')}>
            {icon}
          </span>
        ) : null}
      </div>
      {helper ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{helper}</p> : null}
    </Card>
  );
}

type SectionCardProps = HTMLAttributes<HTMLElement> & {
  actions?: ReactNode;
  as?: 'section' | 'div';
  description?: ReactNode;
  footer?: ReactNode;
  title?: ReactNode;
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
    <Comp ref={ref as never} className={className} {...props}>
      <Card
        data-slot="section-card"
        className="border border-border bg-surface"
        title={title || description ? (
          <div className="min-w-0 py-1">
            {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm font-normal leading-relaxed text-muted-foreground">{description}</p> : null}
          </div>
        ) : undefined}
        extra={actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : undefined}
        classNames={{ body: 'p-5', header: 'border-b border-border' }}
      >
        <div data-slot="section-card-content" className="min-w-0">{children}</div>
        {footer ? <div data-slot="section-card-footer" className="mt-4 border-t border-border pt-4">{footer}</div> : null}
      </Card>
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
    <section data-slot="print-preview-frame" className={cn('border border-border bg-muted p-5', className)} {...props}>
      <div className="receipt-preview-controls no-print flex flex-wrap items-center gap-2 pb-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      <div data-slot="print-preview-viewport" className="receipt-preview-container mt-4">{children}</div>
    </section>
  );
}
