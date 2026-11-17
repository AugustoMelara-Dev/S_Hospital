import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { useFieldControl } from './Field';

export type TextareaProps = ComponentProps<'textarea'> & { invalid?: boolean };

export function Textarea({ invalid, className, rows = 3, ...rest }: TextareaProps) {
  const field = useFieldControl({
    id: rest.id,
    'aria-describedby': rest['aria-describedby'],
    'aria-invalid': invalid ?? rest['aria-invalid'],
    required: rest.required,
  });
  return <textarea rows={rows} {...rest} {...field} className={cn('control resize-y py-2 leading-snug', className)} />;
}
