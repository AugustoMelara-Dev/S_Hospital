import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { StatusGlyph, type GlyphShape, type Tone } from '@/ui';

/**
 * Admin-page building blocks for the "Ladrillo hidráulico" world, shared by the
 * admin features (catálogo, usuarios, ajustes, respaldos, auditoría). Kept in
 * feature scope on purpose: they compose `@/ui`, they do not extend it.
 */

/** One surface panel ruled by the junta. Tables and ledgers sit flush inside. */
export function Sheet({ children, className, ...rest }: { children: ReactNode; className?: string; 'aria-label'?: string }) {
  return (
    <section {...rest} className={cn('flex min-w-0 flex-col overflow-hidden rounded-[var(--radius-md)] border border-junta bg-surface', className)}>
      {children}
    </section>
  );
}

/** Panel header row: h2 + optional meta + actions, closed by one 1px junta. */
export function SheetHead({ title, meta, actions, className }: { title: ReactNode; meta?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <header className={cn('flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2 border-b border-junta px-4 py-2', className)}>
      <h2 className="text-[15px] leading-5 font-bold text-ink">{title}</h2>
      {meta && <span className="text-[12.5px] leading-4 text-ink-2">{meta}</span>}
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** One-row filter toolbar above a table. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2 border-b border-junta px-3 py-2', className)}>{children}</div>;
}

/** "N conceptos" style counter for toolbars. */
export function Count({ n, one, many }: { n: number | undefined; one: string; many: string }) {
  if (n === undefined) return null;
  return (
    <span className="text-[12.5px] whitespace-nowrap text-ink-2">
      <span className="num font-semibold text-ink">{n}</span> {n === 1 ? one : many}
    </span>
  );
}

/** Section header inside a single panel or drawer: h3 + 1px rule, no card. */
export function LedgerSection({ title, aside, children, className }: { title: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col [&:first-child>:first-child]:pt-0', className)}>
      <div className="flex items-baseline justify-between gap-3 border-b border-junta-strong pt-5 pb-1.5">
        <h3 className="text-[13px] leading-4 font-bold text-ink">{title}</h3>
        {aside && <span className="text-[12px] leading-4 text-ink-3">{aside}</span>}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

/**
 * Turns a `<Field>` into a ledger row: label on the left, control on the right,
 * error and hint under the control, junta below. Pass as Field's className.
 */
export const ledgerRow = (labelWidth: 'sm' | 'md' = 'md') =>
  cn(
    'grid items-center gap-x-4 gap-y-1 border-b border-junta py-2.5 last:border-b-0',
    labelWidth === 'sm' ? 'grid-cols-[132px_minmax(0,1fr)]' : 'grid-cols-[180px_minmax(0,1fr)]',
    '[&>*:not(:first-child)]:col-start-2',
  );

/** A static ledger row (label + value) for read-only facts. */
export function LedgerFact({ label, children, labelWidth = 'md', className }: { label: ReactNode; children: ReactNode; labelWidth?: 'sm' | 'md'; className?: string }) {
  return (
    <div className={cn(ledgerRow(labelWidth), 'min-h-10 py-2', className)}>
      <span className="text-[12px] leading-4 font-semibold text-ink-2">{label}</span>
      <div className="min-w-0 text-[13.5px] leading-5 text-ink">{children}</div>
    </div>
  );
}

const TONE_TEXT: Record<Tone, string> = {
  neutral: 'text-ink-3',
  brand: 'text-slate',
  info: 'text-slate',
  ok: 'text-ok',
  warn: 'text-warn',
  danger: 'text-danger',
};

/** A state told by shape + label (colour only supports). */
export function StateMark({ shape, tone = 'neutral', children, className }: { shape: GlyphShape; tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[13px] leading-5 font-medium whitespace-nowrap text-ink', className)}>
      <StatusGlyph shape={shape} className={TONE_TEXT[tone]} />
      {children}
    </span>
  );
}

/** Missing value. */
export function Dash() {
  return <span className="text-ink-3">—</span>;
}
