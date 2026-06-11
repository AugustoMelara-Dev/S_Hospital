import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersView } from './UsersView';
import { apiClient, type AuthUser } from '@/lib/api';

const passwordPolicyMessage = /contraseña debe tener al menos 10 caracteres e incluir letras y números/i;

const adminUser: AuthUser = {
  id: 1,
  name: 'Admin Hospital',
  email: 'admin@hospital.test',
  username: 'admin',
  active: true,
  roles: ['admin'],
  permissions: ['users.create', 'users.update'],
  must_change_password: false,
};

describe('UsersView', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getUsers').mockResolvedValue([adminUser]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('hides the create action when the user lacks users.create', async () => {
    render(<UsersView onStatus={vi.fn()} canCreateUsers={false} />);

    expect(await screen.findByText('Admin Hospital')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear usuario/i })).not.toBeInTheDocument();
  });

  it('validates new user passwords with the same policy as Laravel', async () => {
    const createUser = vi.spyOn(apiClient, 'createUser').mockResolvedValue({
      ...adminUser,
      id: 2,
      name: 'Caja Principal',
      email: 'caja@hospital.test',
      username: 'caja',
      roles: ['cajero'],
      must_change_password: true,
    });

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} />);

    fireEvent.click(await screen.findByRole('button', { name: /crear usuario/i }));
    const dialog = screen.getByRole('dialog', { name: /crear usuario/i });

    fireEvent.change(within(dialog).getByLabelText(/nombre completo/i), { target: { value: 'Caja Principal' } });
    fireEvent.change(within(dialog).getByLabelText(/correo electrónico/i), { target: { value: 'caja@hospital.test' } });
    fireEvent.change(within(dialog).getByLabelText(/nombre de usuario/i), { target: { value: 'caja' } });
    fireEvent.change(within(dialog).getByLabelText(/contraseña inicial/i), { target: { value: 'abcdefghij' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /crear usuario/i }));

    await waitFor(() => {
      expect(within(dialog).getByText(passwordPolicyMessage)).toBeInTheDocument();
    });
    expect(createUser).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/contraseña inicial/i), { target: { value: 'Password123' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /crear usuario/i }));

    await waitFor(() => expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      password: 'Password123',
    })));
  });

  it('prevents duplicated create user submissions while the request is pending', async () => {
    let resolveCreate!: (user: AuthUser) => void;
    const createUser = vi.spyOn(apiClient, 'createUser').mockReturnValue(new Promise<AuthUser>((resolve) => {
      resolveCreate = resolve;
    }));

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} />);

    fireEvent.click(await screen.findByRole('button', { name: /crear usuario/i }));
    const dialog = screen.getByRole('dialog', { name: /crear usuario/i });

    fireEvent.change(within(dialog).getByLabelText(/nombre completo/i), { target: { value: 'Caja Principal' } });
    fireEvent.change(within(dialog).getByLabelText(/correo electr/i), { target: { value: 'caja@hospital.test' } });
    fireEvent.change(within(dialog).getByLabelText(/nombre de usuario/i), { target: { value: 'caja' } });
    fireEvent.change(within(dialog).getByLabelText(/contrase/i), { target: { value: 'Password123' } });

    const submit = within(dialog).getByRole('button', { name: /crear usuario/i });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /guardando/i })).toBeDisabled());

    resolveCreate({
      ...adminUser,
      id: 2,
      name: 'Caja Principal',
      email: 'caja@hospital.test',
      username: 'caja',
      roles: ['cajero'],
      must_change_password: true,
    });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /crear usuario/i })).not.toBeInTheDocument());
  });

  it('validates reset passwords with the same policy as Laravel', async () => {
    const resetPassword = vi.spyOn(apiClient, 'resetUserPassword').mockResolvedValue({
      ...adminUser,
      must_change_password: true,
    });

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} />);

    fireEvent.click(await screen.findByTitle('Restablecer clave'));
    const dialog = screen.getByRole('dialog', { name: /restablecer clave/i });

    fireEvent.change(within(dialog).getByLabelText(/nueva contraseña temporal/i), { target: { value: 'abcdefghij' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /restablecer clave/i }));

    await waitFor(() => {
      expect(within(dialog).getByText(passwordPolicyMessage)).toBeInTheDocument();
    });
    expect(resetPassword).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/nueva contraseña temporal/i), { target: { value: 'Password123' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /restablecer clave/i }));

    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith(adminUser.id, 'Password123'));
  });

  it('keeps the status confirmation locked while the request is pending', async () => {
    let resolveToggle!: (user: AuthUser) => void;
    const toggleUser = vi.spyOn(apiClient, 'toggleUserActive').mockReturnValue(new Promise<AuthUser>((resolve) => {
      resolveToggle = resolve;
    }));

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} />);

    fireEvent.click(await screen.findByTitle('Desactivar usuario'));
    const dialog = screen.getByRole('alertdialog', { name: /desactivar usuario/i });
    const confirm = within(dialog).getByRole('button', { name: /desactivar/i });

    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(toggleUser).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /cambiando/i })).toBeDisabled());
    expect(within(dialog).getByRole('button', { name: /cancelar/i })).toBeDisabled();

    resolveToggle({
      ...adminUser,
      active: false,
    });

    await waitFor(() => expect(screen.queryByRole('alertdialog', { name: /desactivar usuario/i })).not.toBeInTheDocument());
  });
});
