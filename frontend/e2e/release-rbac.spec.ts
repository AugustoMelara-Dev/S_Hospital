import { expect, test, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const baseUrl = (process.env.E2E_RELEASE_BASE_URL ?? 'http://127.0.0.1:5174').replace(/\/$/, '');
const apiBaseUrl = (process.env.E2E_RELEASE_API_BASE_URL ?? 'http://127.0.0.1:18081').replace(/\/$/, '');
const adminLogin = process.env.E2E_RELEASE_ADMIN_LOGIN ?? 'admin.e2e';
const seededPassword = process.env.E2E_RELEASE_PASSWORD ?? 'Password123!';
const allowMutations = process.env.E2E_RELEASE_ALLOW_MUTATIONS === '1';
const reportPath = resolve(process.env.E2E_RELEASE_REPORT_PATH ?? 'test-results/release-e2e-report.json');
const releaseRunId = process.env.E2E_RELEASE_RUN_ID ?? `local-${Date.now()}`;
const releaseStack = process.env.E2E_RELEASE_STACK ?? 'unspecified';
const releaseResults: Array<Record<string, unknown>> = [];

test.skip(!allowMutations, 'RBAC E2E requires E2E_RELEASE_ALLOW_MUTATIONS=1 against a prepared non-production database.');

test.afterAll(() => {
  mkdirSync(dirname(reportPath), { recursive: true });
  const existing = existsSync(reportPath)
    ? JSON.parse(readFileSync(reportPath, 'utf8')) as Record<string, unknown>
    : {};
  const existingResults = Array.isArray(existing.results) ? existing.results as Array<Record<string, unknown>> : [];
  const mergedResults = [
    ...existingResults.filter((result) => result.name !== 'administrator creates cashier user and navigation blocks administration modules'),
    ...releaseResults,
  ];

  writeFileSync(reportPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    base_url: baseUrl,
    api_base_url: apiBaseUrl,
    run_id: releaseRunId,
    release_stack: releaseStack,
    ...existing,
    results: mergedResults,
  }, null, 2));
});

test('administrator creates cashier user and navigation blocks administration modules', async ({ page }) => {
  const username = `cajero-release-${Date.now()}`;
  const initialPassword = 'InitialRbac123!';
  const changedPassword = 'ChangedRbac123!';
  const consoleIssues: string[] = [];
  const expectedForbiddenPaths = new Set<string>();

  captureBlockingIssues(page, consoleIssues, expectedForbiddenPaths);

  const health = await page.request.get(`${apiBaseUrl}/api/system/health`);
  expect(health.ok()).toBe(true);

  await login(page, adminLogin, seededPassword);
  await page.getByRole('link', { name: /usuarios/i }).click();
  await expect(page.getByRole('heading', { name: /usuarios y funciones/i })).toBeVisible();

  const createUserButton = page.getByRole('button', { name: /^crear usuario$/i });
  await expect(createUserButton).toBeEnabled();
  await createUserButton.click();
  const createUserDialog = page.getByRole('dialog', { name: /crear usuario/i });
  await expect(createUserDialog).toBeVisible({ timeout: 30_000 });

  await createUserDialog.getByLabel(/nombre completo/i).fill('Cajero Release E2E');
  await createUserDialog.getByLabel(/correo electr/i).fill(`${username}@hospital-san-isidro.local`);
  await createUserDialog.getByLabel(/nombre de usuario/i).fill(username);
  await createUserDialog.getByLabel(/contrase/i).fill(initialPassword);

  await expect(createUserDialog.getByLabel(/nombre completo/i)).toHaveValue('Cajero Release E2E');
  await expect(createUserDialog.getByLabel(/correo electr/i)).toHaveValue(`${username}@hospital-san-isidro.local`);
  await expect(createUserDialog.getByLabel(/nombre de usuario/i)).toHaveValue(username);
  await expect(createUserDialog.getByLabel(/contrase/i)).toHaveValue(initialPassword);
  const createUserResponsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/admin/users'
  );
  await createUserDialog.getByRole('button', { name: /^crear usuario$/i }).click();
  const createUserResponse = await createUserResponsePromise;
  expect(createUserResponse.status(), await createUserResponse.text()).toBe(201);
  await expect(page.getByRole('dialog', { name: /crear usuario/i })).toBeHidden();
  await page.getByLabel(/buscar usuarios/i).fill(username);
  await expect(page.getByRole('row', { name: new RegExp(username, 'i') })).toBeVisible();

  const createdPayload = await fetchJsonFromPage<{ data: Array<{ username: string; roles: string[]; permissions: string[] }> }>(
    page,
    '/api/admin/users',
  );
  const createdUser = createdPayload.data.find((user) => user.username === username);
  expect(createdUser?.roles).toContain('cajero');
  expect(createdUser?.permissions).toContain('catalog.view');
  expect(createdUser?.permissions).toContain('invoices.create');
  expect(createdUser?.permissions).not.toContain('users.view');
  expect(createdUser?.permissions).not.toContain('backups.view');
  expect(createdUser?.permissions).not.toContain('settings.fiscal.view');

  await logout(page);
  await login(page, username, initialPassword, /cambio obligatorio de contrase/i);
  await page.getByLabel(/contrase.a actual/i).fill(initialPassword);
  await page.getByLabel(/^nueva contrase/i).fill(changedPassword);
  await page.getByLabel(/confirmar nueva contrase/i).fill(changedPassword);
  await page.getByRole('button', { name: /actualizar contrase/i }).click();

  await expect(page.getByRole('link', { name: /nueva factura/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /caja/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /usuarios/i })).toBeHidden();
  await expect(page.getByRole('link', { name: /respaldos/i })).toBeHidden();
  await expect(page.getByRole('link', { name: /configuraci/i })).toBeHidden();
  const authenticatedSession = await page.evaluate(async () => {
    const response = await fetch('/api/auth/session', { headers: { Accept: 'application/json' } });
    const payload = await response.json();
    return payload.data as { username?: string; must_change_password?: boolean } | null;
  });
  expect(authenticatedSession).toMatchObject({ username, must_change_password: false });


  expectedForbiddenPaths.add('/api/admin/users');
  const protectedUsersStatus = await page.evaluate(async () => {
    const response = await fetch('/api/admin/users', { headers: { Accept: 'application/json' } });
    return response.status;
  });
  expect(protectedUsersStatus).toBe(403);

  await page.evaluate(() => {
    window.history.pushState({}, '', '/admin/users');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByText(/requiere permiso para gestionar usuarios/i)).toBeVisible();

  expect(consoleIssues, consoleIssues.join('\n')).toEqual([]);
  releaseResults.push({
    name: 'administrator creates cashier user and navigation blocks administration modules',
    status: 'passed',
    username,
    protected_users_status: protectedUsersStatus,
    console_issues: consoleIssues,
  });
});

async function login(page: Page, username: string, password: string, expectedHeading?: RegExp) {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel(/usuario|correo/i).fill(username);
  await page.locator('#password-input').fill(password);
  await page.getByRole('button', { name: /iniciar sesi/i }).click();
  if (expectedHeading) {
    await expect(page.getByRole('heading', { name: expectedHeading })).toBeVisible({ timeout: 30_000 });
    return;
  }
  await expect(page.getByRole('button', { name: /menu de usuario/i })).toBeVisible({ timeout: 30_000 });
}

async function logout(page: Page) {
  await page.getByRole('button', { name: /menu de usuario/i }).click();
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/auth/logout') && response.ok()),
    page.getByRole('menuitem', { name: /cerrar sesi/i }).click(),
  ]);
  await expect(page.locator('#login-input')).toBeVisible();
}

async function fetchJsonFromPage<T>(page: Page, path: string): Promise<T> {
  return page.evaluate(async (requestPath) => {
    const response = await fetch(requestPath, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`GET ${requestPath} failed with ${response.status}`);
    }

    return response.json();
  }, path) as Promise<T>;
}

function captureBlockingIssues(
  page: Page,
  consoleIssues: string[],
  expectedForbiddenPaths: ReadonlySet<string>,
) {
  page.on('console', (message) => {
    if (message.type() === 'error') {
      const text = message.text();
      if (/Failed to load resource.*403/i.test(text) && expectedForbiddenPaths.size > 0) {
        return;
      }

      consoleIssues.push(`${message.type()}: ${text}`);
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
    const path = new URL(response.url()).pathname;
    if (status === 403 && expectedForbiddenPaths.has(path)) {
      return;
    }

    if ([401, 403, 419, 422].includes(status) || status >= 500) {
      consoleIssues.push(`http.${status}: ${response.request().method()} ${response.url()}`);
    }
  });
}
