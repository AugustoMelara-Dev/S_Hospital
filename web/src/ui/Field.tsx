import { createContext, useContext, useId, type ComponentProps, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/lib/cn';

type FieldCtx = { id: string; describedBy: string | undefined; invalid: boolean; required: boolean };
const FieldContext = createContext<FieldCtx | null>(null);

/**
 * Wires a control (Input, MoneyInput, Select, Textarea…) to its label, hint
 * and error: `id`, `aria-describedby`, `aria-invalid` are set automatically.
 */
export function useFieldControl(props: {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: ComponentProps<'input'>['aria-invalid'];
  required?: boolean;
}) {
  const ctx = useContext(FieldContext);
  const describedBy = [ctx?.describedBy, props['aria-describedby']].filter(Boolean).join(' ') || undefined;
  return {
    id: props.id ?? ctx?.id,
    'aria-describedby': describedBy,
    'aria-invalid': props['aria-invalid'] ?? (ctx?.invalid ? true : undefined),
    required: props.required ?? ctx?.required,
  };
}

export type FieldProps = {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  error?: string | null | undefined;
  required?: boolean;
  /** Optional control id; generated otherwise. */
  id?: string;
  className?: string;
  /** Extra element aligned to the right of the label (e.g. a link). */
  labelAside?: ReactNode;
  /** Visually hide the label but keep it for assistive tech. */
  hideLabel?: boolean;
};

export function Field({ label, children, hint, error, required = false, id, className, labelAside, hideLabel }: FieldProps) {
  const auto = useId();
  const controlId = id ?? `f${auto}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <FieldContext.Provider value={{ id: controlId, describedBy, invalid: Boolean(error), required }}>
      <div className={cn('flex flex-col gap-1.5', className)}>
        <div className={cn('flex items-center justify-between gap-3', hideLabel && 'sr-only')}>
          <label htmlFor={controlId} className="text-[12px] leading-4 font-semibold text-ink-2">
            {label}
            {required && (
              <span className="ml-0.5 text-danger" aria-hidden="true">
                *
              </span>
            )}
          </label>
          {labelAside}
        </div>
        {children}
        {error ? (
          <p id={errorId} className="flex items-start gap-1.5 text-[12.5px] leading-4 font-medium text-danger" role="alert">
            <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        ) : null}
        {hint ? (
          <p id={hintId} className="text-[12.5px] leading-4 text-ink-3">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}
