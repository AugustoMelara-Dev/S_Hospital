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
        <span id={labelId} className="text-sm font-medium text-ink">
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
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-[3px] border',
          'transition-colors duration-[150ms] ease-out disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]',
          checked ? 'border-slate bg-slate' : 'border-junta-strong bg-ground',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block size-3.5 rounded-[2px]',
            'transition-transform duration-[150ms] ease-[var(--ease-out)]',
            checked ? 'translate-x-[18px] bg-slate-ink' : 'translate-x-[2px] bg-ink-3',
          )}
        />
      </button>
    </div>
  );
}
