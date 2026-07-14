import type { ReactNode } from 'react';
import { formatLempirasUIFromCents } from '../../lib/moneyCents';
import { cn } from '../../lib/utils';

type LempiraAmountProps = {
  cents?: number | null;
  children?: ReactNode;
  className?: string;
  label?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'muted';
  weight?: 'normal' | 'strong';
};

const toneClassNames: Record<NonNullable<LempiraAmountProps['tone']>, string> = {
  default: 'text-foreground',
  success: 'text-success-foreground',
  warning: 'text-warning-foreground',
  danger: 'text-destructive',
  muted: 'text-muted-foreground',
};

export function LempiraAmount({
  cents,
  children,
  className,
  label,
  tone = 'default',
  weight = 'normal',
}: LempiraAmountProps) {
  return (
    <span
      aria-label={label}
      className={cn(
        'tabular-nums',
        weight === 'strong' && 'font-semibold',
        toneClassNames[tone],
        className,
      )}
      translate="no"
    >
      {children ?? formatLempirasUIFromCents(cents ?? 0)}
    </span>
  );
}
