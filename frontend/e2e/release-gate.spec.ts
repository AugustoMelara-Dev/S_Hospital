import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const baseUrl = (process.env.E2E_RELEASE_BASE_URL ?? 'http://127.0.0.1:5174').replace(/\/$/, '');
const apiBaseUrl = (process.env.E2E_RELEASE_API_BASE_URL ?? 'http://127.0.0.1:18081').replace(/\/$/, '');
const login = process.env.E2E_RELEASE_LOGIN ?? 'cajero.e2e';
const password = process.env.E2E_RELEASE_PASSWORD ?? 'Password123!';
const serviceQuery = process.env.E2E_RELEASE_SERVICE_QUERY ?? 'Glucosa';
const paymentAmount = process.env.E2E_RELEASE_PAYMENT_AMOUNT ?? '17.25';
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
    login,
    service_query: serviceQuery,
    allow_mutations: allowMutations,
    run_id: releaseRunId,
    release_stack: releaseStack,
    database_driver: databaseDriver,
    expected_specs: [
      'release gate cashier can issue, collect, show receipt, surface reports and close cash',
      'administrator creates cashier user and navigation blocks administration modules',
    ],
    results: releaseResults,
  }, null, 2));
});

test('release gate cashier can issue, collect, show receipt, surface reports and close cash', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const consoleIssues: string[] = [];
  const patientName = `E2E Release Gate ${Date.now()}`;

  const health = await page.request.get(`${apiBaseUrl}/api/system/health`);
  expect(health.ok()).toBe(true);
  const healthPayload = await health.json() as { data?: { database?: { driver?: string; connected?: boolean } } };
  databaseDriver = healthPayload.data?.database?.driver ?? 'unknown';
  expect(healthPayload.data?.database?.connected).toBe(true);
  if (process.env.E2E_RELEASE_DATABASE_DRIVER) {
    expect(databaseDriver).toBe(process.env.E2E_RELEASE_DATABASE_DRIVER);
  }

  await loginToReleaseApp(page);
  captureBlockingIssues(page, consoleIssues);

  const prepared = await page.evaluate(async () => {
    const [cash, branding, services] = await Promise.all([
      fetch('/api/cash-sessions/current', { headers: { Accept: 'application/json' } }).then((response) => response.json()),
      fetch('/api/settings/branding', { headers: { Accept: 'application/json' } }).then((response) => response.json()),
      fetch('/api/services?search=Glucosa&billing=1&per_page=10', { headers: { Accept: 'application/json' } }).then((response) => response.json()),
    ]);

    return { cash, branding, services };
  });

  expect(prepared.cash.data?.status).toBe('open');
  expect(prepared.branding.data?.hospital_name).toBe('Hospital General San Isidro');
  expect(prepared.services.data?.some((service: { name?: string }) => service.name === 'Glucosa')).toBe(true);

  await page.getByRole('navigation', { name: /navegaci.n principal/i })
    .getByRole('link', { name: /nueva factura/i })
    .click();
  await expect(page.getByRole('heading', { name: /nueva factura/i })).toBeVisible();
  await page.getByLabel(/buscar por nombre/i).fill(serviceQuery);
  const serviceButton = page.getByRole('button', { name: new RegExp(serviceQuery, 'i') }).first();
  await expect(serviceButton).toBeVisible();
  await serviceButton.click();
  await page.getByLabel(/nombre del paciente/i).fill(patientName);
  await page.getByRole('button', { name: /emitir y cobrar/i }).click();
  await page.getByRole('button', { name: /emitir y abrir cobro/i }).click();

  await expect(page.getByRole('dialog', { name: /registrar pago/i })).toBeVisible();
  await page.getByLabel(/monto recibido/i).fill(paymentAmount);
  await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'POST' &&
      /\/api\/invoices\/\d+\/payments$/.test(new URL(response.url()).pathname) &&
      response.status() === 201,
    ),
    page.getByRole('button', { name: /confirmar cobro/i }).click(),
  ]);

  const successDialog = page.getByRole('dialog', { name: /factura pagada/i });
  await expect(successDialog).toBeVisible({ timeout: 30_000 });
  await expect(successDialog.getByText(patientName)).toBeVisible();
  await Promise.all([
    page.waitForResponse((response) =>
      response.request().method() === 'GET' &&
      /\/api\/institutional-receipts\/\d+\/pdf$/.test(new URL(response.url()).pathname) &&
      response.ok(),
    ),
    page.waitForResponse((response) =>
      response.request().method() === 'POST' &&
      /\/api\/institutional-receipts\/\d+\/print-events$/.test(new URL(response.url()).pathname) &&
      response.status() === 201,
    ),
    successDialog.getByRole('button', { name: /imprimir recibo/i }).click(),
  ]);
  await expect(page.getByRole('status').filter({ hasText: /pdf institucional/i }).first()).toBeVisible();
  await successDialog.getByRole('button', { name: /ver recibo/i }).click();
  await expect(page.getByTitle(/vista previa del recibo institucional/i)).toBeVisible();

  const persisted = await page.evaluate(async (patient) => {
    const response = await fetch(`/api/invoices?search=${encodeURIComponent(patient)}&per_page=5`, {
      headers: { Accept: 'application/json' },
    });

    return response.json();
  }, patientName);

  const invoice = persisted.data?.find((item: { patient_name?: string }) => item.patient_name === patientName);
  expect(invoice?.status).toBe('paid');
  expect(invoice?.total).toBe(paymentAmount);

  const invoiceDetailPayload = await page.evaluate(async (invoiceId) => {
    const response = await fetch(`/api/invoices/${invoiceId}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`GET /api/invoices/${invoiceId} failed with ${response.status}`);
    return response.json();
  }, invoice.id);
  const invoiceDetail = invoiceDetailPayload.data as {
    cash_session?: { id?: number; user?: { username?: string } };
    institutional_receipt?: { status?: string; has_print_events?: boolean };
    payments?: Array<{
      amount?: string;
      cash_session_id?: number;
      method?: string;
      paid_at?: string;
      status?: string;
      user?: { username?: string };
    }>;
  };
  const payment = invoiceDetail.payments?.find((candidate) => candidate.status === 'posted');
  expect(invoiceDetail.cash_session?.id).toBe(prepared.cash.data.id);
  expect(invoiceDetail.cash_session?.user?.username).toBe(login);
  expect(invoiceDetail.institutional_receipt?.status).toBe('issued');
  expect(invoiceDetail.institutional_receipt?.has_print_events).toBe(true);
  expect(payment).toMatchObject({
    amount: paymentAmount,
    cash_session_id: prepared.cash.data.id,
    method: 'cash',
    status: 'posted',
    user: { username: login },
  });
  expect(Number.isNaN(Date.parse(payment?.paid_at ?? ''))).toBe(false);
  const paymentDate = (payment?.paid_at ?? '').slice(0, 10);
  expect(paymentDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  const adminPage = await browser.newPage();
  try {
    await loginToReleaseApp(adminPage, 'admin.e2e');
    captureBlockingIssues(adminPage, consoleIssues);
    await Promise.all([
      adminPage.waitForResponse((response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname === '/api/reports/executive' &&
        response.ok(),
      { timeout: 45_000 }),
      adminPage.getByRole('link', { name: /reportes/i }).click(),
    ]);
    await expect(adminPage.getByRole('navigation', { name: /secciones de reportes/i })).toBeVisible();
    await expect(adminPage.getByRole('link', { name: /ejecutivo/i })).toHaveAttribute('aria-current', 'page');
    await expect(adminPage.locator('section[aria-label="Reporte ejecutivo"]')).toBeVisible();
    await expect(adminPage.getByText('Total cobrado', { exact: true })).toBeVisible();

    const filteredExecutiveReport = await adminPage.evaluate(async ({ cashSessionId, reportDate }) => {
      const params = new URLSearchParams({
        date_from: reportDate,
        date_to: reportDate,
        cash_session_id: String(cashSessionId),
        method: 'cash',
      });
      const response = await fetch(`/api/reports/executive?${params.toString()}`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`GET /api/reports/executive failed with ${response.status}`);
      return response.json();
    }, { cashSessionId: prepared.cash.data.id, reportDate: paymentDate });
    const collectedTotal = Number(filteredExecutiveReport.data?.summary?.collected_total);
    expect(collectedTotal).toBeGreaterThanOrEqual(Number(paymentAmount));
    const cashAggregate = filteredExecutiveReport.data?.payment_methods?.find(
      (candidate: { method?: string }) => candidate.method === 'cash',
    );
    expect(Number(cashAggregate?.amount)).toBeGreaterThanOrEqual(Number(paymentAmount));
    expect(Number(cashAggregate?.count)).toBeGreaterThanOrEqual(1);
  } finally {
    await adminPage.close();
  }

  const receiptDialog = page.getByRole('dialog', { name: /comprobante de factura/i });
  await receiptDialog.getByRole('button', { name: /close/i }).click();
  await expect(receiptDialog).toBeHidden();
  const reopenedSuccessDialog = page.getByRole('dialog', { name: /factura pagada/i });
  await expect(reopenedSuccessDialog).toBeVisible();
  await reopenedSuccessDialog.getByRole('button', { name: /close/i }).click();
  await expect(reopenedSuccessDialog).toBeHidden();
  await page.getByRole('navigation', { name: /navegaci.n principal/i })
    .getByRole('link', { name: /^caja$/i })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: /^caja$/i })).toBeVisible();

  const cashSessionPayload = await page.evaluate(async () => {
    const response = await fetch('/api/cash-sessions/current', { headers: { Accept: 'application/json' } });
    return response.json();
  });
  const cashSession = cashSessionPayload.data as {
    id: number;
    expected_cash_amount: string;
    pending_invoice_count: number;
    missing_institutional_receipt_count: number;
    status: string;
  };
  expect(cashSession.status).toBe('open');
  expect(cashSession.pending_invoice_count).toBe(0);
  expect(cashSession.missing_institutional_receipt_count).toBe(0);

  const closingBreakdown = physicalCashBreakdown(cashSession.expected_cash_amount);
  await page.getByRole('tab', { name: /^arqueo$/i }).click();
  for (const [denomination, count] of Object.entries(closingBreakdown.bills)) {
    if (count > 0) {
      await page.getByLabel(new RegExp(`cantidad de billetes de L ${denomination}$`, 'i')).fill(String(count));
    }
  }
  if (closingBreakdown.other_amount !== '0.00') {
    await page.getByLabel(/monedas y otros/i).fill(closingBreakdown.other_amount);
  }
  await expect(page.getByRole('status', { name: /total contado por denominaciones/i }))
    .toContainText(cashSession.expected_cash_amount);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.screenshot({
    path: resolve(process.cwd(), '..', 'qa', 'operational-ux', 'after', 'cashbox-denominations-1366.png'),
    fullPage: true,
  });

  await page.getByRole('button', { name: /continuar al cierre/i }).click();
  await expect(page.getByRole('tab', { name: /^cierre$/i })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByLabel(/monto contado/i)).toHaveValue(cashSession.expected_cash_amount);
  await page.getByRole('button', { name: /^cerrar caja$/i }).click();
  const closeDialog = page.getByRole('dialog', { name: /cierre de caja/i });
  await expect(closeDialog).toBeVisible();

  const closeResponsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' &&
    new URL(response.url()).pathname === `/api/cash-sessions/${cashSession.id}/close` &&
    response.ok(),
  );
  await closeDialog.getByRole('button', { name: /^cerrar caja$/i }).click();
  const closeResponse = await closeResponsePromise;
  const closedPayload = await closeResponse.json();
  expect(closedPayload.data?.status).toBe('closed');
  expect(closedPayload.data?.closing_amount).toBe(cashSession.expected_cash_amount);
  expect(closedPayload.data?.closing_breakdown).toEqual(closingBreakdown);
  await expect(page.getByRole('region', { name: /resumen de cierre confirmado/i })).toBeVisible();

  expect(consoleIssues, consoleIssues.join('\n')).toEqual([]);

  releaseResults.push({
    name: 'release gate cashier can issue, collect, show receipt, surface reports and close cash',
    status: 'passed',
    patient_name: patientName,
    invoice_number: invoice?.invoice_number,
    cash_session_id: cashSession.id,
    cash_session_status: closedPayload.data?.status,
    console_issues: consoleIssues,
  });
});

function physicalCashBreakdown(amount: string) {
  const [wholePart = '0', fractionPart = ''] = amount.trim().split('.');
  let remainingCents = (Number(wholePart) * 100) + Number(fractionPart.padEnd(2, '0').slice(0, 2));
  const bills: Record<string, number> = {};

  for (const denomination of [500, 200, 100, 50, 20, 10, 5, 2, 1]) {
    const denominationCents = denomination * 100;
    bills[String(denomination)] = Math.floor(remainingCents / denominationCents);
    remainingCents %= denominationCents;
  }

  return {
    bills,
    other_amount: (remainingCents / 100).toFixed(2),
  };
}

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

async function loginToReleaseApp(page: Page, userLogin = login) {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel(/usuario|correo/i).fill(userLogin);
  await page.getByRole('textbox', { name: /contrase(?:n|ñ)a|password/i }).fill(password);
  await page.getByRole('button', { name: /iniciar sesi(?:o|ó)n|entrar/i }).click();
  await expect(page.getByRole('link', { name: /nueva factura/i })).toBeVisible({ timeout: 30_000 });
}
