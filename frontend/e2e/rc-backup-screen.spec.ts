import { test } from '@playwright/test';
import path from 'node:path';

const captureOutputDir = 'C:/Users/melar/AppData/Local/Temp/opencode/e2e-screens-backup';

test('backups screen (admin) via direct mock', async ({ page, context }) => {
  await context.clearCookies();

  await page.route('**/sanctum/csrf-cookie', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });
  await page.route('**/api/public/branding', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { hospital_name: 'Hospital San Isidro', logo_url: null } }),
    });
  });
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ status: 401, body: '{"message":"Unauthenticated."}' });
  });
  await page.route('**/api/cash-sessions/current', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: null }),
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
          paper_size: 'letter',
          printer_profile: 'thermal_80mm',
          logo_url: null,
        },
      }),
    });
  });

  await page.goto('http://127.0.0.1:5173/');
  await page.waitForSelector('#login-input', { timeout: 30000 });
  await page.locator('#login-input').fill('admin');
  await page.locator('#password-input').fill('Password123!');
  await page.getByRole('button', { name: /iniciar|entrar/i }).click();
  await page.waitForLoadState('networkidle');

  await page.route('**/api/backups**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          backups: [
            { id: 1, filename: 'hospital-2026-06-08-2300.sql.gz', created_at: '2026-06-08T23:00:00-06:00', size_bytes: 1048576, status: 'success', initiated_by: 'scheduler' },
            { id: 2, filename: 'hospital-2026-06-09-1100.sql.gz', created_at: '2026-06-09T11:00:00-06:00', size_bytes: 1572864, status: 'pending', initiated_by: 'admin' },
          ],
          worker_command: 'php artisan queue:work --queue=backups',
          counts: { success: 1, pending: 1, failed: 0 },
        },
      }),
    });
  });

  await page.goto('http://127.0.0.1:5173/backups');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(captureOutputDir, 'backups-light.png'), fullPage: true });
});
