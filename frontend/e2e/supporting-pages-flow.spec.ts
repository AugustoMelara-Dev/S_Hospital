import { expect, test, type Page, type Route } from '@playwright/test';
import { assertStrictMockGuard, installStrictMockGuard } from './fixtures/strict-mock-guard';

test.beforeEach(async ({ page }) => installStrictMockGuard(page));
test.afterEach(async ({ page }) => assertStrictMockGuard(page));

const operatorUser = {
  id: 27,
  name: 'Operador de turno',
  email: 'operador@hospital.local',
  username: 'operador.turno',
  active: true,
  roles: ['cajero'],
  permissions: ['cash.view'],
  must_change_password: false,
};

test.describe('Ayuda, soporte y acerca de - mocked e2e', () => {
  test('keeps operational guidance and safe diagnostics available without secrets', async ({ page }) => {
    await installSupportingPagesMocks(page);
    const consoleErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/help');
    await expect(page.getByRole('heading', { level: 1, name: /ayuda institucional/i })).toBeVisible();
    await page.getByRole('searchbox', { name: /qué necesita hacer/i }).fill('cobrar');
    await expect(page.getByRole('heading', { name: /^cobrar$/i })).toBeVisible();
    await expect(page.getByText(/guía relacionada/i)).toBeVisible();

    await page.goto('/support');
    await expect(page.getByRole('heading', { level: 1, name: /asistencia operativa/i })).toBeVisible();
    await expect(page.getByText('Todo bien').first()).toBeVisible();
    await expect(page.getByText(/diagnostico tecnico detallado se mantiene reservado/i)).toBeVisible();

    await page.goto('/about');
    await expect(page.getByRole('heading', { level: 1, name: /informacion del sistema/i })).toBeVisible();
    await expect(page.getByText('Hospital San Isidro').first()).toBeVisible();
    await expect(page.getByText(/sistema disponible en la red del hospital/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /diagnostico administrativo/i })).toHaveCount(0);
    await expect(page.getByText(/DB_PASSWORD|APP_KEY|\.env|queue:work/i)).toHaveCount(0);
    expect(consoleErrors).toEqual([]);
  });
});

async function installSupportingPagesMocks(page: Page) {
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/auth/session', (route) => json(route, { data: operatorUser }));
  await page.route('**/api/settings/branding', (route) => json(route, {
    data: {
      hospital_name: 'Hospital San Isidro',
      primary_color: 'teal',
      slogan: 'Sistema hospitalario local',
      government_line: null,
      secretariat_line: null,
      receipt_location: 'Tocoa',
    },
  }));
  await page.route('**/api/settings/logo', (route) => route.fulfill({
    status: 200,
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1" />',
  }));
  await page.route('**/api/system/health', (route) => json(route, { ok: true }));
  await page.route('**/api/cash-sessions/current', (route) => json(route, { data: null }));
  await page.route('**/api/system/echo-config', (route) => json(route, {
    data: { enabled: false, broadcaster: 'log', key: null, ws_host: null, ws_port: null, force_tls: false },
  }));
  await page.route('**/api/system/status-summary', (route) => json(route, {
    data: {
      summary: {
        severity: 'ok',
        problem_count: 0,
        label: 'Todo bien',
        action: 'Servidor local disponible para operar.',
      },
      checks: [
        { code: 'backend', label: 'Servidor local', status: 'validated', detail: 'Servidor local disponible.' },
        { code: 'lan', label: 'Red local', status: 'validated', detail: 'Acceso LAN disponible.' },
      ],
      advanced_available: true,
    },
  }));
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
