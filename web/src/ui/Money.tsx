import { cn } from '@/lib/cn';
import { formatCents } from '@/lib/money';

export type MoneyProps = {
  /** Integer cents. `null`/`undefined` renders "No disponible" (never L 0.00). */
  cents: number | null | undefined;
  className?: string;
  /** Color negatives with --danger. */
  toneNegative?: boolean;
  /** Prefix positive values with "+" (differences, movements). */
  signed?: boolean;
};

/** Renders "L 1,234.00" in mono tabular figures. */
export function Money({ cents, className, toneNegative = false, signed = false }: MoneyProps) {
  if (cents === null || cents === undefined) {
    return <span className={cn('text-ink-3 italic', className)}>No disponible</span>;
  }
  const text = formatCents(cents);
  return (
    <span className={cn('num whitespace-nowrap', toneNegative && cents < 0 && 'text-danger', className)}>
      {signed && cents > 0 ? `+${text}` : text}
    </span>
  );
}
