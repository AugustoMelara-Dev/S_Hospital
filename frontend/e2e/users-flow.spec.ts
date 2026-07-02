import { expect, test, type Page, type Route } from '@playwright/test';

const usersAdmin = {
  id: 51,
  name: 'Admin Hospital',
  email: 'admin@hospital.local',
  username: 'admin',
  active: true,
  roles: ['admin'],
  permissions: [
    'users.view',
    'users.create',
    'users.update',
    'users.disable',
    'users.assign_admin_role',
  ],
  direct_permissions: [],
  must_change_password: false,
};

const cashierUser = {
  id: 52,
  name: 'Caja Principal',
  email: 'caja@hospital.local',
  username: 'caja',
  active: true,
  roles: ['cajero'],
  permissions: ['cash.view'],
  direct_permissions: ['cash.view'],
  must_change_password: true,
};

const roleCatalog = {
  roles: [
    { id: 1, name: 'admin', protected: true, permissions: [] },
    {
      id: 2,
      name: 'cajero',
      protected: false,
      permissions: [{ name: 'cash.view', module: 'cash', label: 'Cash view' }],
    },
    {
      id: 3,
      name: 'auditor',
      protected: false,
      permissions: [{ name: 'reports.view', module: 'reports', label: 'Reports view' }],
    },
  ],
  permission_catalog: [
    {
      module: 'cash',
      label: 'Caja',
      permissions: [{ name: 'cash.view', module: 'cash', label: 'Cash view' }],
    },
    {
      module: 'reports',
      label: 'Reportes',
      permissions: [{ name: 'reports.view', module: 'reports', label: 'Reports view' }],
    },
  ],
};

test.describe('Users - critical mocked e2e', () => {
  test('administrator manages users through role catalog and guarded disable flow', async ({ page }) => {
    let createPayload: Record<string, unknown> | null = null;
    let toggleCalls = 0;
    await installUsersMocks(page, {
      onCreateUser: (payload) => {
        createPayload = payload;
      },
      onToggleUser: () => {
        toggleCalls += 1;
      },
    });

    await page.goto('/admin/users');

    await expect(page.getByRole('heading', { name: /usuarios y permisos/i })).toBeVisible();
    await expect(page.getByText(/rbac activo/i)).toBeVisible();
    await expect(page.getByText(/roles y modulos/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /crear usuario/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /editar permisos de admin/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /editar permisos de cajero/i })).toBeEnabled();

    await page.getByRole('button', { name: /crear usuario/i }).click();
    const dialog = page.getByRole('dialog', { name: /crear usuario/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('checkbox', { name: /reports view/i })).toBeVisible();
    await expect(dialog.getByText(/users.assign_admin_role|sqlstate|\.env/i)).toHaveCount(0);

    await dialog.getByLabel(/nombre completo/i).fill('Reportes Turno');
    await dialog.getByLabel(/correo electr.nico/i).fill('reportes@hospital.local');
    await dialog.getByLabel(/nombre de usuario/i).fill('reportes-turno');
    await dialog.getByLabel(/contrase.a inicial/i).fill('Password123!');
    await dialog.getByRole('checkbox', { name: /reports view/i }).check();
    await dialog.getByRole('button', { name: /crear usuario/i }).click();

    await expect.poll(() => createPayload).not.toBeNull();
    expect(createPayload).toMatchObject({
      name: 'Reportes Turno',
      email: 'reportes@hospital.local',
      username: 'reportes-turno',
      role: 'cajero',
      permissions: ['cash.view', 'reports.view'],
    });

    await page.getByLabel(/buscar usuarios/i).fill('caja');
    await expect(page.getByRole('row', { name: /caja principal/i })).toBeVisible();
    await expect(page.getByRole('row', { name: /admin hospital/i })).toHaveCount(0);

    await page.getByRole('button', { name: /desactivar usuario caja principal/i }).click();
    await expect.poll(() => toggleCalls).toBe(0);
    await expect(page.getByRole('alertdialog', { name: /desactivar usuario/i })).toBeVisible();
    await expect(page.getByText(/no podr. iniciar sesi.n ni operar en el sistema/i)).toBeVisible();
    await page.getByRole('button', { name: /^desactivar$/i }).click();

    await expect.poll(() => toggleCalls).toBe(1);
    await expect(page.getByRole('alertdialog', { name: /desactivar usuario/i })).toHaveCount(0);
  });
});

async function installUsersMocks(
  page: Page,
  options: {
    onCreateUser?: (payload: Record<string, unknown>) => void;
    onToggleUser?: () => void;
  } = {},
) {
  const users = [usersAdmin, cashierUser];

  await installCommonMocks(page, usersAdmin);
  await page.route(/\/api\/admin\/users(?:\?.*)?$/, async (route) => {
    const request = route.request();

    if (request.method() === 'POST') {
      const payload = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>;
      options.onCreateUser?.(payload);
      users.push({
        ...usersAdmin,
        id: 60,
        name: String(payload.name),
        email: String(payload.email),
        username: String(payload.username),
        roles: [String(payload.role)],
        permissions: Array.isArray(payload.permissions) ? payload.permissions.map(String) : [],
        direct_permissions: Array.isArray(payload.permissions) ? payload.permissions.map(String) : [],
        must_change_password: true,
      });
      return json(route, { data: users.at(-1) }, 201);
    }

    return json(route, { data: users });
  });
  await page.route(/\/api\/admin\/users\/\d+\/toggle-active(?:[/?]|$)/, (route) => {
    options.onToggleUser?.();
    return json(route, { data: { ...cashierUser, active: false } });
  });
  await page.route(/\/api\/admin\/users\/\d+(?:\?.*)?$/, (route) => json(route, { data: cashierUser }));
  await page.route(/\/api\/admin\/roles(?:\?.*)?$/, (route) => json(route, { data: roleCatalog.roles, permission_catalog: roleCatalog.permission_catalog }));
}

async function installCommonMocks(page: Page, sessionUser: typeof usersAdmin) {
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/auth/session', (route) => json(route, { data: sessionUser }));
  await page.route('**/api/settings/branding', (route) => json(route, {
    data: {
      hospital_name: 'Hospital San Isidro',
      primary_color: 'indigo',
      slogan: 'Sistema LAN',
      government_line: null,
      secretariat_line: null,
      receipt_location: 'Tocoa',
    },
  }));
  await page.route('**/api/settings/logo', (route) => route.fulfill({ status: 404, body: '' }));
  await page.route('**/api/system/health', (route) => json(route, { ok: true }));
  await page.route('**/api/system/echo-config', (route) => json(route, {
    data: {
      enabled: false,
      broadcaster: 'log',
      key: null,
      ws_host: null,
      ws_port: null,
      force_tls: false,
    },
  }));
  await page.route('**/api/system/status-summary', (route) => json(route, {
    data: {
      app: { env: 'local', debug: false },
      database: { connected: true },
      queue: { failed_jobs_count: 0 },
      backups: { last_success_at: null },
    },
  }));
  await page.route(/\/api\/cash-sessions\/current(?:[/?]|$)/, (route) => json(route, { data: null }));
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
