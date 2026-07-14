import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PATIENT_NAME_MAX_LENGTH } from '../../../schemas/invoice.schema';
import { PatientStep } from './PatientStep';

describe('PatientStep', () => {
  it('uses an operational patient label without wizard step language', () => {
    render(<PatientStep patientName="" onPatientNameChange={vi.fn()} />);

    expect(screen.getByText('Paciente')).toBeVisible();
    expect(screen.queryByText(/Paso 1/i)).not.toBeInTheDocument();
  });

  it('uses a compact split layout on desktop while keeping the field accessible', () => {
    const { container } = render(
      <PatientStep
        patientName="Maria Lopez"
        onPatientNameChange={vi.fn()}
      />,
    );

    expect(container.querySelector('[class*="lg:grid-cols"]')).toBeInTheDocument();
    expect(screen.getByText('Identificar paciente')).toBeVisible();
    expect(screen.getByLabelText(/nombre del paciente/i)).toHaveAttribute('placeholder', 'Ej. Maria Lopez…');
    expect(screen.getByText(/La factura no necesita expediente clínico/)).toBeInTheDocument();
  });

  it('renders an accessible patient label, controlled value and backend-aligned character limit', () => {
    render(
      <PatientStep
        patientName="Maria Lopez"
        onPatientNameChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/nombre del paciente/i);
    const help = screen.getByText(`11/${PATIENT_NAME_MAX_LENGTH} caracteres`);

    expect(input).toHaveValue('Maria Lopez');
    expect(input).toHaveAttribute('id', 'patient-name');
    expect(input).toHaveAttribute('name', 'patient_name');
    expect(input).toHaveAttribute('maxLength', String(PATIENT_NAME_MAX_LENGTH));
    expect(input).toHaveAccessibleDescription(help.textContent ?? '');
  });

  it('executes onChange with the exact value and submits only with Enter', () => {
    const onPatientNameChange = vi.fn();
    const onPatientSubmit = vi.fn();
    render(
      <PatientStep
        patientName=""
        onPatientNameChange={onPatientNameChange}
        onPatientSubmit={onPatientSubmit}
      />,
    );

    const input = screen.getByLabelText(/nombre del paciente/i);
    fireEvent.change(input, { target: { value: 'Ana Maria' } });
    fireEvent.keyDown(input, { key: 'Tab' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onPatientNameChange).toHaveBeenCalledWith('Ana Maria');
    expect(onPatientSubmit).toHaveBeenCalledTimes(1);
  });

  it('keeps validation error announced with the character counter', () => {
    render(
      <PatientStep
        patientName={'A'.repeat(PATIENT_NAME_MAX_LENGTH)}
        onPatientNameChange={vi.fn()}
        error="Nombre del paciente no puede superar 180 caracteres"
      />,
    );

    const input = screen.getByLabelText(/nombre del paciente/i);

    expect(screen.getByRole('alert')).toHaveTextContent(/180 caracteres/i);
    expect(screen.getByText(`180/${PATIENT_NAME_MAX_LENGTH} caracteres`)).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-describedby', 'patient-name-help patient-name-error');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not add unsupported patient fields', () => {
    render(
      <PatientStep
        patientName=""
        onPatientNameChange={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.queryByLabelText(/expediente|identidad|documento|medico|seguro|habitacion/i)).not.toBeInTheDocument();
  });

  it('offers an accessible optional-data disclosure without requiring extra patient fields', () => {
    render(
      <PatientStep
        patientName="Maria Lopez"
        onPatientNameChange={vi.fn()}
      />,
    );

    const disclosure = screen.getByText('Datos opcionales');
    expect(disclosure.closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText(/no necesita expediente clínico/i)).toBeInTheDocument();
  });

  it('focuses the validation summary when continuing reveals an error', async () => {
    const { rerender } = render(
      <PatientStep
        patientName=""
        onPatientNameChange={vi.fn()}
      />,
    );

    rerender(
      <PatientStep
        patientName=""
        onPatientNameChange={vi.fn()}
        error="Ingrese el nombre del paciente"
      />,
    );

    await waitFor(() => expect(screen.getByRole('alert')).toHaveFocus());
    expect(screen.getByRole('alert')).toHaveAttribute('tabindex', '-1');
  });
});
