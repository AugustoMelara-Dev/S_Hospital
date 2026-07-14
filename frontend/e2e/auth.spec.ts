import { expect, test, type Page, type Route } from '@playwright/test';
import { assertStrictMockGuard, installStrictMockGuard } from './fixtures/strict-mock-guard';

test.beforeEach(async ({ page }) => installStrictMockGuard(page));
test.afterEach(async ({ page }) => assertStrictMockGuard(page));

type TestUser = {
  id: number;
  name: string;
  email: string;
  username: string;
  active: boolean;
  roles: string[];
  permissions: string[];
  must_change_password: boolean;
};

const forcedPasswordUser: TestUser = {
  id: 77,
  name: 'Caja Cambio Obligatorio',
  email: 'cambio@hospital.local',
  username: 'cambio.obligatorio',
  active: true,
  roles: ['cajero'],
  permissions: ['catalog.view'],
  must_change_password: true,
};

const catalogOnlyUser: TestUser = {
  ...forcedPasswordUser,
  must_change_password: false,
};

test.describe('Auth - critical mocked e2e', () => {
  test('guest sees only the local login experience', async ({ page }) => {
    await installAuthMocks(page, { sessionUser: null });

    await page.goto('/');

    await expect(page).toHaveURL(/\/(?:login)?$/);
    await expect(page.getByRole('heading', { level: 1, name: /hospital san isidro/i })).toBeVisible();
    await expect(page.locator('#login-input')).toBeVisible();
    await expect(page.locator('#password-input')).toBeVisible();
    await expect(page.getByRole('button', { name: /iniciar sesi.n|entrar/i })).toHaveCount(1);
    await expect(page.getByRole('link', { name: /nueva factura|reportes|usuarios|respaldos/i })).toHaveCount(0);
  });

  test('required password change blocks operations until completed', async ({ page }) => {
    let loginCalls = 0;
    let changePasswordCalls = 0;

    await installAuthMocks(page, {
      sessionUser: null,
      onLogin: () => {
        loginCalls += 1;
        return forcedPasswordUser;
      },
      onChangePassword: () => {
        changePasswordCalls += 1;
        return catalogOnlyUser;
      },
    });

    await page.goto('/login');
    await page.locator('#login-input').fill('cambio.obligatorio');
    await page.locator('#password-input').fill('Temporal123!');
    await page.getByRole('button', { name: /iniciar sesi.n|entrar/i }).click();

    await expect(page.getByRole('heading', { name: /cambio obligatorio de contrase/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /catalogo|cat.logo/i })).toHaveCount(0);

    await page.getByLabel(/contrase.a actual/i).fill('Temporal123!');
    await page.getByLabel(/^nueva contrase.a/i).fill('NuevaClave123!');
    await page.getByLabel(/confirmar nueva contrase.a/i).fill('NuevaClave123!');
    await page.getByRole('button', { name: /actualizar contrase/i }).click();

    await expect(page.getByRole('link', { name: /cat.logo/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /reportes|usuarios|respaldos/i })).toHaveCount(0);
    expect(loginCalls).toBe(1);
    expect(changePasswordCalls).toBe(1);
  });

  test('catalog-only user is blocked from restricted routes', async ({ page }) => {
    await installAuthMocks(page, { sessionUser: catalogOnlyUser });

    await page.goto('/reports');

    await expect(page.getByRole('heading', { name: /sin permisos/i })).toBeVisible();
    await expect(page.getByText(/requiere permiso para consultar reportes/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /cat.logo/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /usuarios|respaldos|configuraci.n/i })).toHaveCount(0);
  });
});

async function installAuthMocks(
  page: Page,
  options: {
    sessionUser: TestUser | null;
    onLogin?: () => TestUser;
    onChangePassword?: () => TestUser;
  },
) {
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
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
  await page.route('**/api/settings/logo', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: '' }));
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
  await page.route('**/api/auth/session', (route) => json(route, { data: options.sessionUser }));
  await page.route('**/api/auth/login', (route) => json(route, { data: options.onLogin?.() ?? catalogOnlyUser }));
  await page.route('**/api/auth/change-password', (route) => json(route, {
    data: options.onChangePassword?.() ?? catalogOnlyUser,
  }));
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
