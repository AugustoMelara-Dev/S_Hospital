import path from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';
import { assertStrictMockGuard, installStrictMockGuard } from './fixtures/strict-mock-guard';

test.beforeEach(async ({ page }) => installStrictMockGuard(page));
test.afterEach(async ({ page }) => assertStrictMockGuard(page));

const settingsAdminUser = {
  id: 21,
  name: 'Fiscal Administradora',
  email: 'fiscal@hospital.local',
  username: 'fiscal.admin',
  active: true,
  roles: ['admin'],
  permissions: [
    'settings.fiscal.view',
    'settings.fiscal.update',
    'settings.operational.view',
    'settings.operational.update',
    'receipt_settings.view',
  ],
  must_change_password: false,
};

const fiscalSettings = {
  id: 1,
  hospital_name: 'Hospital San Isidro',
  rtn: '08011999000001',
  default_tax_rate: '15.00',
  primary_color: 'teal',
  address: 'Tocoa, Colon',
  slogan: 'Sistema LAN',
  scanner_enabled: true,
  partial_payments_enabled: false,
  receipt_template_mode: 'institutional',
  receipt_paper_size: 'half_letter',
  government_line: 'Gobierno de Honduras',
  secretariat_line: 'Secretaria de Salud Publica',
  receipt_location: 'Tocoa, Colon',
  receipt_footer_text: '',
};

test.describe('Settings - critical mocked e2e', () => {
  test('fiscal settings keep fiscal domains separated from receipt print setup', async ({ page }) => {
    await installSettingsMocks(page);

    await page.goto('/settings/fiscal');

    await expect(page.getByRole('heading', { level: 1, name: /^configuraci.n$/i })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('tab', { name: /^resumen$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^hospital$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^numeraci.n$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^operativa$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^marca$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^recibos$/i })).toHaveCount(0);

    const receiptsLink = page.getByRole('link', { name: /administrar recibos/i });
    await expect(receiptsLink).toBeVisible();
    await expect(receiptsLink).toHaveAttribute('href', '/settings/institutional-receipts');
    const summary = page.getByRole('region', { name: /resumen fiscal/i });
    await expect(summary.getByTestId('fiscal-summary-field')).toHaveCount(6);
    await expect(summary.locator('[data-slot="card"] [data-slot="card"]')).toHaveCount(0);
    await expect(page.getByText(/prueba de impresi.n|pdf de prueba|perfil de impresi.n|serie de recibo/i)).toHaveCount(0);
    await expect(page.getByLabel(/papel del recibo|tipo de papel|margen|escala|fuente|ancho|alto/i)).toHaveCount(0);

    await waitForStablePaint(page);
    await page.screenshot({
      path: path.resolve(process.cwd(), '../qa/operational-ux/after/settings-summary-1366.png'),
      fullPage: true,
    });

    await page.getByRole('tab', { name: /^hospital$/i }).click();
    const saveHospital = page.getByRole('button', { name: /guardar datos del hospital/i });
    await expect(saveHospital).toHaveCount(0);
    await page.getByLabel(/nombre del hospital/i).fill('Hospital San Isidro Regional');
    await expect(saveHospital).toBeVisible();
    await expect(page.getByText(/hay cambios sin guardar/i)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('tab', { name: /^hospital$/i })).toBeVisible();
    await expect(saveHospital).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const [saveBox, mobileNavBox] = await Promise.all([
      saveHospital.boundingBox(),
      page.getByRole('navigation', { name: /accesos m.viles/i }).boundingBox(),
    ]);
    expect(saveBox).not.toBeNull();
    expect(mobileNavBox).not.toBeNull();
    expect((saveBox?.y ?? 0) + (saveBox?.height ?? 0)).toBeLessThanOrEqual(mobileNavBox?.y ?? 0);
    await waitForStablePaint(page);
    await page.screenshot({
      path: path.resolve(process.cwd(), '../qa/operational-ux/after/settings-hospital-dirty-390.png'),
    });
  });
});

async function installSettingsMocks(page: Page) {
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/auth/session', (route) => json(route, { data: settingsAdminUser }));
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
  await page.route('**/api/settings/logo', (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'image/png', body: '' });
    }

    return json(route, { message: 'ok', logo_url: '/api/settings/logo/file?t=1' });
  });
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
  await page.route('**/api/settings/fiscal', (route) => {
    if (route.request().method() === 'PUT') {
      return json(route, { data: fiscalSettings });
    }

    return json(route, { data: fiscalSettings });
  });
  await page.route('**/api/settings/operational', (route) => json(route, {
    data: {
      scanner_enabled: fiscalSettings.scanner_enabled,
      partial_payments_enabled: fiscalSettings.partial_payments_enabled,
      default_tax_rate: fiscalSettings.default_tax_rate,
    },
  }));
  await page.route('**/api/fiscal-sequences**', (route) => json(route, { data: [] }));
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function waitForStablePaint(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}
