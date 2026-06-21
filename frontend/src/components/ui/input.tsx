import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      data-slot="input"
      className={cn(
        'flex min-h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm outline-none',
        'transition-[background-color,border-color,box-shadow] duration-150 ease-out placeholder:text-muted-foreground',
        'focus-visible:border-ring focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/20',
        'disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
});
