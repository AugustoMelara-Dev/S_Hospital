import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(function Label({ className, htmlFor, ...props }, ref) {
  return (
    <label
      ref={ref}
      htmlFor={htmlFor}
      data-slot="label"
      className={cn('text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
      {...props}
    />
  );
});

Label.displayName = 'Label';
