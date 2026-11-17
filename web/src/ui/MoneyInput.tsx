import { useState, type ChangeEvent, type ComponentProps, type FocusEvent } from 'react';
import { centsToInput, parseMoneyToCents } from '@/lib/money';
import { Input } from './Input';

export type MoneyInputProps = Omit<ComponentProps<'input'>, 'value' | 'defaultValue' | 'onChange' | 'type' | 'prefix'> & {
  /** Integer cents, or null when empty. */
  value: number | null;
  /** Emits integer cents (never floats), or null when the text is empty/invalid. */
  onValueChange: (cents: number | null) => void;
  invalid?: boolean;
  /** Max amount in cents (input refuses keystrokes beyond it). */
  maxCents?: number;
};

const ALLOWED = /[^\d.,]/g;

/**
 * Amount input in lempiras. The user types "1,234.50" and the component
 * emits 123450. Formats with thousands separators on blur.
 */
export function MoneyInput({ value, onValueChange, invalid, maxCents, onBlur, placeholder = '0.00', ...rest }: MoneyInputProps) {
  const [text, setText] = useState(() => centsToInput(value));
  const [lastValue, setLastValue] = useState(value);

  // Adopt external value changes (e.g. "Monto exacto") without clobbering typing.
  if (value !== lastValue) {
    setLastValue(value);
    if (parseMoneyToCents(text) !== value) setText(centsToInput(value));
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/^\s*L\s*/i, '').replace(ALLOWED, '');
    if (raw.split('.').length > 2) return;
    const decimals = raw.split('.')[1];
    if (decimals !== undefined && decimals.length > 2) return;
    const cents = parseMoneyToCents(raw);
    if (cents !== null && maxCents !== undefined && cents > maxCents) return;
    setText(raw);
    setLastValue(cents);
    onValueChange(cents);
  }

  function handleBlur(e: FocusEvent<HTMLInputElement>) {
    const cents = parseMoneyToCents(text);
    setText(cents === null ? '' : centsToInput(cents));
    onBlur?.(e);
  }

  return (
    <Input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      mono
      className="text-right"
      prefix={<span className="num text-[13px] font-medium text-ink-2">L</span>}
      placeholder={placeholder}
      value={text}
      invalid={invalid}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
