import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';

/**
 * Animated checkmark circle for success states (e.g., invoice created, payment registered).
 */
export function SuccessCheckmark({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'size-8', md: 'size-12', lg: 'size-16' };
  const strokeSizes = { sm: 2, md: 2.5, lg: 3 };

  return (
    <div className={cn('inline-flex items-center justify-center', className)}>
      <svg
        className={cn(sizes[size], 'text-success')}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth={strokeSizes[size]}
          opacity={0.2}
        />
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth={strokeSizes[size]}
          strokeDasharray="63"
          strokeDashoffset="63"
          style={{ animation: 'check-draw 0.6s ease-out forwards' }}
        />
        <path
          d="M8 12.5l2.5 2.5 5-5"
          stroke="currentColor"
          strokeWidth={strokeSizes[size]}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="24"
          strokeDashoffset="24"
          style={{ animation: 'check-draw 0.4s ease-out 0.4s forwards' }}
        />
      </svg>
    </div>
  );
}

/**
 * Wrapper that applies fade-in + slide-up animation to children.
 */
export function AnimateIn({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={cn('animate-[slide-up_0.3s_ease-out_both]', className)}
      style={delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Version badge shown in footer.
 */
export function VersionBadge({ version }: { version: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      v{version}
    </span>
  );
}
