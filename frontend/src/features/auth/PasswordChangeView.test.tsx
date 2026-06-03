import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PasswordChangeView, type PasswordChangeForm } from './PasswordChangeView';

const defaultForm: PasswordChangeForm = {
  current_password: '',
  password: '',
  password_confirmation: '',
};

describe('PasswordChangeView', () => {
  it('exposes labeled password fields for the mandatory password change flow', () => {
    const onChange = vi.fn();

    render(
      <PasswordChangeView
        form={defaultForm}
        onChange={onChange}
        onSubmit={vi.fn()}
      />,
    );

    const currentPassword = screen.getByLabelText(/contraseña actual/i);
    const newPassword = screen.getByLabelText(/^nueva contraseña$/i);
    const confirmation = screen.getByLabelText(/confirmar nueva contraseña/i);

    expect(currentPassword).toHaveAttribute('autocomplete', 'current-password');
    expect(newPassword).toHaveAttribute('autocomplete', 'new-password');
    expect(confirmation).toHaveAttribute('autocomplete', 'new-password');

    fireEvent.change(currentPassword, { target: { value: 'Temporal123' } });

    expect(onChange).toHaveBeenCalledWith({
      ...defaultForm,
      current_password: 'Temporal123',
    });
  });

  it('keeps fields and submit disabled while updating the password', () => {
    render(
      <PasswordChangeView
        form={defaultForm}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        submitting
        status="Actualizando contraseña..."
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/actualizando contraseña/i);
    expect(screen.getByLabelText(/contraseña actual/i)).toBeDisabled();
    expect(screen.getByLabelText(/^nueva contraseña$/i)).toBeDisabled();
    expect(screen.getByLabelText(/confirmar nueva contraseña/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /actualizando/i })).toBeDisabled();
  });
});
