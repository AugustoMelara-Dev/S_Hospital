import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        data-slot="textarea"
        className={cn(
          'flex min-h-24 w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-sm outline-none',
          'transition-[background-color,border-color,box-shadow] duration-150 ease-out placeholder:text-muted-foreground',
          'focus-visible:border-ring focus-visible:bg-card focus-visible:ring-2 focus-visible:ring-ring/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-destructive/20',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      />
    );
  },
);
