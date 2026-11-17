import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Join class names and resolve Tailwind conflicts so later classes win
 * (e.g. a caller's `text-brand-ink` overrides a component's `text-ink-2`).
 * Custom shadow scale (shadow-1/2/3) is registered so it merges with shadow-none etc.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: { shadow: ['1', '2', '3'] },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
