import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Keyboard key hint: <Kbd>Ctrl</Kbd> <Kbd>K</Kbd>. */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-line bg-surface px-1',
        'font-mono text-[11px] leading-none font-medium text-ink-2 shadow-[0_1px_0_var(--line)]',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
