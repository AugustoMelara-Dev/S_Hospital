import { Slot } from '@radix-ui/react-slot';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: 'default' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'default' | 'sm' | 'lg' | 'icon';
};

const variants = {
  default: 'border border-primary bg-primary text-primary-foreground shadow-sm hover:bg-primary/92 hover:shadow-md',
  secondary: 'border border-border bg-card text-foreground shadow-sm hover:border-input hover:bg-muted/70',
  ghost: 'bg-transparent text-foreground hover:bg-muted/70',
  danger: 'border border-destructive bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
  outline: 'border border-input bg-background/80 text-foreground hover:border-primary/35 hover:bg-muted/70',
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
        'inline-flex items-center justify-center gap-2 rounded font-semibold',
        'transition-colors duration-150 ease-out',
        'disabled:pointer-events-none disabled:opacity-60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});
