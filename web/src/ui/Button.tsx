import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'pressable relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)] font-medium ' +
  'disabled:opacity-55 aria-disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]';

export const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-brand-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.12),0_1px_1px_rgb(0_0_0/0.08)] hover:enabled:bg-brand-hover',
  secondary: 'border border-line bg-surface text-ink shadow-1 hover:enabled:border-line-strong hover:enabled:bg-surface-2',
  ghost: 'text-ink-2 hover:enabled:bg-surface-2 hover:enabled:text-ink',
  danger: 'bg-danger text-white hover:enabled:bg-danger-hover dark:text-[#1a0d0b]',
};

export const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] [&_svg]:size-3.5',
  md: 'h-9 px-3.5 text-sm [&_svg]:size-4',
  lg: 'h-11 px-5 text-[15px] [&_svg]:size-[18px]',
};

export type ButtonProps = ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, keeps the width and blocks clicks. */
  loading?: boolean;
  /** Accessible text announced while loading (default "Procesando…"). */
  loadingText?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  loadingText = 'Procesando…',
  leftIcon,
  rightIcon,
  fullWidth,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(base, buttonVariants[variant], buttonSizes[size], fullWidth && 'w-full', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
        {leftIcon}
        {children}
        {rightIcon}
      </span>
      {loading && (
        <span className="absolute inset-0 inline-flex items-center justify-center">
          <Spinner />
          <span className="sr-only">{loadingText}</span>
        </span>
      )}
    </button>
  );
}
