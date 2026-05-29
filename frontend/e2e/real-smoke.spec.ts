import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const baseUrl = process.env.E2E_REAL_BASE_URL;
const login = process.env.E2E_REAL_LOGIN;
const password = process.env.E2E_REAL_PASSWORD;
const realBaseUrl = baseUrl?.replace(/\/$/, '');
const allowMutations = process.env.E2E_REAL_ALLOW_MUTATIONS === '1';
const serviceQuery = process.env.E2E_REAL_SERVICE_QUERY ?? 'Glucosa';
const reportPath = resolve(process.env.E2E_REAL_REPORT_PATH ?? '../qa/screenshots/real-smoke/real-smoke-report.json');
const smokeResults: Array<Record<string, unknown>> = [];

test.beforeAll(() => {
  const missing = [
    ['E2E_REAL_BASE_URL', baseUrl],
    ['E2E_REAL_LOGIN', login],
    ['E2E_REAL_PASSWORD', password],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Real smoke requires ${missing.join(', ')}.`);
  }
});

test.afterAll(() => {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    base_url: realBaseUrl,
    allow_mutations: allowMutations,
    results: smokeResults,
  }, null, 2));
});

test('real hospital workflow surfaces load without console errors', async ({ page }) => {
  const consoleIssues: string[] = [];
  const routeChecks: Record<string, number> = {};

  captureConsoleIssues(page, consoleIssues);

  for (const path of ['/up', '/login', '/verify-email']) {
    const response = await page.request.get(`${realBaseUrl}${path}`);
    routeChecks[path] = response.status();
    await expect(response.ok()).toBe(true);
  }
  await expectFirstAssetLoadsAsJavaScript(page);

  await loginToRealApp(page);

  const links = [
    /dashboard/i,
    /nueva factura/i,
    /caja/i,
    /catalogo|catalogo/i,
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

  smokeResults.push({
    name: 'real hospital workflow surfaces load without console errors',
    status: 'passed',
    route_checks: routeChecks,
    console_issues: consoleIssues,
  });
});

test('real cashier can issue and collect an invoice against Laravel DB', async ({ page }) => {
  test.skip(!allowMutations, 'Set E2E_REAL_ALLOW_MUTATIONS=1 to create invoices and payments in a real DB.');

  const consoleIssues: string[] = [];
  const patientName = `Smoke Real ${Date.now()}`;

  captureConsoleIssues(page, consoleIssues);
  await loginToRealApp(page);

  await page.getByRole('link', { name: /caja/i }).click();
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: /^caja$/i })).toBeVisible();
  const openSessionHeading = main.getByRole('heading', { name: /caja abierta/i });
  const currentCashSession = await page.evaluate(async () => {
    const response = await fetch('/api/cash-sessions/current', { headers: { Accept: 'application/json' } });

    return response.ok ? response.json() : null;
  });

  if (!currentCashSession?.data) {
    const openCashButton = main.getByRole('button', { name: /^abrir caja$/i });
    await expect(openCashButton).toBeVisible();
    await openCashButton.click();
  }
  await expect(openSessionHeading).toBeVisible();

  await page.getByRole('link', { name: /nueva factura/i }).click();
  await expect(page.getByRole('heading', { name: /nueva factura/i })).toBeVisible();
  await page.getByLabel(/buscar por nombre/i).fill(serviceQuery);
  await page.getByRole('button', { name: new RegExp(serviceQuery, 'i') }).first().click();
  await expect(page.getByText(/ingrese paciente/i)).toBeVisible();

  await page.getByLabel(/nombre del paciente/i).fill(patientName);
  await page.getByRole('button', { name: /emitir y cobrar/i }).click();
  await page.getByRole('button', { name: /emitir y abrir cobro/i }).click();
  await expect(page.getByRole('heading', { name: /registrar pago/i })).toBeVisible();

  await expect(page.getByText(/ingrese el monto recibido/i)).toBeVisible();
  await page.getByLabel(/ver preview antes de imprimir/i).check();
  await page.getByLabel(/monto recibido/i).fill('17.25');
  await expect(page.getByText(/ingrese el monto recibido/i)).toBeHidden();
  await page.getByRole('button', { name: /confirmar cobro/i }).click();
  await expect(page.getByRole('heading', { name: /vista previa del recibo/i })).toBeVisible();
  await expect(page.getByText(patientName)).toBeVisible();
  await page.getByRole('button', { name: /cerrar modal/i }).click();

  await page.getByRole('link', { name: /ver factura/i }).click();
  await expect(page.getByText(patientName)).toBeVisible();

  await page.getByRole('link', { name: /reportes/i }).click();
  await expect(page.getByRole('heading', { name: /reporte diario/i })).toBeVisible();
  await expect(page.getByText(/total cobrado/i)).toBeVisible();

  await expect.poll(() => consoleIssues, {
    message: consoleIssues.join('\n') || 'No console issues captured.',
  }).toHaveLength(0);

  smokeResults.push({
    name: 'real cashier can issue and collect an invoice against Laravel DB',
    status: 'passed',
    patient_name: patientName,
    console_issues: consoleIssues,
  });
});

function captureConsoleIssues(page: Page, consoleIssues: string[]) {
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
    if (request.url().includes('/sanctum/csrf-cookie') && failure?.errorText === 'net::ERR_ABORTED') {
      return;
    }

    consoleIssues.push(`requestfailed: ${request.method()} ${request.url()} ${failure?.errorText ?? ''}`.trim());
  });
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();

    if ([401, 419, 422].includes(status) || status >= 500) {
      consoleIssues.push(`http.${status}: ${response.request().method()} ${url}`);
    }
  });
}

async function loginToRealApp(page: Page) {
  await page.goto(`${realBaseUrl}/login`);
  await page.getByLabel(/usuario|email/i).fill(login ?? '');
  await page.getByLabel(/contrasena|contrase.na|password/i).fill(password ?? '');
  await page.getByRole('button', { name: /entrar|iniciar/i }).click();
  await expect(page.getByRole('heading', { name: /dashboard|caja|reportes/i })).toBeVisible();
}

async function expectFirstAssetLoadsAsJavaScript(page: Page) {
  const loginResponse = await page.request.get(`${realBaseUrl}/login`);
  const html = await loginResponse.text();
  const assetMatch = html.match(/<script[^>]+src="(?<src>\/assets\/[^"]+\.js)"/i);
  expect(assetMatch?.groups?.src, 'login HTML should reference a built JS asset').toBeTruthy();

  const assetResponse = await page.request.get(`${realBaseUrl}${assetMatch?.groups?.src}`);
  expect(assetResponse.ok()).toBe(true);
  expect(assetResponse.headers()['content-type'] ?? '').toContain('javascript');
}
