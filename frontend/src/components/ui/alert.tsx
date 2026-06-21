import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  icon?: ReactNode;
  title?: string;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
};

const variants = {
  default: 'border-border bg-card text-card-foreground',
  success: 'border-success/30 bg-success/10 text-success-foreground dark:text-success-foreground',
  warning: 'border-warning/35 bg-warning/10 text-warning-foreground dark:text-warning-foreground',
  destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
};

const icons = {
  default: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: AlertTriangle,
};

export function Alert({
  children,
  className,
  icon,
  title,
  variant = 'default',
  ...props
}: AlertProps) {
  const Icon = icons[variant];

  return (
    <div
      data-slot="alert"
      className={cn('flex gap-3 rounded-md border p-4 text-sm', variants[variant], className)}
      role={variant === 'destructive' || variant === 'warning' ? 'alert' : 'status'}
      {...props}
    >
      {icon === null ? null : (icon ?? <Icon data-icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />)}
      <div data-slot="alert-content" className="min-w-0">
        {title ? <p data-slot="alert-title" className="font-semibold leading-tight">{title}</p> : null}
        <div data-slot="alert-description" className="text-current/85">{children}</div>
      </div>
    </div>
  );
}

export function AlertTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <p data-slot="alert-title" className={cn('font-semibold', className)}>{children}</p>;
}

export function AlertDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <div data-slot="alert-description" className={cn('text-current/85', className)}>{children}</div>;
}
