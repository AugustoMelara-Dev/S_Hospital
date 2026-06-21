import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { formatLempirasUIFromCents } from '../../lib/moneyCents';

type MoneyTextProps = {
  amountCents?: number | null;
  ariaLabel?: string;
  children?: ReactNode;
  className?: string;
  emphasis?: 'normal' | 'strong';
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
  ariaLabel,
  children,
  className,
  emphasis = 'normal',
  tone = 'default',
}: MoneyTextProps) {
  return (
    <span
      aria-label={ariaLabel}
      className={cn('tabular-nums', emphasis === 'strong' && 'font-semibold', tones[tone], className)}
      translate="no"
    >
      {children ?? formatLempirasUIFromCents(amountCents ?? 0)}
    </span>
  );
}
