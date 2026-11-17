import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type SwitchProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
};

export function Switch({ checked, onCheckedChange, label, description, disabled, id, className }: SwitchProps) {
  const auto = useId();
  const switchId = id ?? `sw${auto}`;
  const labelId = `${switchId}-label`;
  const descId = description ? `${switchId}-desc` : undefined;
  return (
    <div className={cn('flex items-start justify-between gap-4', disabled && 'opacity-60', className)}>
      <span className="flex flex-col gap-0.5">
        <span id={labelId} className="text-sm text-ink">
          {label}
        </span>
        {description && (
          <span id={descId} className="text-[12.5px] text-ink-3">
            {description}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        id={switchId}
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={descId}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent',
          'transition-colors duration-[150ms] ease-out disabled:cursor-not-allowed',
          checked ? 'bg-brand' : 'bg-line-strong',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.2)]',
            'transition-transform duration-[150ms] ease-[var(--ease-out)]',
            checked ? 'translate-x-[17px]' : 'translate-x-[1px]',
          )}
        />
      </button>
    </div>
  );
}
