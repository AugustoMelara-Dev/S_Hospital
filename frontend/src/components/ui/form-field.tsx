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
  orientation?: 'vertical' | 'horizontal';
  required?: boolean;
};

export function FormField({
  children,
  className,
  error,
  hint,
  id,
  label,
  orientation = 'vertical',
  required = false,
}: FormFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const invalid = Boolean(error);
  const describedBy = [hint ? hintId : undefined, error ? errorId : undefined].filter(Boolean).join(' ') || undefined;

  return (
    <div
      data-slot="form-field"
      data-orientation={orientation}
      className={cn(
        'grid min-w-0 gap-2',
        orientation === 'horizontal' && 'items-start sm:grid-cols-[minmax(10rem,14rem)_1fr]',
        className,
      )}
    >
      <div data-slot="form-field-label-row" className="flex items-center gap-1">
        <Label htmlFor={fieldId} className="text-sm font-semibold text-foreground">
          {label}
        </Label>
        {required ? (
          <>
            <span className="ml-1 text-destructive" aria-hidden="true">*</span>
            <span className="sr-only">Obligatorio</span>
          </>
        ) : null}
      </div>
      <div data-slot="form-field-control" className="flex min-w-0 flex-col gap-2">
        {children({ describedBy, errorId, hintId, id: fieldId, invalid })}
        {hint ? (
          <p id={hintId} data-slot="form-field-hint" className="text-xs leading-relaxed text-muted-foreground">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={errorId} data-slot="form-field-error" className="text-sm font-semibold text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
