import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { useFieldControl } from './Field';

export type InputProps = Omit<ComponentProps<'input'>, 'prefix'> & {
  /** Leading adornment (icon or text such as "L"). */
  prefix?: ReactNode;
  /** Trailing adornment (button, unit, Kbd). */
  suffix?: ReactNode;
  invalid?: boolean;
  /** Mono + tabular figures (codes, amounts). */
  mono?: boolean;
  wrapperClassName?: string;
};

export function Input({ prefix, suffix, invalid, mono, className, wrapperClassName, ...rest }: InputProps) {
  const field = useFieldControl({
    id: rest.id,
    'aria-describedby': rest['aria-describedby'],
    'aria-invalid': invalid ?? rest['aria-invalid'],
    required: rest.required,
  });
  const input = (
    <input
      {...rest}
      {...field}
      className={cn('control', mono && 'num', prefix ? 'pl-8' : undefined, suffix ? 'pr-10' : undefined, className)}
    />
  );
  if (!prefix && !suffix) return input;
  return (
    <div className={cn('relative flex items-center', wrapperClassName)}>
      {prefix && (
        <span className="pointer-events-none absolute left-2.5 flex items-center text-ink-3 [&_svg]:size-4">{prefix}</span>
      )}
      {input}
      {suffix && <span className="absolute right-1.5 flex items-center text-ink-3">{suffix}</span>}
    </div>
  );
}
