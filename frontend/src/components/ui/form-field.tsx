import { type ReactNode, useId } from 'react';
import { cn } from '../../lib/utils';
import { Label } from './label';

type FormFieldProps = {
  children: (field: {
    describedBy: string | undefined;
    errorId: string;
    hintId: string;
    id: string;
    invalid: boolean;
  }) => ReactNode;
  className?: string;
  error?: ReactNode;
  hint?: ReactNode;
  id?: string;
  label: ReactNode;
  required?: boolean;
};

export function FormField({
  children,
  className,
  error,
  hint,
  id,
  label,
  required = false,
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const invalid = Boolean(error);
  const describedBy = [hint ? hintId : undefined, error ? errorId : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex min-w-0 flex-col gap-2', className)}>
      <div className="flex items-center gap-1">
        <Label htmlFor={fieldId} className="text-sm font-semibold text-foreground">
          {label}
        </Label>
        {required ? <span className="ml-1 text-destructive" aria-hidden="true">*</span> : null}
      </div>
      {children({ describedBy, errorId, hintId, id: fieldId, invalid })}
      {hint ? (
        <p id={hintId} className="text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-semibold text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
