import { useId, type ComponentProps, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/cn';

export type CheckboxProps = Omit<ComponentProps<'input'>, 'type'> & {
  label: ReactNode;
  description?: ReactNode;
};

export function Checkbox({ label, description, className, id, disabled, ...rest }: CheckboxProps) {
  const auto = useId();
  const inputId = id ?? `cb${auto}`;
  const descId = description ? `${inputId}-desc` : undefined;
  return (
    <div className={cn('flex items-start gap-2.5', disabled && 'opacity-60', className)}>
      <span className="relative mt-[1px] inline-flex size-[18px] shrink-0">
        <input
          {...rest}
          id={inputId}
          type="checkbox"
          disabled={disabled}
          aria-describedby={descId}
          className={cn(
            'peer size-[18px] appearance-none rounded-[5px] border border-line-strong bg-surface',
            'transition-[background-color,border-color] duration-[120ms] ease-out',
            'checked:border-brand checked:bg-brand enabled:hover:border-brand disabled:cursor-not-allowed',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]',
          )}
        />
        <Check
          aria-hidden="true"
          strokeWidth={3}
          className="pointer-events-none absolute inset-0 m-auto size-3 scale-50 text-brand-ink opacity-0 transition-[opacity,scale] duration-[120ms] ease-out peer-checked:scale-100 peer-checked:opacity-100"
        />
      </span>
      <span className="flex flex-col gap-0.5">
        <label htmlFor={inputId} className="text-sm leading-[1.35] text-ink select-none">
          {label}
        </label>
        {description && (
          <span id={descId} className="text-[12.5px] text-ink-3">
            {description}
          </span>
        )}
      </span>
    </div>
  );
}
