import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PATIENT_NAME_MAX_LENGTH } from '../../../schemas/invoice.schema';
import { PatientStep } from './PatientStep';

describe('PatientStep', () => {
  it('shows the backend-aligned character limit and associates help text with the field', () => {
    render(
      <PatientStep
        patientName="Maria Lopez"
        onPatientNameChange={vi.fn()}
      />,
    );

    const input = screen.getByLabelText(/nombre del paciente/i);
    const help = screen.getByText(`11/${PATIENT_NAME_MAX_LENGTH} caracteres`);

    expect(input).toHaveAttribute('maxLength', String(PATIENT_NAME_MAX_LENGTH));
    expect(input).toHaveAccessibleDescription(help.textContent ?? '');
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
});
