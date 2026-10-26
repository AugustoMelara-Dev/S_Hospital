import type { ComponentProps, ReactNode } from 'react';
import { AdminField } from '@/design-system/admin/components';
import { cn } from '@/lib/utils';
import { INPUT_CLASS, SELECT_CLASS } from '../receiptAdminUi';

export function NumberInput({ value, onChange, className, ...props }: Omit<ComponentProps<'input'>, 'onChange' | 'value' | 'type'> & {
  value?: number;
  onChange: (value: number | null) => void;
}) {
  return (
    <input
      type="number"
      value={value ?? ''}
      className={cn(INPUT_CLASS, className)}
      onChange={(event) => onChange(Number.isNaN(event.target.valueAsNumber) ? null : event.target.valueAsNumber)}
      {...props}
    />
  );
}

export function SelectControl({ id, value, onChange, options, disabled, ariaLabel }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      className={SELECT_CLASS}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

export function Field({
  children,
  error,
  hint,
  id,
  label,
}: {
  children: ReactNode;
  error?: string;
  hint?: ReactNode;
  id: string;
  label: string;
}) {
  return (
    <AdminField htmlFor={id} label={label} error={error} hint={hint}>
      {children}
    </AdminField>
  );
}

