import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersView } from './UsersView';
import { ApiError, apiClient, type AuthUser, type RoleDefinition } from '@/lib/api';

const passwordPolicyMessage = /contraseña debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y símbolo/i;

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

const inactiveExactAccessUser: AuthUser = {
  ...adminUser,
  id: 9,
  name: 'Pendiente Modulos',
  email: 'pendiente-modulos@hospital.test',
  username: 'pendiente-modulos',
  active: false,
  roles: ['cajero'],
  permissions: [],
  direct_permissions: [],
  uses_exact_permission_map: true,
};

const roleCatalog = {
  roles: [
    { id: 1, name: 'admin', protected: true, permissions: [] },
    { id: 2, name: 'cajero', protected: false, permissions: [] },
    { id: 3, name: 'auditor', protected: false, permissions: [] },
    {
      id: 4,
      name: 'catalog_manager',
      protected: false,
      permissions: [
        { name: 'catalog.view', module: 'catalog', label: 'Catalog view' },
        { name: 'catalog.manage', module: 'catalog', label: 'Catalog manage' },
      ],
    },
  ] satisfies RoleDefinition[],
  permissionCatalog: [
    {
      module: 'catalog',
      label: 'Catalogo',
      permissions: [
        { name: 'catalog.view', module: 'catalog', label: 'Catalog view' },
        { name: 'catalog.manage', module: 'catalog', label: 'Catalog manage' },
      ],
    },
    {
      module: 'reports',
      label: 'Reportes',
      permissions: [
        { name: 'reports.view', module: 'reports', label: 'Reports view' },
      ],
    },
  ],
};

async function openUserActions(userName: string) {
  const trigger = await screen.findByRole('button', { name: new RegExp(`acciones de usuario ${userName}`, 'i') });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter', keyCode: 13, charCode: 13 });
  fireEvent.click(trigger);
}

function openAdvancedUserPermissions(dialog: HTMLElement) {
  fireEvent.click(within(dialog).getByText(/permisos exactos avanzados/i));
}

describe('UsersView', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    vi.spyOn(apiClient, 'getUsers').mockResolvedValue([adminUser]);
    vi.spyOn(apiClient, 'getRoles').mockResolvedValue(roleCatalog);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('hides the create action when the user lacks users.create', async () => {
    render(<UsersView onStatus={vi.fn()} canCreateUsers={false} canManageRoles={false} />);

    expect(await screen.findByText('Admin Hospital')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /buscar usuarios/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear usuario/i })).not.toBeInTheDocument();
  });

  it('shows the V1.2 RBAC summary without changing read-only restrictions', async () => {
    render(<UsersView onStatus={vi.fn()} canCreateUsers={false} canManageRoles={false} />);

    expect(await screen.findByRole('heading', { name: /usuarios y permisos/i })).toBeInTheDocument();
    expect(screen.getByText(/rbac activo/i)).toBeInTheDocument();
    expect(screen.getByText(/usuarios activos/i)).toBeInTheDocument();
    expect(screen.getByText(/roles en modo consulta/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear usuario/i })).not.toBeInTheDocument();
  });

  it('hides user mutation actions when the operator only has users.view', async () => {
    render(<UsersView onStatus={vi.fn()} canCreateUsers={false} canManageRoles={false} />);

    expect(await screen.findByText('Admin Hospital')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /acciones de usuario admin hospital/i })).not.toBeInTheDocument();
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
  });

  it('groups per-user mutation actions in a single action menu', async () => {
    vi.mocked(apiClient.getUsers).mockResolvedValueOnce([
      adminUser,
      {
        ...adminUser,
        id: 2,
        name: 'Admin Respaldo',
        email: 'admin-respaldo@hospital.test',
        username: 'admin-respaldo',
      },
    ]);

    render(<UsersView onStatus={vi.fn()} canCreateUsers={false} canUpdateUsers canDisableUsers canManageRoles={false} canAssignAdminRole />);

    await openUserActions('Admin Hospital');

    expect(screen.queryByRole('button', { name: /editar usuario admin hospital/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restablecer clave de admin hospital/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /desactivar usuario admin hospital/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('menuitem', { name: /^editar$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /restablecer clave/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^desactivar$/i })).toBeInTheDocument();
  });

  it('shows exact user actions only for matching permissions', async () => {
    vi.mocked(apiClient.getUsers).mockResolvedValueOnce([
      adminUser,
      {
        ...adminUser,
        id: 2,
        name: 'Admin Respaldo',
        email: 'admin-respaldo@hospital.test',
        username: 'admin-respaldo',
      },
    ]);

    render(<UsersView onStatus={vi.fn()} canCreateUsers={false} canUpdateUsers canManageRoles={false} canAssignAdminRole />);

    await openUserActions('Admin Hospital');
    expect(await screen.findByRole('menuitem', { name: /^editar$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /restablecer clave/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /^desactivar$/i })).not.toBeInTheDocument();

    cleanup();
    vi.mocked(apiClient.getUsers).mockResolvedValue([
      adminUser,
      {
        ...adminUser,
        id: 2,
        name: 'Admin Respaldo',
        email: 'admin-respaldo@hospital.test',
        username: 'admin-respaldo',
      },
    ]);
    vi.mocked(apiClient.getRoles).mockResolvedValue(roleCatalog);

    render(<UsersView onStatus={vi.fn()} canCreateUsers={false} canDisableUsers canManageRoles={false} canAssignAdminRole />);

    await openUserActions('Admin Hospital');
    expect(await screen.findByRole('menuitem', { name: /^desactivar$/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /^editar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /restablecer clave/i })).not.toBeInTheDocument();
  });

  it('does not expose self password reset or self deactivation actions', async () => {
    vi.mocked(apiClient.getUsers).mockResolvedValueOnce([
      adminUser,
      {
        ...adminUser,
        id: 2,
        name: 'Caja Objetivo',
        email: 'caja-objetivo@hospital.test',
        username: 'caja-objetivo',
        roles: ['cajero'],
      },
    ]);

    render(
      <UsersView
        onStatus={vi.fn()}
        canCreateUsers={false}
        canUpdateUsers
        canDisableUsers
        canManageRoles={false}
        canAssignAdminRole
        currentUserId={adminUser.id}
      />,
    );

    await openUserActions('Admin Hospital');
    expect(await screen.findByRole('menuitem', { name: /^editar$/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /restablecer clave/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /^desactivar$/i })).not.toBeInTheDocument();

    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    await openUserActions('Caja Objetivo');
    expect(await screen.findByRole('menuitem', { name: /^editar$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /restablecer clave/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^desactivar$/i })).toBeInTheDocument();
  });

  it('does not expose protected user actions without admin assignment permission', async () => {
    vi.mocked(apiClient.getUsers).mockResolvedValueOnce([
      adminUser,
      {
        ...adminUser,
        id: 3,
        name: 'Caja Operativa',
        email: 'caja-operativa@hospital.test',
        username: 'caja-operativa',
        roles: ['cajero'],
      },
    ]);

    render(
      <UsersView
        onStatus={vi.fn()}
        canCreateUsers={false}
        canUpdateUsers
        canDisableUsers
        canManageRoles={false}
        canAssignAdminRole={false}
        currentUserId={99}
      />,
    );

    expect(await screen.findByText('Admin Hospital')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /acciones de usuario admin hospital/i })).not.toBeInTheDocument();

    await openUserActions('Caja Operativa');
    expect(await screen.findByRole('menuitem', { name: /^editar$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /restablecer clave/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /^desactivar$/i })).toBeInTheDocument();
  });
  it('does not expose deactivation for the only active administrator', async () => {
    vi.mocked(apiClient.getUsers).mockResolvedValueOnce([
      adminUser,
      {
        ...adminUser,
        id: 3,
        name: 'Caja Operativa',
        email: 'caja-operativa@hospital.test',
        username: 'caja-operativa',
        roles: ['cajero'],
      },
    ]);

    render(
      <UsersView
        onStatus={vi.fn()}
        canCreateUsers={false}
        canUpdateUsers
        canDisableUsers
        canManageRoles={false}
        canAssignAdminRole
        currentUserId={99}
      />,
    );

    await openUserActions('Admin Hospital');

    expect(await screen.findByRole('menuitem', { name: /^editar$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /restablecer clave/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /^desactivar$/i })).not.toBeInTheDocument();
  });
  it('does not offer demoting the only active administrator', async () => {
    vi.mocked(apiClient.getUsers).mockResolvedValueOnce([
      adminUser,
      {
        ...adminUser,
        id: 3,
        name: 'Caja Operativa',
        email: 'caja-operativa@hospital.test',
        username: 'caja-operativa',
        roles: ['cajero'],
      },
    ]);

    render(
      <UsersView
        onStatus={vi.fn()}
        canCreateUsers={false}
        canUpdateUsers
        canDisableUsers
        canManageRoles={false}
        canAssignAdminRole
        currentUserId={99}
      />,
    );

    await openUserActions('Admin Hospital');
    fireEvent.click(await screen.findByRole('menuitem', { name: /^editar$/i }));

    const dialog = await screen.findByRole('dialog', { name: /editar usuario/i });
    expect(within(dialog).getByText(/conserva el rol protegido/i)).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('combobox', { name: /rol operativo/i }));

    expect(screen.getByRole('option', { name: /Admin/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^Cajero$/i })).not.toBeInTheDocument();
  });

  it('shows a recoverable load error instead of leaving users in loading', async () => {
    const getUsers = vi.mocked(apiClient.getUsers);
    getUsers
      .mockRejectedValueOnce(new ApiError('Too many requests', 429))
      .mockResolvedValueOnce([adminUser]);
    const onStatus = vi.fn();

    render(<UsersView onStatus={onStatus} canCreateUsers={false} canManageRoles={false} />);

    expect(await screen.findByRole('heading', { name: /no se pudieron cargar los usuarios/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    expect(onStatus).toHaveBeenCalledWith(expect.stringMatching(/demasiados intentos/i));

    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByText('Admin Hospital')).toBeInTheDocument();
    expect(getUsers).toHaveBeenCalledTimes(2);
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

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canManageRoles={false} />);

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

    fireEvent.change(within(dialog).getByLabelText(/contraseña inicial/i), { target: { value: 'Password123!' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /crear usuario/i }));

    await waitFor(() => expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      password: 'Password123!',
    })));
  });

  it('hides elevated roles from user creators without admin assignment permission', async () => {
    vi.mocked(apiClient.getRoles).mockResolvedValueOnce({
      roles: [
        { id: 1, name: 'admin', protected: true, permissions: [] },
        { id: 2, name: 'cajero', protected: false, permissions: [] },
        { id: 3, name: 'supervisor', protected: false, permissions: [] },
        { id: 4, name: 'auditor', protected: false, permissions: [] },
        { id: 5, name: 'catalog_manager', protected: false, permissions: [] },
      ],
      permissionCatalog: [],
    });

    render(
      <UsersView
        onStatus={vi.fn()}
        canCreateUsers
        canManageRoles={false}
        canAssignAdminRole={false}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /crear usuario/i }));
    const dialog = screen.getByRole('dialog', { name: /crear usuario/i });
    fireEvent.click(within(dialog).getByRole('combobox', { name: /rol operativo/i }));

    expect(screen.getByRole('option', { name: /^Cajero$/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Catalog manager/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^Admin/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^Supervisor$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /^Auditor$/i })).not.toBeInTheDocument();
  });

  it('loads operational roles from the API instead of hardcoding only default roles', async () => {
    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canManageRoles={false} />);

    fireEvent.click(await screen.findByRole('button', { name: /crear usuario/i }));
    const dialog = screen.getByRole('dialog', { name: /crear usuario/i });

    fireEvent.click(within(dialog).getByRole('combobox', { name: /rol operativo/i }));

    expect(await screen.findByRole('option', { name: /Catalog manager/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Auditor/i })).not.toBeInTheDocument();
  });

  it('updates the direct permission template when the administrator changes the user role', async () => {
    const createUser = vi.spyOn(apiClient, 'createUser').mockResolvedValue({
      ...adminUser,
      id: 10,
      name: 'Catalogo Turno',
      email: 'catalogo-turno@hospital.test',
      username: 'catalogo-turno',
      roles: ['catalog_manager'],
      direct_permissions: ['catalog.manage', 'catalog.view'],
      permissions: ['catalog.manage', 'catalog.view'],
      must_change_password: true,
    });

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canUpdateUsers canManageRoles={true} canAssignAdminRole />);

    fireEvent.click(await screen.findByRole('button', { name: /crear usuario/i }));
    const dialog = screen.getByRole('dialog', { name: /crear usuario/i });

    fireEvent.click(within(dialog).getByRole('combobox', { name: /rol operativo/i }));
    fireEvent.click(await screen.findByRole('option', { name: /Catalog manager/i }));
    openAdvancedUserPermissions(dialog);

    expect(within(dialog).getByRole('checkbox', { name: /Catalog view/i })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: /Catalog manage/i })).toBeChecked();

    fireEvent.change(within(dialog).getByLabelText(/nombre completo/i), { target: { value: 'Catalogo Turno' } });
    fireEvent.change(within(dialog).getByLabelText(/correo electr/i), { target: { value: 'catalogo-turno@hospital.test' } });
    fireEvent.change(within(dialog).getByLabelText(/nombre de usuario/i), { target: { value: 'catalogo-turno' } });
    fireEvent.change(within(dialog).getByLabelText(/contrase/i), { target: { value: 'Password123!' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /crear usuario/i }));

    await waitFor(() => expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      role: 'catalog_manager',
      permissions: ['catalog.manage', 'catalog.view'],
    })));
  });

  it('does not send direct permissions when the operator cannot manage roles', async () => {
    const createUser = vi.spyOn(apiClient, 'createUser').mockResolvedValue({
      ...adminUser,
      id: 8,
      name: 'Caja Rol',
      email: 'caja-rol@hospital.test',
      username: 'caja-rol',
      roles: ['cajero'],
      direct_permissions: [],
      must_change_password: true,
    });

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canManageRoles={false} />);

    fireEvent.click(await screen.findByRole('button', { name: /crear usuario/i }));
    const dialog = screen.getByRole('dialog', { name: /crear usuario/i });

    expect(within(dialog).queryByRole('checkbox', { name: /Reports view/i })).not.toBeInTheDocument();
    expect(within(dialog).getByText(/heredara los modulos del rol seleccionado/i)).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/nombre completo/i), { target: { value: 'Caja Rol' } });
    fireEvent.change(within(dialog).getByLabelText(/correo electr/i), { target: { value: 'caja-rol@hospital.test' } });
    fireEvent.change(within(dialog).getByLabelText(/nombre de usuario/i), { target: { value: 'caja-rol' } });
    fireEvent.change(within(dialog).getByLabelText(/contrase/i), { target: { value: 'Password123!' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /crear usuario/i }));

    await waitFor(() => expect(createUser).toHaveBeenCalledWith(expect.not.objectContaining({
      permissions: expect.any(Array),
    })));
  });

  it('keeps basic cashier creation on role inheritance even for role administrators', async () => {
    const createUser = vi.spyOn(apiClient, 'createUser').mockResolvedValue({
      ...adminUser,
      id: 13,
      name: 'Caja Basica',
      email: 'caja-basica@hospital.test',
      username: 'caja-basica',
      roles: ['cajero'],
      direct_permissions: [],
      must_change_password: true,
    });

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canUpdateUsers canManageRoles={true} canAssignAdminRole />);

    fireEvent.click(await screen.findByRole('button', { name: /crear usuario/i }));
    const dialog = screen.getByRole('dialog', { name: /crear usuario/i });

    expect(within(dialog).getByText(/heredara los modulos del rol seleccionado/i)).toBeInTheDocument();
    expect(within(dialog).queryByRole('checkbox', { name: /Reports view/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/reports\.view/i)).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/nombre completo/i), { target: { value: 'Caja Basica' } });
    fireEvent.change(within(dialog).getByLabelText(/correo electr/i), { target: { value: 'caja-basica@hospital.test' } });
    fireEvent.change(within(dialog).getByLabelText(/nombre de usuario/i), { target: { value: 'caja-basica' } });
    fireEvent.change(within(dialog).getByLabelText(/contrase/i), { target: { value: 'Password123!' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /crear usuario/i }));

    await waitFor(() => expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      role: 'cajero',
    })));
    expect(createUser).toHaveBeenCalledWith(expect.not.objectContaining({
      permissions: expect.any(Array),
    }));
  });

  it('filters inoperable restore permissions from forms and user payloads if a legacy catalog returns them', async () => {
    vi.mocked(apiClient.getRoles).mockResolvedValueOnce({
      roles: [
        {
          id: 2,
          name: 'cajero',
          protected: false,
          permissions: [
            { name: 'cash.view', module: 'cash', label: 'Cash view' },
            { name: 'backups.restore', module: 'backups', label: 'Restaurar respaldos' },
          ],
        },
      ],
      permissionCatalog: [
        {
          module: 'cash',
          label: 'Caja',
          permissions: [{ name: 'cash.view', module: 'cash', label: 'Cash view' }],
        },
        {
          module: 'backups',
          label: 'Respaldos',
          permissions: [{ name: 'backups.restore', module: 'backups', label: 'Restaurar respaldos' }],
        },
      ],
    });
    const createUser = vi.spyOn(apiClient, 'createUser').mockResolvedValue({
      ...adminUser,
      id: 12,
      name: 'Caja Sin Restore',
      email: 'caja-sin-restore@hospital.test',
      username: 'caja-sin-restore',
      roles: ['cajero'],
      direct_permissions: ['cash.view'],
      permissions: ['cash.view'],
      must_change_password: true,
    });

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canUpdateUsers canManageRoles={true} canAssignAdminRole />);

    fireEvent.click(await screen.findByRole('button', { name: /crear usuario/i }));
    const dialog = screen.getByRole('dialog', { name: /crear usuario/i });
    openAdvancedUserPermissions(dialog);

    expect(within(dialog).getByRole('checkbox', { name: /Cash view/i })).toBeChecked();
    expect(within(dialog).queryByRole('checkbox', { name: /Restaurar respaldos/i })).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/backups\.restore/i)).not.toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText(/nombre completo/i), { target: { value: 'Caja Sin Restore' } });
    fireEvent.change(within(dialog).getByLabelText(/correo electr/i), { target: { value: 'caja-sin-restore@hospital.test' } });
    fireEvent.change(within(dialog).getByLabelText(/nombre de usuario/i), { target: { value: 'caja-sin-restore' } });
    fireEvent.change(within(dialog).getByLabelText(/contrase/i), { target: { value: 'Password123!' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /crear usuario/i }));

    await waitFor(() => expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      role: 'cajero',
      permissions: ['cash.view'],
    })));
    expect(JSON.stringify(createUser.mock.calls)).not.toContain('backups.restore');
  });

  it('sends selected module permissions when creating an operational user', async () => {
    const createUser = vi.spyOn(apiClient, 'createUser').mockResolvedValue({
      ...adminUser,
      id: 6,
      name: 'Reportes Turno',
      email: 'reportes-turno@hospital.test',
      username: 'reportes-turno',
      roles: ['auditor'],
      direct_permissions: ['reports.view'],
      must_change_password: true,
    });

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canUpdateUsers canManageRoles={true} canAssignAdminRole />);

    fireEvent.click(await screen.findByRole('button', { name: /crear usuario/i }));
    const dialog = screen.getByRole('dialog', { name: /crear usuario/i });
    openAdvancedUserPermissions(dialog);

    fireEvent.change(within(dialog).getByLabelText(/nombre completo/i), { target: { value: 'Reportes Turno' } });
    fireEvent.change(within(dialog).getByLabelText(/correo electr/i), { target: { value: 'reportes-turno@hospital.test' } });
    fireEvent.change(within(dialog).getByLabelText(/nombre de usuario/i), { target: { value: 'reportes-turno' } });
    fireEvent.change(within(dialog).getByLabelText(/contrase/i), { target: { value: 'Password123!' } });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Reports view/i }));
    fireEvent.click(within(dialog).getByRole('button', { name: /crear usuario/i }));

    await waitFor(() => expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      role: 'cajero',
      permissions: ['reports.view'],
    })));
  });

  it('lets an administrator remove a permission inherited from the selected role template', async () => {
    vi.mocked(apiClient.getRoles).mockResolvedValueOnce({
      roles: [
        {
          id: 2,
          name: 'cajero',
          protected: false,
          permissions: [
            { name: 'cash.open', module: 'cash', label: 'Cash open' },
            { name: 'cash.view', module: 'cash', label: 'Cash view' },
          ],
        },
      ],
      permissionCatalog: [
        {
          module: 'cash',
          label: 'Caja',
          permissions: [
            { name: 'cash.open', module: 'cash', label: 'Cash open' },
            { name: 'cash.view', module: 'cash', label: 'Cash view' },
          ],
        },
      ],
    });
    const createUser = vi.spyOn(apiClient, 'createUser').mockResolvedValue({
      ...adminUser,
      id: 7,
      name: 'Caja Solo Lectura',
      email: 'caja-solo-lectura@hospital.test',
      username: 'caja-solo-lectura',
      roles: ['cajero'],
      direct_permissions: ['cash.view'],
      permissions: ['cash.view'],
      must_change_password: true,
    });

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canDisableUsers canManageRoles={true} />);

    fireEvent.click(await screen.findByRole('button', { name: /crear usuario/i }));
    const dialog = screen.getByRole('dialog', { name: /crear usuario/i });
    openAdvancedUserPermissions(dialog);
    const cashOpen = within(dialog).getByRole('checkbox', { name: /Cash open/i });

    expect(cashOpen).toBeChecked();
    fireEvent.click(cashOpen);

    fireEvent.change(within(dialog).getByLabelText(/nombre completo/i), { target: { value: 'Caja Solo Lectura' } });
    fireEvent.change(within(dialog).getByLabelText(/correo electr/i), { target: { value: 'caja-solo-lectura@hospital.test' } });
    fireEvent.change(within(dialog).getByLabelText(/nombre de usuario/i), { target: { value: 'caja-solo-lectura' } });
    fireEvent.change(within(dialog).getByLabelText(/contrase/i), { target: { value: 'Password123!' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /crear usuario/i }));

    await waitFor(() => expect(createUser).toHaveBeenCalledWith(expect.objectContaining({
      role: 'cajero',
      permissions: ['cash.view'],
    })));
  });

  it('blocks creating an active exact-access user with no module permissions', async () => {
    vi.mocked(apiClient.getRoles).mockResolvedValueOnce({
      roles: [
        {
          id: 2,
          name: 'cajero',
          protected: false,
          permissions: [{ name: 'cash.view', module: 'cash', label: 'Cash view' }],
        },
      ],
      permissionCatalog: [
        {
          module: 'cash',
          label: 'Caja',
          permissions: [{ name: 'cash.view', module: 'cash', label: 'Cash view' }],
        },
      ],
    });
    const createUser = vi.spyOn(apiClient, 'createUser');
    const onStatus = vi.fn();

    render(<UsersView onStatus={onStatus} canCreateUsers={true} canManageRoles={true} />);

    fireEvent.click(await screen.findByRole('button', { name: /crear usuario/i }));
    const dialog = screen.getByRole('dialog', { name: /crear usuario/i });
    openAdvancedUserPermissions(dialog);
    const cashView = within(dialog).getByRole('checkbox', { name: /Cash view/i });

    expect(cashView).toBeChecked();
    fireEvent.click(cashView);

    fireEvent.change(within(dialog).getByLabelText(/nombre completo/i), { target: { value: 'Usuario Sin Acceso' } });
    fireEvent.change(within(dialog).getByLabelText(/correo electr/i), { target: { value: 'sin-acceso@hospital.test' } });
    fireEvent.change(within(dialog).getByLabelText(/nombre de usuario/i), { target: { value: 'sin-acceso' } });
    fireEvent.change(within(dialog).getByLabelText(/contrase/i), { target: { value: 'Password123!' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /crear usuario/i }));

    await waitFor(() => {
      expect(within(dialog).getByText(/seleccione al menos un modulo/i)).toBeInTheDocument();
    });
    expect(onStatus).toHaveBeenCalledWith(expect.stringMatching(/seleccione al menos un modulo/i));
    expect(createUser).not.toHaveBeenCalled();
  });

  it('keeps exact-access empty users empty when opening the edit form', async () => {
    vi.mocked(apiClient.getUsers).mockResolvedValueOnce([inactiveExactAccessUser]);
    vi.mocked(apiClient.getRoles).mockResolvedValueOnce({
      roles: [
        {
          id: 2,
          name: 'cajero',
          protected: false,
          permissions: [{ name: 'cash.view', module: 'cash', label: 'Cash view' }],
        },
      ],
      permissionCatalog: [
        {
          module: 'cash',
          label: 'Caja',
          permissions: [{ name: 'cash.view', module: 'cash', label: 'Cash view' }],
        },
      ],
    });

    render(<UsersView onStatus={vi.fn()} canCreateUsers={false} canUpdateUsers canManageRoles={true} />);

    await openUserActions('Pendiente Modulos');
    fireEvent.click(await screen.findByRole('menuitem', { name: /^editar$/i }));
    const dialog = screen.getByRole('dialog', { name: /editar usuario/i });

    expect(within(dialog).getByRole('checkbox', { name: /Cash view/i })).not.toBeChecked();
  });

  it('lets an authorized administrator create a role with module permissions', async () => {
    const createRole = vi.spyOn(apiClient, 'createRole').mockResolvedValue({
      id: 5,
      name: 'report_viewer',
      protected: false,
      permissions: [{ name: 'reports.view', module: 'reports', label: 'Reports view' }],
    });

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canUpdateUsers canManageRoles={true} canAssignAdminRole />);

    fireEvent.click(await screen.findByRole('button', { name: /nuevo rol/i }));

    const dialog = await screen.findByRole('dialog', { name: /nuevo rol/i });
    fireEvent.change(within(dialog).getByLabelText(/nombre del rol/i), { target: { value: 'report_viewer' } });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Reports view/i }));
    fireEvent.click(within(dialog).getByRole('button', { name: /crear rol/i }));

    await waitFor(() => expect(createRole).toHaveBeenCalledWith({
      name: 'report_viewer',
      permissions: ['reports.view'],
    }));
  });

  it('prevents duplicated role submissions while the request is pending', async () => {
    let resolveRole!: (role: RoleDefinition) => void;
    const createRole = vi.spyOn(apiClient, 'createRole').mockReturnValue(new Promise<RoleDefinition>((resolve) => {
      resolveRole = resolve;
    }));

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canUpdateUsers canManageRoles={true} canAssignAdminRole />);

    fireEvent.click(await screen.findByRole('button', { name: /nuevo rol/i }));

    const dialog = await screen.findByRole('dialog', { name: /nuevo rol/i });
    fireEvent.change(within(dialog).getByLabelText(/nombre del rol/i), { target: { value: 'report_viewer' } });
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Reports view/i }));

    const submit = within(dialog).getByRole('button', { name: /crear rol/i });
    fireEvent.click(submit);
    fireEvent.click(submit);

    await waitFor(() => {
      expect(createRole).toHaveBeenCalledTimes(1);
    });

    resolveRole({
      id: 5,
      name: 'report_viewer',
      protected: false,
      permissions: [{ name: 'reports.view', module: 'reports', label: 'Reports view' }],
    });

    await waitFor(() => expect(screen.queryByRole('dialog', { name: /nuevo rol/i })).not.toBeInTheDocument());
  });

  it('lets an authorized administrator open the edit role dialog for a custom role', async () => {
    vi.spyOn(apiClient, 'updateRole').mockResolvedValue({
      id: 4,
      name: 'catalog_manager',
      protected: false,
      permissions: [
        { name: 'catalog.view', module: 'catalog', label: 'Catalog view' },
        { name: 'catalog.manage', module: 'catalog', label: 'Catalog manage' },
      ],
    });

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canDisableUsers canManageRoles={true} canAssignAdminRole />);

    await screen.findAllByText(/Catalog manager/i);
    fireEvent.click(screen.getByRole('button', { name: /editar permisos de catalog manager/i }));

    const dialog = await screen.findByRole('dialog', { name: /editar rol/i });
    expect(within(dialog).getByLabelText('Nombre del rol *')).toHaveValue('catalog_manager');
    expect(within(dialog).getByRole('checkbox', { name: /Catalog view/i })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: /Catalog manage/i })).toBeChecked();
  });

  it('shows the permission matrix only for operators allowed to assign admin role', async () => {
    render(<UsersView onStatus={vi.fn()} canCreateUsers={false} canUpdateUsers canManageRoles canAssignAdminRole />);

    expect(await screen.findByRole('heading', { name: /matriz de permisos/i })).toBeInTheDocument();

    cleanup();
    vi.mocked(apiClient.getUsers).mockResolvedValue([adminUser]);
    vi.mocked(apiClient.getRoles).mockResolvedValue(roleCatalog);

    render(<UsersView onStatus={vi.fn()} canCreateUsers={false} canUpdateUsers canManageRoles canAssignAdminRole={false} />);

    expect(await screen.findByText('Admin Hospital')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /matriz de permisos/i })).not.toBeInTheDocument();
  });

  it('prevents duplicated create user submissions while the request is pending', async () => {
    let resolveCreate!: (user: AuthUser) => void;
    const createUser = vi.spyOn(apiClient, 'createUser').mockReturnValue(new Promise<AuthUser>((resolve) => {
      resolveCreate = resolve;
    }));

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canManageRoles={false} />);

    fireEvent.click(await screen.findByRole('button', { name: /crear usuario/i }));
    const dialog = screen.getByRole('dialog', { name: /crear usuario/i });

    fireEvent.change(within(dialog).getByLabelText(/nombre completo/i), { target: { value: 'Caja Principal' } });
    fireEvent.change(within(dialog).getByLabelText(/correo electr/i), { target: { value: 'caja@hospital.test' } });
    fireEvent.change(within(dialog).getByLabelText(/nombre de usuario/i), { target: { value: 'caja' } });
    fireEvent.change(within(dialog).getByLabelText(/contrase/i), { target: { value: 'Password123!' } });

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

  it('validates reset passwords with the same policy as Laravel and requires an audit reason', async () => {
    const resetPassword = vi.spyOn(apiClient, 'resetUserPassword').mockResolvedValue({
      ...adminUser,
      must_change_password: true,
    });

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canUpdateUsers canManageRoles={true} canAssignAdminRole />);

    await openUserActions('Admin Hospital');
    fireEvent.click(await screen.findByRole('menuitem', { name: /restablecer clave/i }));
    const dialog = await screen.findByRole('dialog', { name: /restablecer clave para admin hospital/i });

    fireEvent.change(within(dialog).getByLabelText(/nueva contraseña temporal/i), { target: { value: 'abcdefghij' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /restablecer clave/i }));

    await waitFor(() => {
      expect(within(dialog).getByText(passwordPolicyMessage)).toBeInTheDocument();
    });
    expect(resetPassword).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/nueva contraseña temporal/i), { target: { value: 'Password123!' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /restablecer clave/i }));

    await waitFor(() => {
      expect(within(dialog).getByText(/motivo debe tener al menos 5 caracteres/i)).toBeInTheDocument();
    });
    expect(resetPassword).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/motivo/i), {
      target: { value: 'Solicitud del responsable de caja' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /restablecer clave/i }));

    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith(
      adminUser.id,
      'Password123!',
      'Solicitud del responsable de caja',
    ));
  });

  it('locks the temporary password and reason fields while resetting credentials', async () => {
    const resetPassword = vi.spyOn(apiClient, 'resetUserPassword').mockReturnValue(new Promise<AuthUser>(() => undefined));

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canUpdateUsers canManageRoles={true} canAssignAdminRole />);

    await openUserActions('Admin Hospital');
    fireEvent.click(await screen.findByRole('menuitem', { name: /restablecer clave/i }));
    const dialog = await screen.findByRole('dialog', { name: /restablecer clave para admin hospital/i });

    const passwordField = within(dialog).getByLabelText(/nueva contrase/i);
    fireEvent.change(passwordField, { target: { value: 'Password123!' } });
    fireEvent.change(within(dialog).getByLabelText(/motivo/i), {
      target: { value: 'Solicitud del responsable de caja' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /restablecer clave/i }));

    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith(
      adminUser.id,
      'Password123!',
      'Solicitud del responsable de caja',
    ));

    expect(within(dialog).getByLabelText(/nueva contrase/i)).toBeDisabled();
    expect(within(dialog).getByLabelText(/motivo/i)).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: /restableciendo/i })).toBeDisabled();
  });

  it('keeps the status confirmation locked while the request is pending', async () => {
    vi.mocked(apiClient.getUsers).mockResolvedValueOnce([
      adminUser,
      {
        ...adminUser,
        id: 2,
        name: 'Admin Respaldo',
        email: 'admin-respaldo@hospital.test',
        username: 'admin-respaldo',
      },
    ]);

    let resolveToggle!: (user: AuthUser) => void;
    const toggleUser = vi.spyOn(apiClient, 'toggleUserActive').mockReturnValue(new Promise<AuthUser>((resolve) => {
      resolveToggle = resolve;
    }));

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canDisableUsers canManageRoles={true} canAssignAdminRole />);

    await openUserActions('Admin Hospital');
    fireEvent.click(await screen.findByRole('menuitem', { name: /^desactivar$/i }));
    const dialog = await screen.findByRole('alertdialog', { name: /desactivar usuario/i });
    const confirm = within(dialog).getByRole('button', { name: /desactivar/i });

    fireEvent.change(within(dialog).getByLabelText(/motivo/i), {
      target: { value: 'Baja operativa temporal' },
    });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(toggleUser).toHaveBeenCalledTimes(1));
    expect(toggleUser).toHaveBeenCalledWith(adminUser.id, 'Baja operativa temporal');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /cambiando/i })).toBeDisabled());
    expect(within(dialog).getByRole('button', { name: /cancelar/i })).toBeDisabled();

    resolveToggle({
      ...adminUser,
      active: false,
    });

    await waitFor(() => expect(screen.queryByRole('alertdialog', { name: /desactivar usuario/i })).not.toBeInTheDocument());
  });

  it('requires an audit reason before deactivating a user', async () => {
    vi.mocked(apiClient.getUsers).mockResolvedValueOnce([
      adminUser,
      {
        ...adminUser,
        id: 2,
        name: 'Admin Respaldo',
        email: 'admin-respaldo@hospital.test',
        username: 'admin-respaldo',
      },
    ]);

    const toggleUser = vi.spyOn(apiClient, 'toggleUserActive').mockResolvedValue({
      ...adminUser,
      active: false,
    });

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canDisableUsers canManageRoles={true} canAssignAdminRole />);

    await openUserActions('Admin Hospital');
    fireEvent.click(await screen.findByRole('menuitem', { name: /^desactivar$/i }));
    const dialog = await screen.findByRole('alertdialog', { name: /desactivar usuario/i });
    const confirm = within(dialog).getByRole('button', { name: /desactivar/i });

    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText(/motivo/i), {
      target: { value: 'Baja de usuario operativo' },
    });
    fireEvent.click(confirm);

    await waitFor(() => expect(toggleUser).toHaveBeenCalledWith(adminUser.id, 'Baja de usuario operativo'));
  });
});
