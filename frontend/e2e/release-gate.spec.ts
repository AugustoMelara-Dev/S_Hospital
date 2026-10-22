import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Gate de release/readiness del producto nuevo "Panel administrativo".
 *
 * Reescrito desde el `release-gate` R2: ya no reproduce la UI retirada
 * (`/billing/new`, "emitir y cobrar", arqueo por denominaciones). Verifica, con
 * stack real no productivo preparado por `hospital:prepare-e2e-release-data`:
 *  - liveness pública `/api/system/health`;
 *  - driver y conexión reales vía `/api/system/health/detail` (autenticado);
 *  - contratos de datos preparados (branding, catálogo, caja abierta);
 *  - montaje de las secciones nuevas con una sesión real.
 *
 * Requiere `E2E_RELEASE_ALLOW_MUTATIONS=1` contra una base desechable. No usa
 * datos productivos ni inventa precios: solo comprueba lo que el servidor
 * devuelve para los datos sintéticos sembrados.
 */

const baseUrl = (process.env.E2E_RELEASE_BASE_URL ?? 'http://127.0.0.1:5174').replace(/\/$/, '');
const apiBaseUrl = (process.env.E2E_RELEASE_API_BASE_URL ?? 'http://127.0.0.1:18081').replace(/\/$/, '');
const cashierLogin = process.env.E2E_RELEASE_LOGIN ?? 'cajero.e2e';
const adminLogin = process.env.E2E_RELEASE_ADMIN_LOGIN ?? 'admin.e2e';
const password = process.env.E2E_RELEASE_PASSWORD ?? 'Password123!';
const expectedDriver = process.env.E2E_RELEASE_DATABASE_DRIVER;
const allowMutations = process.env.E2E_RELEASE_ALLOW_MUTATIONS === '1';
const reportPath = resolve(process.env.E2E_RELEASE_REPORT_PATH ?? 'test-results/release-e2e-report.json');
const releaseRunId = process.env.E2E_RELEASE_RUN_ID ?? `local-${Date.now()}`;
const releaseStack = process.env.E2E_RELEASE_STACK ?? 'unspecified';
const releaseResults: Array<Record<string, unknown>> = [];
let databaseDriver = 'unknown';

test.skip(!allowMutations, 'Release E2E requires E2E_RELEASE_ALLOW_MUTATIONS=1 against a prepared non-production database.');

test.afterAll(() => {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    api_base_url: apiBaseUrl,
    login: cashierLogin,
    allow_mutations: allowMutations,
    run_id: releaseRunId,
    release_stack: releaseStack,
    database_driver: databaseDriver,
    expected_specs: [
      'release readiness: health, real database driver, prepared data and new sections render',
    ],
    results: releaseResults,
  }, null, 2));
});

test('release readiness: health, real database driver, prepared data and new sections render', async ({ page, browser }) => {
  test.setTimeout(180_000);
  const consoleIssues: string[] = [];

  // 1) Liveness pública (sin sesión).
  const health = await page.request.get(`${apiBaseUrl}/api/system/health`);
  expect(health.ok()).toBe(true);
  const healthPayload = await health.json() as { data?: { status?: string; version?: string } };
  expect(healthPayload.data?.status).toBe('ok');

  // 2) Sesión real de cajero y datos preparados no productivos.
  await loginToReleaseApp(page, cashierLogin);
  captureBlockingIssues(page, consoleIssues);

  const prepared = await page.evaluate(async () => {
    const [branding, services, cash] = await Promise.all([
      fetch('/api/settings/branding', { headers: { Accept: 'application/json' } }).then((response) => response.json()),
      fetch('/api/services?search=Glucosa&per_page=10', { headers: { Accept: 'application/json' } }).then((response) => response.json()),
      fetch('/api/cash-sessions/current', { headers: { Accept: 'application/json' } }).then((response) => response.json()),
    ]);

    return { branding, services, cash };
  });

  expect(prepared.branding.data?.hospital_name).toBe('Hospital General San Isidro');
  expect(prepared.services.data?.some((service: { name?: string }) => /glucosa/i.test(service.name ?? ''))).toBe(true);
  expect(prepared.cash.data?.status).toBe('open');

  // 3) Driver real: el detalle operativo vive tras `system.status.view`, así que
  //    se consulta con una sesión administrativa en un contexto aparte.
  const adminPage = await browser.newPage();
  try {
    await loginToReleaseApp(adminPage, adminLogin);
    const detail = await adminPage.evaluate(async () => {
      const response = await fetch('/api/system/health/detail', { headers: { Accept: 'application/json' } });
      return { status: response.status, payload: await response.json() as { data?: { database?: { driver?: string; connected?: boolean } } } };
    });
    expect(detail.status, 'GET /api/system/health/detail').toBe(200);
    databaseDriver = detail.payload.data?.database?.driver ?? 'unknown';
    expect(detail.payload.data?.database?.connected).toBe(true);
    if (expectedDriver) {
      expect(databaseDriver).toBe(expectedDriver);
    }
  } finally {
    await adminPage.close();
  }

  // 4) Secciones nuevas montan sobre el shell admin con sesión real. El cajero
  //    tiene permiso sobre las cinco primarias (incluye reports.cash_session.view).
  const primaryNav = page.getByRole('navigation', { name: /navegación principal/i });
  await expect(primaryNav.getByRole('link', { name: 'Resumen' })).toBeVisible();
  const sections: Array<{ label: string; heading: RegExp }> = [
    { label: 'Cobrar', heading: /^cobrar$/i },
    { label: 'Recibos', heading: /^recibos$/i },
    { label: 'Caja', heading: /^caja$/i },
    { label: 'Reportes', heading: /^reportes$/i },
  ];

  for (const section of sections) {
    await primaryNav.getByRole('link', { name: section.label }).click();
    await expect(page.getByRole('heading', { level: 1, name: section.heading })).toBeVisible({ timeout: 30_000 });
  }

  expect(consoleIssues, consoleIssues.join('\n')).toEqual([]);

  releaseResults.push({
    name: 'release readiness: health, real database driver, prepared data and new sections render',
    status: 'passed',
    login: cashierLogin,
    database_driver: databaseDriver,
    sections: sections.map((section) => section.label),
    console_issues: consoleIssues,
  });
});

function captureBlockingIssues(page: Page, consoleIssues: string[]) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
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
    if (request.method() === 'GET' && failure?.errorText === 'net::ERR_ABORTED') {
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

async function loginToReleaseApp(page: Page, userLogin: string) {
  await page.goto(`${baseUrl}/login`);
  await page.locator('#login-input').fill(userLogin);
  await page.locator('#password-input').fill(password);
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
  await expect(page.getByRole('button', { name: /^salir$/i })).toBeVisible({ timeout: 30_000 });
}
