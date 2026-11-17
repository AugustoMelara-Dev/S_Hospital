import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Kbd, type KbdTone } from './Kbd';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
/** sm 32 · md 36 · lg 40 · xl 56 (the pay button). */
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const base =
  'pressable relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] font-semibold ' +
  'disabled:opacity-50 aria-disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]';

/** Oxide is reserved for the one primary action of a view. */
export const buttonVariants: Record<ButtonVariant, string> = {
  // Disabled primary is not a faded oxide: it drops to a plain surface tile with the junta.
  primary:
    'bg-oxide text-oxide-ink hover:enabled:bg-oxide-hover ' +
    '[&:disabled:not([aria-busy])]:border [&:disabled:not([aria-busy])]:border-junta [&:disabled:not([aria-busy])]:bg-surface ' +
    '[&:disabled:not([aria-busy])]:text-ink-3 [&:disabled:not([aria-busy])]:opacity-100 ' +
    'aria-disabled:border aria-disabled:border-junta aria-disabled:bg-surface aria-disabled:text-ink-3 aria-disabled:opacity-100',
  secondary: 'border border-junta bg-surface text-ink hover:enabled:border-junta-strong hover:enabled:bg-surface-2',
  ghost: 'text-ink-2 hover:enabled:bg-surface-2 hover:enabled:text-ink',
  danger: 'border border-danger bg-danger text-white hover:enabled:bg-danger-hover dark:text-[#1e1416]',
};

const KBD_TONE: Record<ButtonVariant, KbdTone> = { primary: 'oxide', secondary: 'default', ghost: 'default', danger: 'oxide' };

export const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] [&_svg]:size-3.5',
  md: 'h-9 px-3.5 text-sm [&_svg]:size-4',
  lg: 'h-10 px-4 text-sm [&_svg]:size-4',
  xl: 'h-14 px-5 text-[18px] font-bold [&_svg]:size-5',
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
  /** Keyboard hint rendered at the trailing edge (e.g. "F4"). Hidden from AT; add aria-keyshortcuts. */
  kbd?: ReactNode;
  fullWidth?: boolean;
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  loadingText = 'Procesando…',
  leftIcon,
  rightIcon,
  kbd,
  fullWidth,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const spread = size === 'xl' && kbd !== undefined;
  return (
    <button
      type={type}
      className={cn(base, buttonVariants[variant], buttonSizes[size], fullWidth && 'w-full', spread && 'justify-between', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <span className={cn('inline-flex min-w-0 items-center gap-2', loading && 'invisible')}>
        {leftIcon}
        {children}
        {rightIcon}
      </span>
      {kbd !== undefined && (
        <span aria-hidden="true" className={cn('inline-flex', loading && 'invisible')}>
          <Kbd tone={variant === 'primary' && disabled && !loading ? 'default' : KBD_TONE[variant]} className={size === 'xl' ? 'h-5 px-1.5 text-[12px]' : undefined}>
            {kbd}
          </Kbd>
        </span>
      )}
      {loading && (
        <span className="absolute inset-0 inline-flex items-center justify-center">
          <Spinner />
          <span className="sr-only">{loadingText}</span>
        </span>
      )}
    </button>
  );
}
