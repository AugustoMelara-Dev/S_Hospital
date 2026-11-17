import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type KbdTone = 'default' | 'oxide' | 'rail' | 'slate';

const TONES: Record<KbdTone, string> = {
  default: 'border-junta bg-surface text-ink-2',
  /** On the oxide primary button. */
  oxide: 'border-[color-mix(in_oklab,var(--oxide-ink)_35%,var(--oxide))] bg-oxide-deep text-oxide-ink',
  /** On the rail. */
  rail: 'border-rail-line bg-transparent text-rail-muted',
  /** On a slate-selected row. */
  slate: 'border-[color-mix(in_oklab,var(--slate-ink)_45%,var(--slate))] bg-transparent text-slate-ink',
};

/** Keyboard key hint: <Kbd>Ctrl K</Kbd>, <Kbd>F4</Kbd>. */
export function Kbd({ children, className, tone = 'default' }: { children: ReactNode; className?: string; tone?: KbdTone }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[3px] border px-[5px]',
        'font-sans text-[11px] leading-4 font-semibold whitespace-nowrap tabular-nums',
        TONES[tone],
        className,
      )}
    >
      {children}
    </kbd>
  );
}
