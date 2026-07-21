import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const baseUrl = process.env.E2E_REAL_BASE_URL;
const login = process.env.E2E_REAL_LOGIN;
const password = process.env.E2E_REAL_PASSWORD;
const navLogin = process.env.E2E_REAL_NAV_LOGIN ?? login;
const navPassword = process.env.E2E_REAL_NAV_PASSWORD ?? password;
const realBaseUrl = baseUrl?.replace(/\/$/, '');
const allowMutations = process.env.E2E_REAL_ALLOW_MUTATIONS === '1';
const serviceQuery = process.env.E2E_REAL_SERVICE_QUERY ?? 'Glucosa';
const reportPath = resolve(process.env.E2E_REAL_REPORT_PATH ?? 'test-results/real-smoke-report.json');
const smokeResults: Array<Record<string, unknown>> = [];

type RealApiResult<T = unknown> = {
  ok: boolean;
  status: number;
  contentType: string;
  json: T | null;
  text: string;
};

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
  const echoConfigResponse = await page.request.get(`${realBaseUrl}/api/system/echo-config`);
  routeChecks['/api/system/echo-config'] = echoConfigResponse.status();
  await expect(echoConfigResponse.ok()).toBe(true);
  await expectFirstAssetLoadsAsJavaScript(page);

  await loginToRealApp(page, navLogin, navPassword);

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
  const requestUrls: string[] = [];
  const patientName = `Smoke Real ${Date.now()}`;

  await loginToRealApp(page, login, password);
  captureConsoleIssues(page, consoleIssues);
  page.on('request', (request) => requestUrls.push(request.url()));

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

  await page.getByRole('link', { name: /nueva factura/i }).first().click();
  await expect(page.getByRole('heading', { name: /nueva factura/i })).toBeVisible();
  await page.getByLabel(/buscar por nombre/i).fill(serviceQuery);
  await page.getByRole('button', { name: new RegExp(serviceQuery, 'i') }).first().click();
  await expect(page.getByText(/ingrese paciente/i)).toBeVisible();

  await page.getByLabel(/nombre del paciente/i).fill(patientName);
  await page.getByRole('button', { name: /emitir y cobrar/i }).click();
  await page.getByRole('button', { name: /emitir y abrir cobro/i }).click();
  await expect(page.getByRole('dialog', { name: /registrar pago/i })).toBeVisible();

  await expect(page.getByText(/ingrese el monto recibido/i)).toBeVisible();
  await page.getByLabel(/ver preview antes de imprimir/i).check();
  await page.getByLabel(/monto recibido/i).fill('17.25');
  await expect(page.getByText(/ingrese el monto recibido/i)).toBeHidden();
  await page.getByRole('button', { name: /confirmar cobro/i }).click();
  await expect(page.getByText(/pdf institucional/i).first()).toBeVisible();
  await expect(page.getByText(/REC-|recibo institucional/i).first()).toBeVisible();
  expect(
    requestUrls.filter((url) => /\/api\/invoices\/\d+\/receipt/.test(url)),
    'institutional preview must not fall back to legacy invoice receipt endpoint',
  ).toHaveLength(0);

  await page.goto(`${realBaseUrl}/invoices`);
  await expect(page.getByText(patientName)).toBeVisible();

  const currentSession = await getCurrentCashSession(page);
  expect(currentSession?.id, 'current cash session should exist after paid smoke invoice').toBeTruthy();
  expect(currentSession?.pending_invoice_count ?? 0, 'cash session should not have pending invoices before close smoke').toBe(0);

  const reportChecks = await verifyReportsViaApi(page, String(currentSession.id));
  const closedSession = await closeCurrentCashSessionViaApi(page, currentSession);
  const cashSessionReport = await apiRequestFromPage(page, 'GET', `/api/reports/cash-sessions/${currentSession.id}`);
  expect(cashSessionReport.ok, `cash session report failed: ${cashSessionReport.status} ${cashSessionReport.text}`).toBe(true);

  await expect.poll(() => consoleIssues, {
    message: consoleIssues.join('\n') || 'No console issues captured.',
  }).toHaveLength(0);

  smokeResults.push({
    name: 'real cashier can issue and collect an invoice against Laravel DB',
    status: 'passed',
    patient_name: patientName,
    cash_session_id: currentSession.id,
    close_status: closedSession.status,
    report_checks: reportChecks,
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

async function loginToRealApp(page: Page, username: string | undefined, userPassword: string | undefined) {
  await page.context().clearCookies();

  await page.goto(`${realBaseUrl}/login`);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  const appLink = page.getByRole('link', { name: /inicio|nueva factura|caja|reportes|respaldos/i }).first();
  const usernameInput = page.getByRole('textbox', { name: /usuario|correo|email/i });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await appLink.isVisible({ timeout: 1_000 }).catch(() => false)) {
      return;
    }

    await expect(usernameInput).toBeVisible();
    await usernameInput.fill(username ?? '');
    await page.getByRole('textbox', { name: /contrase(?:ñ|n)a|password/i }).fill(userPassword ?? '');
    await page.getByRole('button', { name: /entrar|iniciar/i }).click();

    await page.waitForTimeout(1_000);
    const lockoutMessage = page.getByText(/demasiados intentos|bloqueado/i).first();
    if (attempt < 2 && await lockoutMessage.isVisible().catch(() => false)) {
      await page.waitForTimeout(70_000);
      continue;
    }

    if (await appLink.isVisible({ timeout: 7_500 }).catch(() => false)) {
      return;
    }

    if (attempt < 2 && await lockoutMessage.isVisible().catch(() => false)) {
      await page.waitForTimeout(70_000);
      continue;
    }

    await expect(appLink).toBeVisible();
  }
}

async function expectFirstAssetLoadsAsJavaScript(page: Page) {
  const loginResponse = await page.request.get(`${realBaseUrl}/login`);
  const html = await loginResponse.text();
  const entryMatch = html.match(
    /<script[^>]+src="(?<src>\/(?:assets\/[^"]+\.js|src\/[^"]+\.(?:ts|tsx|js|jsx)))"/i,
  );
  expect(
    entryMatch?.groups?.src,
    'login HTML should reference a production bundle or Vite application entry',
  ).toBeTruthy();

  const assetResponse = await page.request.get(`${realBaseUrl}${entryMatch?.groups?.src}`);
  expect(assetResponse.ok()).toBe(true);
  expect(assetResponse.headers()['content-type'] ?? '').toContain('javascript');
}

async function getCurrentCashSession(page: Page): Promise<Record<string, unknown>> {
  const result = await apiRequestFromPage<{ data?: Record<string, unknown> | null }>(
    page,
    'GET',
    '/api/cash-sessions/current',
  );
  expect(result.ok, `current cash session failed: ${result.status} ${result.text}`).toBe(true);
  expect(result.json?.data, 'current cash session payload should contain data').toBeTruthy();

  return result.json?.data as Record<string, unknown>;
}

async function closeCurrentCashSessionViaApi(
  page: Page,
  currentSession: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const sessionId = currentSession.id;
  const closingAmount = String(
    currentSession.expected_cash_amount
      ?? currentSession.expected_amount
      ?? currentSession.opening_amount
      ?? '0.00',
  );

  const result = await apiRequestFromPage<{ data?: Record<string, unknown> }>(
    page,
    'POST',
    `/api/cash-sessions/${sessionId}/close`,
    {
      closing_amount: closingAmount,
      notes: 'Cierre automatico de validacion smoke real.',
    },
  );

  expect(result.ok, `close cash session failed: ${result.status} ${result.text}`).toBe(true);
  expect(result.json?.data?.status, 'closed cash session should be returned').toBe('closed');

  return result.json.data;
}

async function verifyReportsViaApi(page: Page, cashSessionId: string): Promise<Record<string, number>> {
  const today = hondurasDate();
  const month = today.slice(0, 7);
  const reportChecks: Record<string, number> = {};
  const jsonEndpoints = [
    '/api/reports/today',
    `/api/reports/executive?date_from=${today}&date_to=${today}&cash_session_id=${cashSessionId}`,
    `/api/reports/daily?date=${today}`,
    `/api/reports/monthly?month=${month}`,
    `/api/reports/income?date_from=${today}&date_to=${today}&cash_session_id=${cashSessionId}`,
    `/api/reports/categories?date_from=${today}&date_to=${today}&cash_session_id=${cashSessionId}`,
    `/api/reports/services?date_from=${today}&date_to=${today}&cash_session_id=${cashSessionId}`,
    `/api/reports/operations?date_from=${today}&date_to=${today}&cash_session_id=${cashSessionId}`,
  ];

  for (const endpoint of jsonEndpoints) {
    const result = await apiRequestFromPage(page, 'GET', endpoint);
    reportChecks[endpoint] = result.status;
    expect(result.ok, `${endpoint} failed: ${result.status} ${result.text}`).toBe(true);
    expect(result.contentType, `${endpoint} should return JSON`).toContain('application/json');
  }

  const downloadEndpoints = [
    `/api/reports/executive/pdf?date_from=${today}&date_to=${today}&cash_session_id=${cashSessionId}`,
    `/api/reports/executive/excel?date_from=${today}&date_to=${today}&cash_session_id=${cashSessionId}`,
  ];

  for (const endpoint of downloadEndpoints) {
    const result = await apiRequestFromPage(page, 'GET', endpoint);
    reportChecks[endpoint] = result.status;
    expect(result.ok, `${endpoint} failed: ${result.status} ${result.text.slice(0, 200)}`).toBe(true);
    expect(
      /application\/pdf|spreadsheet|excel|octet-stream/i.test(result.contentType),
      `${endpoint} should return a downloadable report, got ${result.contentType}`,
    ).toBe(true);
  }

  return reportChecks;
}

async function apiRequestFromPage<T = unknown>(
  page: Page,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<RealApiResult<T>> {
  return page.evaluate(async ({ method, path, body }) => {
    function cookieValue(name: string): string | null {
      const prefix = `${name}=`;
      const cookie = document.cookie
        .split(';')
        .map((value) => value.trim())
        .find((value) => value.startsWith(prefix));

      return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
    }

    const upperMethod = method.toUpperCase();
    if (upperMethod !== 'GET' && upperMethod !== 'HEAD') {
      const csrf = await fetch('/sanctum/csrf-cookie', { credentials: 'include' });
      if (!csrf.ok) {
        return {
          ok: false,
          status: csrf.status,
          contentType: csrf.headers.get('content-type') ?? '',
          json: null,
          text: await csrf.text(),
        };
      }
    }

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (upperMethod !== 'GET' && upperMethod !== 'HEAD') {
      headers['Content-Type'] = 'application/json';
      headers['Idempotency-Key'] = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `smoke-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const xsrfToken = cookieValue('XSRF-TOKEN');
      if (xsrfToken) {
        headers['X-XSRF-TOKEN'] = xsrfToken;
      }
    }

    const response = await fetch(path, {
      method: upperMethod,
      credentials: 'include',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const contentType = response.headers.get('content-type') ?? '';
    const text = await response.text();
    let json: T | null = null;
    try {
      json = JSON.parse(text) as T;
    } catch {
      json = null;
    }

    return {
      ok: response.ok,
      status: response.status,
      contentType,
      json,
      text,
    };
  }, { method, path, body });
}

function hondurasDate(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Tegucigalpa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}
