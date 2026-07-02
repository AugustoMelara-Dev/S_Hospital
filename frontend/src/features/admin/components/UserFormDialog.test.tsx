import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserFormDialog, isPasswordPolicyCompliant } from './UserFormDialog';
import { type AuthUser, type RoleDefinition } from '@/lib/api';

const roles: RoleDefinition[] = [
  {
    id: 1,
    name: 'admin',
    protected: true,
    permissions: [],
  },
  {
    id: 2,
    name: 'cajero',
    protected: false,
    permissions: [],
  },
];

const permissionCatalog = [
  {
    module: 'invoices',
    label: 'Facturación',
    permissions: [{ name: 'invoices.create', label: 'Crear facturas' }],
  },
];

const baseUser: AuthUser = {
  id: 1,
  name: 'Admin Demo',
  email: 'admin@hospital.org',
  username: 'admin',
  active: true,
  roles: ['admin'],
  permissions: ['invoices.create'],
  uses_exact_permission_map: false,
  must_change_password: false,
};

describe('isPasswordPolicyCompliant', () => {
  it('rejects passwords shorter than 12 characters', () => {
    expect(isPasswordPolicyCompliant('Short1!')).toBe(false);
  });

  it('rejects passwords missing any required category', () => {
    expect(isPasswordPolicyCompliant('alllowercase1!')).toBe(false);
    expect(isPasswordPolicyCompliant('ALLUPPERCASE1!')).toBe(false);
    expect(isPasswordPolicyCompliant('NoNumber!Aa')).toBe(false);
    expect(isPasswordPolicyCompliant('NoSymbol123Aa')).toBe(false);
  });

  it('accepts compliant passwords', () => {
    expect(isPasswordPolicyCompliant('Aa1!Aa1!Aa1!')).toBe(true);
  });
});

describe('UserFormDialog', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders password field only when creating a new user', () => {
    const { rerender } = render(
      <UserFormDialog
        open
        onOpenChange={vi.fn()}
        editingUser={null}
        roles={roles}
        canManageRoles
        selectedUserPermissions={['invoices.create']}
        onToggleUserPermission={vi.fn()}
        permissionCatalog={permissionCatalog}
        globalError={null}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/contraseña inicial/i)).toBeInTheDocument();

    rerender(
      <UserFormDialog
        open
        onOpenChange={vi.fn()}
        editingUser={baseUser}
        roles={roles}
        canManageRoles
        selectedUserPermissions={['invoices.create']}
        onToggleUserPermission={vi.fn()}
        permissionCatalog={permissionCatalog}
        globalError={null}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText(/contraseña inicial/i)).not.toBeInTheDocument();
  });

  it('marks critical direct permissions with a visible risk label', () => {
    render(
      <UserFormDialog
        open
        onOpenChange={vi.fn()}
        editingUser={baseUser}
        roles={roles}
        canManageRoles
        selectedUserPermissions={['receipt_settings.advanced']}
        onToggleUserPermission={vi.fn()}
        permissionCatalog={[
          {
            module: 'receipts',
            label: 'Recibos',
            permissions: [
              {
                name: 'receipt_settings.advanced',
                label: 'Modo soporte tecnico de recibos',
              },
            ],
          },
        ]}
        globalError={null}
        onSubmit={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('checkbox', { name: /modo soporte tecnico de recibos/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/permiso critico/i)).toBeInTheDocument();
  });

  it('requires explicit confirmation before saving a user with critical direct permissions', () => {
    render(
      <UserFormDialog
        open
        onOpenChange={vi.fn()}
        editingUser={baseUser}
        roles={roles}
        canManageRoles
        selectedUserPermissions={['receipt_settings.advanced']}
        onToggleUserPermission={vi.fn()}
        permissionCatalog={[
          {
            module: 'receipts',
            label: 'Recibos',
            permissions: [
              {
                name: 'receipt_settings.advanced',
                label: 'Modo soporte tecnico de recibos',
              },
            ],
          },
        ]}
        globalError={null}
        onSubmit={vi.fn()}
      />,
    );

    const submit = screen.getByRole('button', { name: /guardar cambios/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /confirmo que este usuario necesita permisos criticos/i }));

    expect(submit).not.toBeDisabled();
  });

  it('rejects a non-compliant new user password with an inline message', async () => {
    const onSubmit = vi.fn();

    render(
      <UserFormDialog
        open
        onOpenChange={vi.fn()}
        editingUser={null}
        roles={roles}
        canManageRoles
        selectedUserPermissions={['invoices.create']}
        onToggleUserPermission={vi.fn()}
        permissionCatalog={permissionCatalog}
        globalError={null}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Cajero Demo' } });
    fireEvent.change(screen.getByLabelText(/correo electr/i), { target: { value: 'cajero@hospital.org' } });
    fireEvent.change(screen.getByLabelText(/nombre de usuario/i), { target: { value: 'cajero' } });
    fireEvent.change(screen.getByLabelText(/contraseña inicial/i), { target: { value: 'short' } });

    fireEvent.click(screen.getByRole('button', { name: /crear usuario/i }));

    await waitFor(() => {
      expect(onSubmit).not.toHaveBeenCalled();
    });

    expect(await screen.findByText(/la contraseña debe tener al menos 12 caracteres/i)).toBeInTheDocument();
  });
});
