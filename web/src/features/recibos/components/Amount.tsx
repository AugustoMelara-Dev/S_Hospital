import { cn } from '@/lib/cn';
import { formatCents } from '@/lib/money';

/**
 * Money for document views: "L 1,234.00" in tabular figures. A missing value is a quiet
 * "—" in ink-3 (announced as "No disponible"), never italic text and never L 0.00.
 */
export function Amount({ cents, className, negative = false }: { cents: number | null | undefined; className?: string; negative?: boolean }) {
  if (cents === null || cents === undefined) {
    return (
      <span className={cn('num whitespace-nowrap text-ink-3', className)}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">No disponible</span>
      </span>
    );
  }
  const text = formatCents(Math.abs(cents));
  const sign = negative || cents < 0 ? '−' : '';
  return <span className={cn('num whitespace-nowrap', className)}>{`${sign}${text}`}</span>;
}

/** Quiet em dash for an empty cell. */
export function Dash({ label = 'Sin dato' }: { label?: string }) {
  return (
    <span className="text-ink-3">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
