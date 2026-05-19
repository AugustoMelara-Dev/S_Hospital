import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: 'default' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
};

const variants = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'border border-border bg-card text-foreground hover:bg-muted',
  ghost: 'bg-transparent text-foreground hover:bg-muted',
  danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  outline: 'border border-input bg-background hover:bg-muted',
};

const sizes = {
  default: 'min-h-10 px-4 py-2',
  sm: 'min-h-9 px-3 py-1.5 text-sm',
  lg: 'min-h-12 px-6 py-3 text-base',
  icon: 'size-9 p-0',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({
  asChild = false,
  className,
  size = 'default',
  variant = 'default',
  ...props
}, ref) {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:pointer-events-none disabled:opacity-60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
