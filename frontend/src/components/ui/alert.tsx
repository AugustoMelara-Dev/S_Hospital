import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
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
  title,
  variant = 'default',
  ...props
}: AlertProps) {
  const Icon = icons[variant];

  return (
    <div
      className={cn('flex gap-3 rounded-lg border p-4 text-sm', variants[variant], className)}
      role={variant === 'destructive' || variant === 'warning' ? 'alert' : 'status'}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        {title ? <p className="font-semibold leading-tight">{title}</p> : null}
        <div className="text-current/85">{children}</div>
      </div>
    </div>
  );
}

export function AlertTitle({ children }: { children: ReactNode }) {
  return <p className="font-semibold">{children}</p>;
}

export function AlertDescription({ children }: { children: ReactNode }) {
  return <div className="text-current/85">{children}</div>;
}
