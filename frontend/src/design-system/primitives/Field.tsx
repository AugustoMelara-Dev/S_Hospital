import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { cn } from '../../lib/utils';

export type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'name'> & {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
};

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  {
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    className,
    error,
    hint,
    id,
    label,
    name,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? `${generatedId}-control`;
  const hintId = hint ? `${generatedId}-hint` : undefined;
  const errorId = error ? `${generatedId}-error` : undefined;
  const describedBy = [ariaDescribedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="grid gap-1.5">
      <label className="text-sm font-semibold text-ink" htmlFor={inputId}>
        {label}
      </label>
      <input
        ref={ref}
        aria-describedby={describedBy}
        aria-invalid={error ? true : ariaInvalid}
        className={cn(
          'min-h-11 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-ink outline-none',
          'placeholder:text-muted-foreground',
          'transition-[border-color,box-shadow] duration-150 ease-out',
          'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          'aria-[invalid=true]:border-danger aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-danger/20',
          'disabled:cursor-not-allowed disabled:opacity-55',
          className,
        )}
        id={inputId}
        name={name}
        {...props}
      />
      {hint ? (
        <p className="text-xs text-muted-foreground" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="text-xs font-medium text-danger" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
});

Field.displayName = 'Field';
