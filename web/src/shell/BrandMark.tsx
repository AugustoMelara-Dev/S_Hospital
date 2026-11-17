import { cn } from '@/lib/cn';

/** S_Hospital mark: pine-green tile with a rounded clinical cross. */
export function BrandMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('shrink-0', className)} role="img" aria-label="S_Hospital">
      <rect width="32" height="32" rx="8" fill={inverted ? 'rgb(255 255 255 / 0.12)' : 'var(--brand)'} />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="rgb(255 255 255 / 0.14)" />
      <path
        d="M13.5 8.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v5h5a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-5v5a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-5h-5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h5z"
        fill={inverted ? '#ffffff' : 'var(--brand-ink)'}
      />
    </svg>
  );
}
