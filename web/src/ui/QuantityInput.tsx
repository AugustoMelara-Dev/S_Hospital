import { useState, type ChangeEvent, type ComponentProps, type FocusEvent, type KeyboardEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatHundredths, parseQuantityToHundredths } from '@/lib/money';
import { useFieldControl } from './Field';

export type QuantityInputProps = Omit<ComponentProps<'input'>, 'value' | 'defaultValue' | 'onChange' | 'type' | 'min' | 'max'> & {
  /** Quantity in hundredths (1.5 → 150). */
  value: number;
  onValueChange: (hundredths: number) => void;
  /** Minimum in hundredths (default 1 = 0.01). */
  min?: number;
  /** Maximum in hundredths (default 99999900). */
  max?: number;
  /** Step for −/+ and arrow keys, in hundredths (default 100 = 1 unit). */
  step?: number;
  /** Show −/+ stepper buttons (default true). */
  stepper?: boolean;
  invalid?: boolean;
  /** Accessible name used for the stepper buttons. */
  itemLabel?: string;
};

export function QuantityInput({
  value,
  onValueChange,
  min = 1,
  max = 99_999_900,
  step = 100,
  stepper = true,
  invalid,
  itemLabel,
  className,
  onBlur,
  onKeyDown,
  ...rest
}: QuantityInputProps) {
  const [text, setText] = useState(() => formatHundredths(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (parseQuantityToHundredths(text) !== value) setText(formatHundredths(value));
  }
  const field = useFieldControl({ id: rest.id, 'aria-invalid': invalid, 'aria-describedby': rest['aria-describedby'] });

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const commit = (n: number) => {
    const next = clamp(n);
    setText(formatHundredths(next));
    setLastValue(next);
    onValueChange(next);
  };

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^\d.]/g, '');
    if (raw.split('.').length > 2) return;
    const dec = raw.split('.')[1];
    if (dec !== undefined && dec.length > 2) return;
    setText(raw);
    const parsed = parseQuantityToHundredths(raw);
    if (parsed !== null && parsed >= min && parsed <= max) {
      setLastValue(parsed);
      onValueChange(parsed);
    }
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    const parsed = parseQuantityToHundredths(text);
    commit(parsed === null || parsed < min ? Math.max(min, value) : parsed);
    onBlur?.(e);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      commit(value + step);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      commit(value - step);
    }
    onKeyDown?.(e);
  }

  const btn =
    'pressable flex size-7 shrink-0 items-center justify-center rounded-[2px] text-ink-2 hover:enabled:bg-ground hover:enabled:text-ink disabled:opacity-40 [&_svg]:size-3.5';

  return (
    <div
      className={cn(
        'inline-flex h-9 items-center gap-0.5 rounded-[var(--radius-md)] border border-junta bg-field px-0.5 transition-[border-color,box-shadow] duration-[120ms] focus-within:border-slate focus-within:shadow-[0_0_0_3px_var(--focus-halo)]',
        invalid && 'border-danger',
        className,
      )}
    >
      {stepper && (
        <button
          type="button"
          tabIndex={-1}
          className={btn}
          aria-label={itemLabel ? `Disminuir cantidad de ${itemLabel}` : 'Disminuir cantidad'}
          disabled={value - step < min}
          onClick={() => commit(value - step)}
        >
          <Minus aria-hidden="true" />
        </button>
      )}
      <input
        {...rest}
        {...field}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        role="spinbutton"
        aria-valuenow={value / 100}
        aria-valuemin={min / 100}
        aria-valuemax={max / 100}
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="num h-full w-14 min-w-0 bg-transparent text-center text-[14px] font-medium outline-none"
      />
      {stepper && (
        <button
          type="button"
          tabIndex={-1}
          className={btn}
          aria-label={itemLabel ? `Aumentar cantidad de ${itemLabel}` : 'Aumentar cantidad'}
          disabled={value + step > max}
          onClick={() => commit(value + step)}
        >
          <Plus aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
