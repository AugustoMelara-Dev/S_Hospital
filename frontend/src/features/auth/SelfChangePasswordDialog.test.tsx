import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelfChangePasswordDialog } from './SelfChangePasswordDialog';
import { apiClient, type AuthUser } from '../../lib/api';

const cashier: AuthUser = {
  id: 2,
  name: 'Cajero Validacion',
  email: 'cajero@hospital.local',
  username: 'cajero.validacion',
  active: true,
  roles: ['cajero'],
  permissions: ['invoices.view', 'receipts.view'],
  must_change_password: false,
};

describe('SelfChangePasswordDialog', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('submits the change and surfaces a success status to the caller', async () => {
    const onStatus = vi.fn();
    const onOpenChange = vi.fn();
    const changePasswordSpy = vi
      .spyOn(apiClient, 'changePassword')
      .mockResolvedValue(cashier);

    render(
      <SelfChangePasswordDialog
        open
        onOpenChange={onOpenChange}
        onStatus={onStatus}
      />,
    );

    fireEvent.change(screen.getByLabelText(/contrasena actual/i), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByLabelText('Nueva contrasena'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar nueva contrasena/i), {
      target: { value: 'NewPassword123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /actualizar contrasena/i }));

    await waitFor(() => {
      expect(changePasswordSpy).toHaveBeenCalledWith({
        current_password: 'Password123',
        password: 'NewPassword123',
        password_confirmation: 'NewPassword123',
      });
    });

    expect(onStatus).toHaveBeenCalledWith(expect.stringContaining('actualizada'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('blocks submit when the new password does not meet the policy', async () => {
    const changePasswordSpy = vi.spyOn(apiClient, 'changePassword');

    render(
      <SelfChangePasswordDialog open onOpenChange={vi.fn()} onStatus={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText(/contrasena actual/i), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByLabelText('Nueva contrasena'), {
      target: { value: 'short' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar nueva contrasena/i), {
      target: { value: 'short' },
    });

    fireEvent.click(screen.getByRole('button', { name: /actualizar contrasena/i }));

    await waitFor(() => {
      expect(
        screen.getAllByText(/al menos 10 caracteres/i).length,
      ).toBeGreaterThan(0);
    });
    expect(changePasswordSpy).not.toHaveBeenCalled();
  });

  it('shows a server error when the backend rejects the request', async () => {
    vi.spyOn(apiClient, 'changePassword').mockRejectedValue(
      new Error('La contrasena actual no es valida.'),
    );
    const onStatus = vi.fn();

    render(
      <SelfChangePasswordDialog open onOpenChange={vi.fn()} onStatus={onStatus} />,
    );

    fireEvent.change(screen.getByLabelText(/contrasena actual/i), {
      target: { value: 'Password123' },
    });
    fireEvent.change(screen.getByLabelText('Nueva contrasena'), {
      target: { value: 'NewPassword123' },
    });
    fireEvent.change(screen.getByLabelText(/confirmar nueva contrasena/i), {
      target: { value: 'NewPassword123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /actualizar contrasena/i }));

    expect(await screen.findByText(/La contrasena actual no es valida\./i)).toBeInTheDocument();
    expect(onStatus).not.toHaveBeenCalled();
  });
});
