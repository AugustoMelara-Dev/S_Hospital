import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { buttonVariants, type ButtonVariant } from './Button';

export type IconButtonProps = Omit<ComponentProps<'button'>, 'children'> & {
  /** Required accessible name (also used as tooltip). */
  label: string;
  icon: ReactNode;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
};

export function IconButton({ label, icon, variant = 'ghost', size = 'md', className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'pressable inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md)] font-semibold disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]',
        buttonVariants[variant],
        size === 'sm' ? 'size-8 [&_svg]:size-4' : 'size-9 [&_svg]:size-[18px]',
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
}
