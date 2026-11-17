import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Money } from './Money';
import { Skeleton } from './Skeleton';
import type { Tone } from './Badge';

export type KpiTileProps = {
  label: string;
  /** Money in cents (rendered with <Money/>). Use `value` for other content. */
  cents?: number | null;
  value?: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  loading?: boolean;
  className?: string;
};

const ACCENT: Record<Tone, string> = {
  neutral: 'before:bg-line-strong',
  brand: 'before:bg-brand',
  ok: 'before:bg-ok',
  warn: 'before:bg-warn',
  danger: 'before:bg-danger',
  info: 'before:bg-info',
};

export function KpiTile({ label, cents, value, hint, icon, tone = 'neutral', loading, className }: KpiTileProps) {
  return (
    <div
      role="group"
      aria-label={typeof label === 'string' ? label : undefined}
      className={cn(
        'relative flex flex-col gap-2 overflow-hidden rounded-[var(--radius-md)] border border-line bg-surface px-4 py-3.5 shadow-1',
        'before:absolute before:inset-y-3 before:left-0 before:w-[3px] before:rounded-r-full',
        ACCENT[tone],
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-ink-2">{label}</span>
        {icon && <span className="text-ink-3 [&_svg]:size-4">{icon}</span>}
      </div>
      <div className="text-[22px] leading-none font-semibold tracking-tight text-ink">
        {loading ? (
          <Skeleton className="h-[22px] w-32" />
        ) : cents !== undefined ? (
          <Money cents={cents} />
        ) : (
          <span className="num">{value}</span>
        )}
      </div>
      {hint && <div className="text-[12px] text-ink-3">{hint}</div>}
    </div>
  );
}
