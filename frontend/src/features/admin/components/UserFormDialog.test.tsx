import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

function criticalPermission(name: string, label: string) {
  return {
    name,
    module: name.split('.')[0],
    label,
    critical: true,
    risk_level: 'critical',
    risk_label: 'Permiso operativo sensible.',
  };
}

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
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('trims user identity fields before creating an operational account', async () => {
    const onSubmit = vi.fn();

    render(
      <UserFormDialog
        open
        onOpenChange={vi.fn()}
        editingUser={null}
        roles={roles}
        canManageRoles={false}
        selectedUserPermissions={['invoices.create']}
        onToggleUserPermission={vi.fn()}
        permissionCatalog={permissionCatalog}
        globalError={null}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: '  Caja Principal  ' } });
    fireEvent.change(screen.getByLabelText(/correo electr/i), { target: { value: '  caja.principal@hospital.org  ' } });
    fireEvent.change(screen.getByLabelText(/nombre de usuario/i), { target: { value: '  caja_principal  ' } });
    fireEvent.change(screen.getByLabelText(/contrase/i), { target: { value: 'Password123!' } });

    fireEvent.click(screen.getByRole('button', { name: /crear usuario/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
      name: 'Caja Principal',
      email: 'caja.principal@hospital.org',
      username: 'caja_principal',
      password: 'Password123!',
      role: 'cajero',
    }));
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
        advancedPermissionMode
        onAdvancedPermissionModeChange={vi.fn()}
        selectedUserPermissions={['receipt_settings.advanced']}
        onToggleUserPermission={vi.fn()}
        permissionCatalog={[
          {
            module: 'receipts',
            label: 'Recibos',
            permissions: [
              criticalPermission('receipt_settings.advanced', 'Modo soporte tecnico de recibos'),
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

  it('uses backend risk metadata for critical direct permissions outside the local catalog names', () => {
    render(
      <UserFormDialog
        open
        onOpenChange={vi.fn()}
        editingUser={baseUser}
        roles={roles}
        canManageRoles
        advancedPermissionMode
        onAdvancedPermissionModeChange={vi.fn()}
        selectedUserPermissions={['support.remote_unlock']}
        onToggleUserPermission={vi.fn()}
        permissionCatalog={[
          {
            module: 'support',
            label: 'Soporte',
            permissions: [
              {
                name: 'support.remote_unlock',
                label: 'Desbloquear soporte remoto',
                critical: true,
                risk_level: 'critical',
                risk_label: 'Permite habilitar soporte tecnico temporal.',
              },
            ],
          },
        ]}
        globalError={null}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(/permiso critico/i)).toBeInTheDocument();
    expect(screen.getByText(/habilitar soporte tecnico temporal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /guardar cambios/i })).toBeDisabled();
  });

  it('does not render technical permission slugs while toggling the real permission value', () => {
    const onToggleUserPermission = vi.fn();

    render(
      <UserFormDialog
        open
        onOpenChange={vi.fn()}
        editingUser={baseUser}
        roles={roles}
        canManageRoles
        advancedPermissionMode
        onAdvancedPermissionModeChange={vi.fn()}
        selectedUserPermissions={['audit.view']}
        onToggleUserPermission={onToggleUserPermission}
        permissionCatalog={[
          {
            module: 'audit',
            label: 'Auditoria',
            permissions: [{ name: 'audit.view', label: 'Ver auditoria' }],
          },
        ]}
        globalError={null}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.queryByText('audit.view')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: /ver auditoria/i }));
    expect(onToggleUserPermission).toHaveBeenCalledWith('audit.view', false);
  });

  it('requires explicit confirmation before saving a user with critical direct permissions', () => {
    render(
      <UserFormDialog
        open
        onOpenChange={vi.fn()}
        editingUser={baseUser}
        roles={roles}
        canManageRoles
        advancedPermissionMode
        onAdvancedPermissionModeChange={vi.fn()}
        selectedUserPermissions={['receipt_settings.advanced']}
        onToggleUserPermission={vi.fn()}
        permissionCatalog={[
          {
            module: 'receipts',
            label: 'Recibos',
            permissions: [
              criticalPermission('receipt_settings.advanced', 'Modo soporte tecnico de recibos'),
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

  it('requires explicit confirmation before saving an elevated operational role', async () => {
    const onSubmit = vi.fn();

    render(
      <UserFormDialog
        open
        onOpenChange={vi.fn()}
        editingUser={null}
        roles={roles}
        canManageRoles
        canAssignAdminRole
        selectedUserPermissions={['invoices.create']}
        onToggleUserPermission={vi.fn()}
        permissionCatalog={permissionCatalog}
        globalError={null}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.mouseDown(screen.getByRole('combobox', { name: /rol operativo/i }));
    await screen.findByRole('option', { name: /^Admin/i });
    const adminOption = Array.from(document.querySelectorAll<HTMLElement>('.ant-select-item-option')).find(
      (option) => option.textContent?.startsWith('Admin'),
    );
    expect(adminOption).toBeDefined();
    fireEvent.click(adminOption!);

    await waitFor(() => expect(screen.getByText(/rol critico/i)).toBeInTheDocument());

    const submit = screen.getByRole('button', { name: /crear usuario/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /confirmo que este usuario necesita rol administrativo/i }));

    expect(submit).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Admin Turno' } });
    fireEvent.change(screen.getByLabelText(/correo electr/i), { target: { value: 'admin.turno@hospital.org' } });
    fireEvent.change(screen.getByLabelText(/nombre de usuario/i), { target: { value: 'admin_turno' } });
    fireEvent.change(screen.getByLabelText(/contrase/i), { target: { value: 'Password123!' } });
    fireEvent.click(submit);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      role: 'admin',
    })));
  });

  it('hides custom roles with critical permissions from user creators without admin assignment permission', async () => {
    render(
      <UserFormDialog
        open
        onOpenChange={vi.fn()}
        editingUser={null}
        roles={[
          ...roles,
          {
            id: 3,
            name: 'backup_operator',
            protected: false,
            permissions: [
              criticalPermission('backups.download', 'Descargar respaldos'),
            ],
          },
        ]}
        canManageRoles
        canAssignAdminRole={false}
        selectedUserPermissions={['invoices.create']}
        onToggleUserPermission={vi.fn()}
        permissionCatalog={permissionCatalog}
        globalError={null}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.mouseDown(screen.getByRole('combobox', { name: /rol operativo/i }));

    expect(await screen.findByRole('option', { name: /^Cajero/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^Backup Operator/i })).not.toBeInTheDocument();
  });

  it('requires explicit confirmation before saving a user that can download backups directly', () => {
    render(
      <UserFormDialog
        open
        onOpenChange={vi.fn()}
        editingUser={baseUser}
        roles={roles}
        canManageRoles
        advancedPermissionMode
        onAdvancedPermissionModeChange={vi.fn()}
        selectedUserPermissions={['backups.download']}
        onToggleUserPermission={vi.fn()}
        permissionCatalog={[
          {
            module: 'backups',
            label: 'Respaldos',
            permissions: [
              criticalPermission('backups.download', 'Descargar respaldos'),
            ],
          },
        ]}
        globalError={null}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(/permiso critico/i)).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /guardar cambios/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /confirmo que este usuario necesita permisos criticos/i }));

    expect(submit).not.toBeDisabled();
  });

  it('requires explicit confirmation before saving managerial report direct permissions', () => {
    render(
      <UserFormDialog
        open
        onOpenChange={vi.fn()}
        editingUser={baseUser}
        roles={roles}
        canManageRoles
        advancedPermissionMode
        onAdvancedPermissionModeChange={vi.fn()}
        selectedUserPermissions={['reports.managerial.view', 'reports.export']}
        onToggleUserPermission={vi.fn()}
        permissionCatalog={[
          {
            module: 'reports',
            label: 'Reportes',
            permissions: [
              criticalPermission('reports.managerial.view', 'Ver reportes gerenciales'),
              criticalPermission('reports.export', 'Exportar reportes'),
            ],
          },
        ]}
        globalError={null}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/permiso critico/i)).toHaveLength(2);
    const submit = screen.getByRole('button', { name: /guardar cambios/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /confirmo que este usuario necesita permisos criticos/i }));

    expect(submit).not.toBeDisabled();
  });

  it('requires explicit confirmation before saving audit direct permission', () => {
    render(
      <UserFormDialog
        open
        onOpenChange={vi.fn()}
        editingUser={baseUser}
        roles={roles}
        canManageRoles
        advancedPermissionMode
        onAdvancedPermissionModeChange={vi.fn()}
        selectedUserPermissions={['audit.view']}
        onToggleUserPermission={vi.fn()}
        permissionCatalog={[
          {
            module: 'audit',
            label: 'Auditoria',
            permissions: [
              criticalPermission('audit.view', 'Ver auditoria'),
            ],
          },
        ]}
        globalError={null}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(/permiso critico/i)).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /guardar cambios/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /confirmo que este usuario necesita permisos criticos/i }));

    expect(submit).not.toBeDisabled();
  });

  it('requires explicit confirmation before saving operate-any invoice direct permission', () => {
    render(
      <UserFormDialog
        open
        onOpenChange={vi.fn()}
        editingUser={baseUser}
        roles={roles}
        canManageRoles
        advancedPermissionMode
        onAdvancedPermissionModeChange={vi.fn()}
        selectedUserPermissions={['invoices.operate_any']}
        onToggleUserPermission={vi.fn()}
        permissionCatalog={[
          {
            module: 'invoices',
            label: 'Facturacion',
            permissions: [
              criticalPermission('invoices.operate_any', 'Operar cualquier factura'),
            ],
          },
        ]}
        globalError={null}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(/permiso critico/i)).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /guardar cambios/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /confirmo que este usuario necesita permisos criticos/i }));

    expect(submit).not.toBeDisabled();
  });

  it('requires explicit confirmation before saving fiscal sequence reset direct permission', () => {
    render(
      <UserFormDialog
        open
        onOpenChange={vi.fn()}
        editingUser={baseUser}
        roles={roles}
        canManageRoles
        advancedPermissionMode
        onAdvancedPermissionModeChange={vi.fn()}
        selectedUserPermissions={['fiscal.sequences.reset']}
        onToggleUserPermission={vi.fn()}
        permissionCatalog={[
          {
            module: 'fiscal',
            label: 'Fiscal',
            permissions: [
              criticalPermission('fiscal.sequences.reset', 'Reiniciar correlativo fiscal'),
            ],
          },
        ]}
        globalError={null}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(/permiso critico/i)).toBeInTheDocument();
    const submit = screen.getByRole('button', { name: /guardar cambios/i });
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole('checkbox', { name: /confirmo que este usuario necesita permisos criticos/i }));

    expect(submit).not.toBeDisabled();
  });

  it('requires explicit confirmation before saving user disable direct permission', () => {
    render(
      <UserFormDialog
        open
        onOpenChange={vi.fn()}
        editingUser={baseUser}
        roles={roles}
        canManageRoles
        advancedPermissionMode
        onAdvancedPermissionModeChange={vi.fn()}
        selectedUserPermissions={['users.disable']}
        onToggleUserPermission={vi.fn()}
        permissionCatalog={[
          {
            module: 'users',
            label: 'Usuarios',
            permissions: [
              criticalPermission('users.disable', 'Desactivar usuarios'),
            ],
          },
        ]}
        globalError={null}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText(/permiso critico/i)).toBeInTheDocument();
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

  it('locks user identity fields while the save request is pending', async () => {
    let resolveSave: () => void = () => undefined;
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );

    render(
      <UserFormDialog
        open
        onOpenChange={vi.fn()}
        editingUser={null}
        roles={roles}
        canManageRoles={false}
        selectedUserPermissions={['invoices.create']}
        onToggleUserPermission={vi.fn()}
        permissionCatalog={permissionCatalog}
        globalError={null}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText(/nombre completo/i), { target: { value: 'Caja Turno' } });
    fireEvent.change(screen.getByLabelText(/correo electr/i), { target: { value: 'caja.turno@hospital.org' } });
    fireEvent.change(screen.getByLabelText(/nombre de usuario/i), { target: { value: 'caja_turno' } });
    fireEvent.change(screen.getByLabelText(/contrase/i), { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: /crear usuario/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled());
    expect(screen.getByLabelText(/correo electr/i)).toBeDisabled();

    await act(async () => {
      resolveSave();
    });
  });
});
