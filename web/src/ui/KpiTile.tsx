import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Money } from './Money';
import { Skeleton } from './Skeleton';
import { StatusGlyph, type Tone } from './Badge';

export type KpiTileProps = {
  label: string;
  /** Money in cents (rendered with <Money/>). Use `value` for other content. */
  cents?: number | null;
  value?: ReactNode;
  /** Supporting line under the figure (count, explanation). */
  hint?: ReactNode;
  /** Optional delta line (e.g. "+L 120.00 vs. ayer"), rendered above the hint. */
  delta?: ReactNode;
  icon?: ReactNode;
  /** Marks the cell with a small square in the state colour; neutral shows none. */
  tone?: Tone;
  loading?: boolean;
  className?: string;
};

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink-3',
  brand: 'text-slate',
  info: 'text-slate',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
};

/**
 * A ledger cell: label, tabular figure, optional delta and hint. Not a floating
 * card: put several inside <KpiGrid> so they share one junta grid.
 */
export function KpiTile({ label, cents, value, hint, delta, icon, tone = 'neutral', loading, className }: KpiTileProps) {
  return (
    <div
      role="group"
      aria-label={typeof label === 'string' ? label : undefined}
      className={cn('flex min-w-0 flex-col gap-1.5 rounded-[var(--radius-md)] border border-junta bg-surface px-4 pt-3 pb-3.5', className)}
    >
      <div className="flex items-center gap-2">
        {tone !== 'neutral' && <StatusGlyph shape="dot" className={cn('size-2', TONE_TEXT[tone])} />}
        <span className="min-w-0 flex-1 truncate text-[12px] leading-4 font-semibold text-ink-2">{label}</span>
        {icon && <span className="text-ink-3 [&_svg]:size-4 [&_svg]:stroke-[1.6]">{icon}</span>}
      </div>
      <div className="num text-[24px] leading-7 font-semibold tracking-[-0.01em] text-ink">
        {loading ? (
          <Skeleton className="my-1 h-5 w-32" />
        ) : cents !== undefined ? (
          <Money cents={cents} />
        ) : (
          <span className="num">{value}</span>
        )}
      </div>
      {delta && <div className="num text-[12.5px] leading-4 font-medium text-ink-2">{delta}</div>}
      {hint && <div className="text-[12px] leading-4 text-ink-3">{hint}</div>}
    </div>
  );
}

export type KpiGridProps = {
  children: ReactNode;
  /** Columns at wide widths (default: as many as children fit at ≥200px). */
  columns?: number;
  className?: string;
  'aria-label'?: string;
};

/** One junta grid for ledger cells: 1px rules between cells, one outer border, 4px radius. */
export function KpiGrid({ children, columns, className, ...rest }: KpiGridProps) {
  return (
    <div
      {...rest}
      role={rest['aria-label'] ? 'group' : undefined}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
      className={cn(
        'grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-px overflow-hidden rounded-[var(--radius-md)] border border-junta bg-surface',
        '[&>*]:rounded-none [&>*]:border-0 [&>*]:outline [&>*]:outline-1 [&>*]:outline-junta',
        className,
      )}
    >
      {children}
    </div>
  );
}
