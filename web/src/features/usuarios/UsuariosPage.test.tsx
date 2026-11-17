import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RequireAuth } from '@/auth/guards';
import { makeMe, mockApi } from '@/test/mockApi';
import { renderWithProviders } from '@/test/render';
import UsuariosPage from './UsuariosPage';

const roles = {
  items: [
    { id: 1, code: 'admin', name: 'Administración', is_system: true, permissions: [], users_count: 1 },
    { id: 2, code: 'cajero', name: 'Caja', is_system: true, permissions: ['catalog.view', 'invoices.view'], users_count: 3 },
  ],
  permission_catalog: [
    {
      module: 'catalog',
      label: 'Catálogo y precios',
      permissions: [
        { code: 'catalog.view', label: 'Ver catálogo' },
        { code: 'catalog.manage', label: 'Administrar catálogo, precios e impuestos' },
      ],
    },
    { module: 'invoices', label: 'Facturas', permissions: [{ code: 'invoices.view', label: 'Ver facturas' }] },
  ],
};

const users = [
  {
    id: 1,
    name: 'Ana Martínez',
    username: 'amartinez',
    email: null,
    role_id: 1,
    role: { id: 1, code: 'admin', name: 'Administración' },
    active: true,
    must_change_password: false,
    last_login_at: null,
    created_at: '2026-11-01T08:00:00-06:00',
  },
];

function setup(extra: Record<string, unknown> = {}) {
  return mockApi({
    'GET /auth/me': makeMe(),
    'GET /users': { items: users, page: 1, per_page: 200, total: 1 },
    'GET /roles': roles,
    ...extra,
  });
}

const renderPage = () =>
  renderWithProviders(
    <RequireAuth>
      <UsuariosPage />
    </RequireAuth>,
    { path: '/admin/usuarios' },
  );

describe('UsuariosPage', () => {
  it('shows a live password checklist when creating a user', async () => {
    const user = userEvent.setup();
    setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Crear usuario' }));
    const drawer = await screen.findByRole('dialog', { name: 'Crear usuario' });
    const item = (label: string) => within(drawer).getByText(label).closest('li');

    const pw = within(drawer).getByLabelText(/Contraseña inicial/);
    await user.type(pw, 'abc');
    expect(item('Una letra minúscula')).toHaveAttribute('data-ok', 'true');
    expect(item('Al menos 12 caracteres')).toHaveAttribute('data-ok', 'false');
    expect(item('Un símbolo')).toHaveAttribute('data-ok', 'false');

    await user.type(pw, 'DEF12345!x');
    for (const label of ['Al menos 12 caracteres', 'Una letra minúscula', 'Una letra mayúscula', 'Un número', 'Un símbolo']) {
      expect(item(label)).toHaveAttribute('data-ok', 'true');
    }
  });

  it('prevents self deactivation in the UI', async () => {
    setup();
    renderPage();
    expect(await screen.findByRole('button', { name: 'No puede desactivar su propia cuenta' })).toBeDisabled();
  });

  it('role editor selects and clears a whole module', async () => {
    const user = userEvent.setup();
    const api = setup({ 'PATCH /roles/:id': ({ body }: { body: object }) => ({ ...roles.items[1], ...body }) });
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Roles' }));
    await user.click(await screen.findByText('Caja'));
    const drawer = await screen.findByRole('dialog', { name: 'Editar rol' });

    const moduleBox = within(drawer).getByRole('checkbox', { name: 'Seleccionar todo: Catálogo y precios' });
    expect((moduleBox as HTMLInputElement).indeterminate).toBe(true);
    await user.click(moduleBox);
    expect(within(drawer).getByRole('checkbox', { name: /Administrar catálogo/ })).toBeChecked();

    await user.click(within(drawer).getByRole('button', { name: 'Guardar rol' }));
    await waitFor(() => expect(api.calls('PATCH /roles/:id')).toHaveLength(1));
    const sent = api.calls('PATCH /roles/:id')[0]?.body as { permissions: string[] };
    expect([...sent.permissions].sort()).toEqual(['catalog.manage', 'catalog.view', 'invoices.view']);
  });

  it('admin role is read-only', async () => {
    const user = userEvent.setup();
    setup();
    renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Roles' }));
    await user.click(await screen.findByText('Administración', { selector: 'span' }));
    const drawer = await screen.findByRole('dialog', { name: 'Administración' });
    expect(within(drawer).getByRole('checkbox', { name: 'Seleccionar todo: Catálogo y precios' })).toBeDisabled();
    expect(within(drawer).queryByRole('button', { name: 'Guardar rol' })).not.toBeInTheDocument();
  });
});
