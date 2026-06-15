import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const baseUrl = (process.env.E2E_RELEASE_BASE_URL ?? 'http://127.0.0.1:5174').replace(/\/$/, '');
const apiBaseUrl = (process.env.E2E_RELEASE_API_BASE_URL ?? 'http://127.0.0.1:18081').replace(/\/$/, '');
const login = process.env.E2E_RELEASE_LOGIN ?? 'cajero.e2e';
const password = process.env.E2E_RELEASE_PASSWORD ?? 'Password123!';
const serviceQuery = process.env.E2E_RELEASE_SERVICE_QUERY ?? 'Glucosa';
const allowMutations = process.env.E2E_RELEASE_ALLOW_MUTATIONS === '1';
const reportPath = resolve(process.env.E2E_RELEASE_REPORT_PATH ?? 'test-results/release-e2e-report.json');
const releaseResults: Array<Record<string, unknown>> = [];

test.beforeAll(() => {
  if (!allowMutations) {
    throw new Error('Release E2E requires E2E_RELEASE_ALLOW_MUTATIONS=1 against a prepared non-production database.');
  }
});

test.afterAll(() => {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    api_base_url: apiBaseUrl,
    login,
    service_query: serviceQuery,
    allow_mutations: allowMutations,
    results: releaseResults,
  }, null, 2));
});

test('release gate cashier can issue, collect, show receipt and surface reports', async ({ page, browser }) => {
  const consoleIssues: string[] = [];
  const patientName = `E2E Release Gate ${Date.now()}`;

  captureBlockingIssues(page, consoleIssues);

  const health = await page.request.get(`${apiBaseUrl}/api/system/health`);
  expect(health.ok()).toBe(true);

  await loginToReleaseApp(page);

  const prepared = await page.evaluate(async () => {
    const [cash, branding, services] = await Promise.all([
      fetch('/api/cash-sessions/current', { headers: { Accept: 'application/json' } }).then((response) => response.json()),
      fetch('/api/settings/branding', { headers: { Accept: 'application/json' } }).then((response) => response.json()),
      fetch('/api/services?search=Glucosa&billing=1&per_page=10', { headers: { Accept: 'application/json' } }).then((response) => response.json()),
    ]);

    return { cash, branding, services };
  });

  expect(prepared.cash.data?.status).toBe('open');
  expect(prepared.branding.data?.hospital_name).toContain('E2E');
  expect(prepared.services.data?.some((service: { name?: string }) => service.name === 'Glucosa')).toBe(true);

  await page.getByRole('link', { name: /nueva factura/i }).click();
  await expect(page.getByRole('heading', { name: /nueva factura/i })).toBeVisible();
  await page.getByLabel(/buscar por nombre/i).fill(serviceQuery);
  await page.getByRole('button', { name: new RegExp(`Agregar ${serviceQuery}`, 'i') }).first().click();
  await page.getByLabel(/nombre del paciente/i).fill(patientName);
  await page.getByRole('button', { name: /emitir y cobrar/i }).click();
  await page.getByRole('button', { name: /emitir y abrir cobro/i }).click();

  await expect(page.getByRole('heading', { name: /registrar pago/i })).toBeVisible();
  await page.getByLabel(/ver preview antes de imprimir/i).check();
  await page.getByLabel(/monto recibido/i).fill('17.25');
  await page.getByRole('button', { name: /confirmar cobro y ver preview|registrar cobro y ver preview/i }).click();
  await expect(page.getByRole('heading', { name: /comprobante de factura/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /recibo institucional/i })).toBeVisible();
  await expect(page.getByText(patientName)).toBeVisible();

  const persisted = await page.evaluate(async (patient) => {
    const response = await fetch(`/api/invoices?search=${encodeURIComponent(patient)}&per_page=5`, {
      headers: { Accept: 'application/json' },
    });

    return response.json();
  }, patientName);

  const invoice = persisted.data?.find((item: { patient_name?: string }) => item.patient_name === patientName);
  expect(invoice?.status).toBe('paid');
  expect(invoice?.total).toBe('17.25');

  const adminPage = await browser.newPage();
  captureBlockingIssues(adminPage, consoleIssues);
  try {
    await loginToReleaseApp(adminPage, 'admin.e2e');
    await adminPage.getByRole('link', { name: /reportes/i }).click();
    await expect(adminPage.getByRole('heading', { name: /reportes/i })).toBeVisible();
    await expect(adminPage.getByRole('heading', { name: /resumen del d/i })).toBeVisible();
    await expect(adminPage.getByText(/cobrado/i).first()).toBeVisible();
  } finally {
    await adminPage.close();
  }

  expect(consoleIssues, consoleIssues.join('\n')).toEqual([]);

  releaseResults.push({
    name: 'release gate cashier can issue, collect, show receipt and surface reports',
    status: 'passed',
    patient_name: patientName,
    invoice_number: invoice?.invoice_number,
    console_issues: consoleIssues,
  });
});

function captureBlockingIssues(page: Page, consoleIssues: string[]) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      if (/Failed to load resource: the server responded with a status of 403/i.test(message.text())) {
        return;
      }

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

async function loginToReleaseApp(page: Page, userLogin = login) {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel(/usuario|correo/i).fill(userLogin);
  await page.getByRole('textbox', { name: /contrase(?:n|ñ)a|password/i }).fill(password);
  await page.getByRole('button', { name: /iniciar sesi(?:o|ó)n|entrar/i }).click();
  await expect(page.getByRole('link', { name: /nueva factura/i })).toBeVisible();
}
