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
    expect(screen.queryByRole('button', { name: /editar usuario admin hospital/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restablecer clave de admin hospital/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /desactivar usuario admin hospital/i })).not.toBeInTheDocument();
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
  });

  it('shows exact user actions only for matching permissions', async () => {
    render(<UsersView onStatus={vi.fn()} canCreateUsers={false} canUpdateUsers canManageRoles={false} />);

    expect(await screen.findByRole('button', { name: /editar usuario admin hospital/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /restablecer clave de admin hospital/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /desactivar usuario admin hospital/i })).not.toBeInTheDocument();

    cleanup();
    vi.mocked(apiClient.getUsers).mockResolvedValue([adminUser]);
    vi.mocked(apiClient.getRoles).mockResolvedValue(roleCatalog);

    render(<UsersView onStatus={vi.fn()} canCreateUsers={false} canDisableUsers canManageRoles={false} />);

    expect(await screen.findByRole('button', { name: /desactivar usuario admin hospital/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar usuario admin hospital/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restablecer clave de admin hospital/i })).not.toBeInTheDocument();
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

  it('loads operational roles from the API instead of hardcoding only default roles', async () => {
    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canManageRoles={false} />);

    fireEvent.click(await screen.findByRole('button', { name: /crear usuario/i }));
    const dialog = screen.getByRole('dialog', { name: /crear usuario/i });

    fireEvent.click(within(dialog).getByRole('combobox', { name: /rol operativo/i }));

    expect(await screen.findByRole('option', { name: /Auditor/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Catalog manager/i })).toBeInTheDocument();
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

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canUpdateUsers canManageRoles={true} />);

    fireEvent.click(await screen.findByRole('button', { name: /crear usuario/i }));
    const dialog = screen.getByRole('dialog', { name: /crear usuario/i });

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

    fireEvent.click(await screen.findByRole('button', { name: /editar usuario pendiente modulos/i }));
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

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canUpdateUsers canManageRoles={true} />);

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

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canUpdateUsers canManageRoles={true} />);

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

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canDisableUsers canManageRoles={true} />);

    await screen.findByText(/Catalog manager/i);
    fireEvent.click(screen.getByRole('button', { name: /editar permisos de catalog manager/i }));

    const dialog = await screen.findByRole('dialog', { name: /editar rol/i });
    expect(within(dialog).getByLabelText('Nombre del rol *')).toHaveValue('catalog_manager');
    expect(within(dialog).getByRole('checkbox', { name: /Catalog view/i })).toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: /Catalog manage/i })).toBeChecked();
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

  it('validates reset passwords with the same policy as Laravel', async () => {
    const resetPassword = vi.spyOn(apiClient, 'resetUserPassword').mockResolvedValue({
      ...adminUser,
      must_change_password: true,
    });

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canUpdateUsers canManageRoles={true} />);

    fireEvent.click(await screen.findByRole('button', { name: /restablecer clave de admin/i }));
    const dialog = await screen.findByRole('dialog', { name: /restablecer clave para admin hospital/i });

    fireEvent.change(within(dialog).getByLabelText(/nueva contraseña temporal/i), { target: { value: 'abcdefghij' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /restablecer clave/i }));

    await waitFor(() => {
      expect(within(dialog).getByText(passwordPolicyMessage)).toBeInTheDocument();
    });
    expect(resetPassword).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText(/nueva contraseña temporal/i), { target: { value: 'Password123!' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /restablecer clave/i }));

    await waitFor(() => expect(resetPassword).toHaveBeenCalledWith(adminUser.id, 'Password123!'));
  });

  it('keeps the status confirmation locked while the request is pending', async () => {
    let resolveToggle!: (user: AuthUser) => void;
    const toggleUser = vi.spyOn(apiClient, 'toggleUserActive').mockReturnValue(new Promise<AuthUser>((resolve) => {
      resolveToggle = resolve;
    }));

    render(<UsersView onStatus={vi.fn()} canCreateUsers={true} canDisableUsers canManageRoles={true} />);

    fireEvent.click(await screen.findByRole('button', { name: /desactivar usuario admin hospital/i }));
    const dialog = await screen.findByRole('alertdialog', { name: /desactivar usuario/i });
    const confirm = within(dialog).getByRole('button', { name: /desactivar/i });

    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => expect(toggleUser).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: /cambiando/i })).toBeDisabled());
    expect(within(dialog).getByRole('button', { name: /cancelar/i })).toBeDisabled();

    resolveToggle({
      ...adminUser,
      active: false,
    });

    await waitFor(() => expect(screen.queryByRole('alertdialog', { name: /desactivar usuario/i })).not.toBeInTheDocument());
  });
});
