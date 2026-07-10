import { Slot, Slottable } from '@radix-ui/react-slot';
import {
  cloneElement,
  forwardRef,
  isValidElement,
  type ButtonHTMLAttributes,
  type MouseEvent,
  type MouseEventHandler,
} from 'react';
import { cn } from '../../lib/utils';

export type ClinicalButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
};

const variants = {
  primary: 'border-clinical bg-clinical text-white hover:bg-clinical/90',
  secondary: 'border-line bg-surface text-ink hover:border-clinical/45 hover:bg-muted',
  quiet: 'border-transparent bg-transparent text-ink hover:bg-muted',
  danger: 'border-danger bg-danger text-white hover:bg-danger/90',
};

const sizes = {
  sm: 'min-h-11 px-3 py-2 text-sm sm:min-h-9',
  md: 'min-h-11 px-4 py-2 text-sm',
  lg: 'min-h-12 px-5 py-3 text-base',
  icon: 'size-11 p-0',
};

export const Button = forwardRef<HTMLButtonElement, ClinicalButtonProps>(function Button(
  {
    asChild = false,
    busy = false,
    children,
    className,
    disabled = false,
    onClick,
    size = 'md',
    variant = 'primary',
    ...props
  },
  ref,
) {
  const Comp = asChild ? Slot : 'button';
  const blocked = disabled || busy;
  const composedChildren =
    asChild && blocked && isValidElement<{ onClick?: MouseEventHandler<HTMLElement> }>(children)
      ? cloneElement(children, {
          onClick: (event: MouseEvent<HTMLElement>) => {
            event.preventDefault();
            event.stopPropagation();
          },
        })
      : children;

  function handleClick(event: MouseEvent<HTMLButtonElement>): void {
    if (blocked) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onClick?.(event);
  }

  return (
    <Comp
      {...props}
      ref={ref}
      aria-busy={busy || undefined}
      aria-disabled={asChild && blocked ? true : undefined}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md border font-semibold',
        'transition-colors duration-150 ease-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55',
        'aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-55',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={asChild ? undefined : blocked}
      onClick={handleClick}
    >
      {busy ? (
        <span
          aria-hidden="true"
          className="motion-safe:animate-spin size-4 shrink-0 rounded-full border-2 border-current border-r-transparent"
        />
      ) : null}
      {asChild ? <Slottable>{composedChildren}</Slottable> : composedChildren}
    </Comp>
  );
});

Button.displayName = 'Button';
