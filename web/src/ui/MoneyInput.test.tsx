import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Field } from './Field';
import { MoneyInput } from './MoneyInput';

function Harness({ onChange, initial = null }: { onChange: (c: number | null) => void; initial?: number | null }) {
  const [v, setV] = useState<number | null>(initial);
  return (
    <>
      <Field label="Efectivo recibido">
        <MoneyInput
          value={v}
          onValueChange={(c) => {
            setV(c);
            onChange(c);
          }}
        />
      </Field>
      <button type="button" onClick={() => setV(50000)}>
        Monto exacto
      </button>
      <output data-testid="cents">{String(v)}</output>
    </>
  );
}

describe('MoneyInput', () => {
  it('emits integer cents while typing and formats on blur', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText('Efectivo recibido');
    await user.type(input, '1234.5');
    expect(onChange).toHaveBeenLastCalledWith(123450);
    await user.tab();
    expect(input).toHaveValue('1,234.50');
    expect(screen.getByTestId('cents')).toHaveTextContent('123450');
  });

  it('accepts grouped input and rejects a third decimal', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText('Efectivo recibido');
    await user.type(input, '1,000.999');
    expect(input).toHaveValue('1,000.99');
    expect(onChange).toHaveBeenLastCalledWith(100099);
  });

  it('ignores letters and reports empty as null', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} initial={2500} />);
    const input = screen.getByLabelText('Efectivo recibido');
    expect(input).toHaveValue('25.00');
    await user.clear(input);
    expect(onChange).toHaveBeenLastCalledWith(null);
    await user.type(input, 'abc');
    expect(input).toHaveValue('');
  });

  it('adopts external value changes', async () => {
    const user = userEvent.setup();
    render(<Harness onChange={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Monto exacto' }));
    expect(screen.getByLabelText('Efectivo recibido')).toHaveValue('500.00');
  });
});
