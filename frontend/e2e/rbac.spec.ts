import { expect, test, type Page, type Route } from '@playwright/test';

const catalogOnlyUser = {
  id: 88,
  name: 'Catalogo Solo Lectura',
  email: 'catalogo@hospital.local',
  username: 'catalogo.solo',
  active: true,
  roles: ['catalogo'],
  permissions: ['catalog.view'],
  must_change_password: false,
};

test.describe('RBAC - critical mocked e2e', () => {
  test.beforeEach(async ({ page }) => {
    await installSessionMocks(page);
  });

  test('catalog-only user cannot open user administration', async ({ page }) => {
    await page.goto('/admin/users');

    await expect(page.getByRole('heading', { name: /sin permisos/i })).toBeVisible();
    await expect(page.getByText(/requiere permiso para gestionar usuarios/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /usuarios/i })).toHaveCount(0);
  });

  test('catalog-only user cannot open cashier billing workflow', async ({ page }) => {
    await page.goto('/billing/new');

    await expect(page.getByRole('heading', { name: /sin permisos/i })).toBeVisible();
    await expect(page.getByText(/requiere permisos de facturaci/i)).toBeVisible();
    await expect(page.getByLabel(/nombre del paciente/i)).toHaveCount(0);
  });

  test('catalog-only user cannot open institutional receipt settings', async ({ page }) => {
    await page.goto('/settings/institutional-receipts');

    await expect(page.getByRole('heading', { name: /sin permisos/i })).toBeVisible();
    await expect(page.getByText(/requiere permiso para consultar configuracion de recibos/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /recibos/i })).toHaveCount(0);
  });
});

async function installSessionMocks(page: Page) {
  await page.route('**/api/auth/session', (route) => json(route, { data: catalogOnlyUser }));
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
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
