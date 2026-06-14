import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './input';
import { FormField } from './form-field';

describe('FormField', () => {
  it('connects label, hint and error to the control', () => {
    render(
      <FormField id="patient-name" label="Nombre del paciente" hint="Escriba el nombre que saldrá en la factura." error="El nombre es obligatorio">
        {({ describedBy, id, invalid }) => (
          <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} />
        )}
      </FormField>,
    );

    const input = screen.getByLabelText('Nombre del paciente');

    expect(input).toHaveAttribute('id', 'patient-name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'patient-name-hint patient-name-error');
    expect(screen.getByRole('alert')).toHaveTextContent('El nombre es obligatorio');
  });
});

