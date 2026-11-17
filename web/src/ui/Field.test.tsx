import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from './Field';
import { Input } from './Input';
import { Select } from './Select';

describe('Field', () => {
  it('wires label, hint and error to the control', () => {
    render(
      <Field label="Nombre del paciente" hint="Único dato personal." error="Ingrese el nombre del paciente." required>
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText(/Nombre del paciente/);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toBeRequired();
    expect(input).toHaveAccessibleDescription('Ingrese el nombre del paciente. Único dato personal.');
  });

  it('works with Select', () => {
    render(
      <Field label="Método de pago">
        <Select
          options={[
            { value: 'cash', label: 'Efectivo' },
            { value: 'card', label: 'Tarjeta' },
          ]}
        />
      </Field>,
    );
    expect(screen.getByLabelText('Método de pago')).toHaveDisplayValue('Efectivo');
  });
});
