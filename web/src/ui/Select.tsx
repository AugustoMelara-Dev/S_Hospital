import type { ComponentProps } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useFieldControl } from './Field';

export type SelectOption = { value: string; label: string; disabled?: boolean };

export type SelectProps = ComponentProps<'select'> & {
  options?: SelectOption[];
  /** Adds an initial empty option with this label (e.g. "Todas"). */
  placeholder?: string;
  invalid?: boolean;
  wrapperClassName?: string;
};

/** Native select (fast, accessible, keyboard-friendly) with token styling. */
export function Select({ options, placeholder, invalid, className, wrapperClassName, children, ...rest }: SelectProps) {
  const field = useFieldControl({
    id: rest.id,
    'aria-describedby': rest['aria-describedby'],
    'aria-invalid': invalid ?? rest['aria-invalid'],
    required: rest.required,
  });
  return (
    <div className={cn('relative', wrapperClassName)}>
      <select {...rest} {...field} className={cn('control appearance-none pr-8 [&>option]:bg-field', className)}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        strokeWidth={1.6}
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-ink-2"
      />
    </div>
  );
}
