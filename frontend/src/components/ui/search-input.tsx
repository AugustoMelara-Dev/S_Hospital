import { Search, X } from 'lucide-react';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Input } from './input';

type SearchInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type' | 'value'> & {
  clearLabel?: string;
  inputClassName?: string;
  label: ReactNode;
  onValueChange: (value: string) => void;
  value: string;
};

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput({
  className,
  clearLabel = 'Limpiar busqueda',
  disabled,
  id,
  inputClassName,
  label,
  onValueChange,
  value,
  ...props
}, ref) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const canClear = value.length > 0 && !disabled;

  return (
    <div data-slot="search-input" className={cn('flex min-w-0 flex-col gap-2', className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          ref={ref}
          id={inputId}
          type="search"
          autoComplete={props.autoComplete ?? 'off'}
          disabled={disabled}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className={cn('pl-9', canClear ? 'pr-10' : undefined, inputClassName)}
          {...props}
        />
        {canClear ? (
          <button
            type="button"
            aria-label={clearLabel}
            onClick={() => onValueChange('')}
            className={cn(
              'absolute right-1.5 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded',
              'text-muted-foreground transition hover:bg-muted hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
});

SearchInput.displayName = 'SearchInput';
