import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'destructive';

const toneStyles: Record<Tone, string> = {
  neutral: 'bg-card text-card-foreground',
  info: 'bg-info/10 text-info-foreground ring-info/35',
  success: 'bg-success/10 text-success-foreground ring-success/35',
  warning: 'bg-warning/10 text-warning-foreground ring-warning/40',
  destructive: 'bg-destructive/10 text-destructive ring-destructive/40',
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

function StatisticContent({ helper, icon, label, value }: StatGridItem) {
  return (
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</div>
        </div>
        {icon ? <span className="shrink-0 text-primary [&_svg]:size-4">{icon}</span> : null}
      </div>
      {helper ? <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{helper}</p> : null}
    </CardContent>
  );
}

export function StatGrid({ children, className, items, ...props }: StatGridProps) {
  return (
    <div data-slot="stat-grid" className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)} {...props}>
      {items?.map((item, index) => (
        <Card
          key={index}
          data-slot="stat-grid-item"
          className={cn(
            'relative gap-0 overflow-hidden py-0 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary/70',
            item.tone && toneStyles[item.tone],
          )}
        >
          <StatisticContent {...item} />
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
        'relative gap-0 overflow-hidden py-0 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-primary/70',
        toneStyles[tone],
        className,
      )}
      {...props}
    >
      <CardContent className="p-5">
        <div className={cn('flex gap-3', align === 'vertical' ? 'flex-col' : 'items-start justify-between')}>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
            <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</div>
          </div>
          {icon ? (
            <span className={cn('shrink-0 text-primary [&_svg]:size-4', align === 'vertical' && 'self-end')}>
              {icon}
            </span>
          ) : null}
        </div>
        {helper ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{helper}</p> : null}
      </CardContent>
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
  const Comp = as;
  return (
    <Comp ref={ref as never} className={className} {...props}>
      <Card data-slot="section-card">
        {title || description || actions ? (
          <CardHeader className="border-b">
            <div className="min-w-0">
              {title ? <CardTitle><h2>{title}</h2></CardTitle> : null}
              {description ? <CardDescription className="mt-1 leading-relaxed">{description}</CardDescription> : null}
            </div>
            {actions ? <CardAction className="flex flex-wrap items-center gap-2">{actions}</CardAction> : null}
          </CardHeader>
        ) : null}
        <CardContent data-slot="section-card-content" className="min-w-0">{children}</CardContent>
        {footer ? <CardFooter data-slot="section-card-footer">{footer}</CardFooter> : null}
      </Card>
    </Comp>
  );
});

type PrintPreviewFrameProps = HTMLAttributes<HTMLDivElement> & {
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
    <Card data-slot="print-preview-frame" className={cn('bg-muted', className)} {...props}>
      <CardHeader className="receipt-preview-controls no-print border-b">
        <div className="min-w-0">
          <CardTitle><h2>{title}</h2></CardTitle>
          {description ? <CardDescription className="mt-1 leading-relaxed">{description}</CardDescription> : null}
        </div>
        {actions ? <CardAction className="flex flex-wrap items-center gap-2">{actions}</CardAction> : null}
      </CardHeader>
      <CardContent data-slot="print-preview-viewport" className="receipt-preview-container">{children}</CardContent>
    </Card>
  );
}
