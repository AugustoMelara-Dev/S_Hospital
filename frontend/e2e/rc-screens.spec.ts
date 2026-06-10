import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const adminUser = {
  id: 1,
  name: 'Administrador Validacion',
  email: 'admin.validacion@hospital-san-isidro.local',
  username: 'admin.validacion',
  active: true,
  roles: ['admin'],
  permissions: [
    'settings.fiscal.view',
    'settings.fiscal.update',
    'backups.view',
    'backups.create',
    'backups.download',
  ],
  must_change_password: false,
};

const captureDirName = 'rc-screens-2026-06-09';
const captureOutputDir = process.env.E2E_CAPTURE_SCREENS_DIR ?? path.join('C:\\Users\\melar\\AppData\\Local\\Temp\\opencode\\e2e-screens-extra', captureDirName);

async function captureScreen(page: Page, name: string) {
  const file = path.join(captureOutputDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
}

test.describe('RC1 critical screens (mocked)', () => {
  test('login screen renders unauthenticated', async ({ page }) => {
    await page.route('**/sanctum/csrf-cookie', async (route) => {
      await route.fulfill({ status: 204, body: '' });
    });
    await page.goto('/login');
    await expect(page.getByLabel(/usuario|email/i).first()).toBeVisible();
    await expect(page.getByLabel(/contrase/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /entrar|iniciar/i })).toBeVisible();
    await captureScreen(page, 'login-light');
  });

  test('login screen dark theme', async ({ page }) => {
    await page.route('**/sanctum/csrf-cookie', async (route) => {
      await route.fulfill({ status: 204, body: '' });
    });
    await page.goto('/login');
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    await expect(page.getByLabel(/usuario|email/i).first()).toBeVisible();
    await captureScreen(page, 'login-dark');
  });

  test('settings fiscal screen (admin)', async ({ page }) => {
    await page.route('**/sanctum/csrf-cookie', async (route) => {
      await route.fulfill({ status: 204, body: '' });
    });
    await page.route('**/api/public/branding', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { hospital_name: 'Hospital San Isidro', logo_url: null },
        }),
      });
    });
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { token: 'mock-token', user: adminUser } }),
      });
    });
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthenticated.' }),
      });
    });
    await page.route('**/api/fiscal-settings**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            hospital_name: 'Hospital San Isidro',
            rtn: '08019999123456',
            address: 'Barrio El Centro, Tegucigalpa',
            phone: '+504 2222-3333',
            receipt_header: 'HOSPITAL SAN ISIDRO',
            receipt_footer: 'Gracias por su pago',
            paper_size: 'letter',
            printer_profile: 'thermal_80mm',
            logo_url: null,
          },
        }),
      });
    });

    await page.goto('/login');
    await page.waitForSelector('#login-input', { timeout: 15_000 });
    await page.locator('#login-input').fill('admin.validacion');
    await page.locator('#password-input').fill('Password123!');
    await Promise.all([
      page.waitForResponse('**/api/auth/login'),
      page.getByRole('button', { name: /iniciar|entrar/i }).click(),
    ]);
    await page.goto('/settings/fiscal');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await captureScreen(page, 'settings-fiscal-light');
  });

  test('backups screen (admin)', async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch (e) { void e; }
    });
    await page.route('**/sanctum/csrf-cookie', async (route) => {
      await route.fulfill({ status: 204, body: '' });
    });
    await page.route('**/api/public/branding', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: { hospital_name: 'Hospital San Isidro', logo_url: null },
        }),
      });
    });
    await page.route('**/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: { token: 'mock-token', user: adminUser } }),
      });
    });
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Unauthenticated.' }),
      });
    });
    await page.route('**/api/backups**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            backups: [
              {
                id: 1,
                filename: 'hospital-2026-06-08-2300.sql.gz',
                created_at: '2026-06-08T23:00:00-06:00',
                size_bytes: 1_048_576,
                status: 'success',
                initiated_by: 'scheduler',
              },
              {
                id: 2,
                filename: 'hospital-2026-06-09-1100.sql.gz',
                created_at: '2026-06-09T11:00:00-06:00',
                size_bytes: 1_572_864,
                status: 'pending',
                initiated_by: 'admin.validacion',
              },
            ],
            worker_command: 'php artisan queue:work --queue=backups --tries=1 --timeout=600',
            counts: { success: 1, pending: 1, failed: 0 },
          },
        }),
      });
    });

    await page.goto('/login');
    await page.waitForSelector('#login-input', { timeout: 30_000 });
    await page.locator('#login-input').fill('admin.validacion');
    await page.locator('#password-input').fill('Password123!');
    await Promise.all([
      page.waitForResponse('**/api/auth/login'),
      page.getByRole('button', { name: /iniciar|entrar/i }).click(),
    ]);
    await page.goto('/backups');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await captureScreen(page, 'backups-light');
  });
});
