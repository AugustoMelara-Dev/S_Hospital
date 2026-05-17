import { expect, test } from '@playwright/test';

const baseUrl = process.env.E2E_REAL_BASE_URL;
const login = process.env.E2E_REAL_LOGIN;
const password = process.env.E2E_REAL_PASSWORD;
const realBaseUrl = baseUrl?.replace(/\/$/, '');
const hasRealSmokeConfig = Boolean(baseUrl && login && password);

test.skip(!hasRealSmokeConfig, 'Real LAN smoke requires E2E_REAL_BASE_URL, E2E_REAL_LOGIN and E2E_REAL_PASSWORD.');

test('real hospital workflow surfaces load without console errors', async ({ page }) => {
  const consoleIssues: string[] = [];

  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    consoleIssues.push(`requestfailed: ${request.method()} ${request.url()} ${failure?.errorText ?? ''}`.trim());
  });

  await expect((await page.request.get(`${realBaseUrl}/up`)).ok()).toBe(true);
  await expect((await page.request.get(`${realBaseUrl}/verify-email`)).ok()).toBe(true);

  await page.goto(`${realBaseUrl}/login`);
  await page.getByLabel(/usuario|email/i).fill(login ?? '');
  await page.getByLabel(/contrasena|contraseña/i).fill(password ?? '');
  await page.getByRole('button', { name: /entrar|iniciar/i }).click();

  await expect(page.getByRole('heading', { name: /dashboard|caja|reportes/i })).toBeVisible();

  const links = [
    /dashboard/i,
    /nueva factura/i,
    /caja/i,
    /catalogo|catálogo/i,
    /historial/i,
    /reportes/i,
    /backups/i,
  ];

  for (const linkName of links) {
    const link = page.getByRole('link', { name: linkName }).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      await page.waitForLoadState('networkidle');
    }
  }

  await expect.poll(() => consoleIssues, {
    message: consoleIssues.join('\n') || 'No console issues captured.',
  }).toHaveLength(0);
});
