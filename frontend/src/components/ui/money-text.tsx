import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { formatLempirasFromCents } from '../../lib/moneyCents';

type MoneyTextProps = {
  amountCents?: number | null;
  children?: ReactNode;
  className?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'muted';
};

const tones = {
  default: 'text-foreground',
  success: 'text-success-foreground dark:text-success-foreground',
  warning: 'text-warning-foreground dark:text-warning-foreground',
  danger: 'text-destructive',
  muted: 'text-muted-foreground',
};

export function MoneyText({
  amountCents,
  children,
  className,
  tone = 'default',
}: MoneyTextProps) {
  return (
    <span className={cn('tabular-nums', tones[tone], className)} translate="no">
      {children ?? formatLempirasFromCents(amountCents ?? 0)}
    </span>
  );
}
