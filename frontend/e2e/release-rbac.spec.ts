import { expect, test, type Page } from '@playwright/test';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Gate RBAC de release sobre el producto nuevo "Panel administrativo".
 *
 * Reescrito desde el `release-rbac` R2: usa la navegación nueva
 * (`/administracion/usuarios`, menú "Administración", botón "Salir") en lugar
 * del riel R2 y sus labels. Comprueba que un cajero recién creado:
 *  - recibe el rol `cajero` con sus permisos reales y sin permisos elevados;
 *  - ve las secciones primarias que su rol autoriza;
 *  - NO ve Usuarios/Ajustes/Mantenimiento en Administración;
 *  - recibe 403 del backend y "Sin permisos" al forzar `/administracion/usuarios`.
 *
 * Requiere `E2E_RELEASE_ALLOW_MUTATIONS=1` contra una base desechable. Crea un
 * usuario sintético con timestamp; no usa datos productivos.
 */

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
    ...existingResults.filter((result) => result.name !== 'administrator creates cashier user and new navigation scopes administration modules'),
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

test('administrator creates cashier user and new navigation scopes administration modules', async ({ page }) => {
  test.setTimeout(180_000);
  const username = `cajero-release-${Date.now()}`;
  const initialPassword = 'InitialRbac123!';
  const changedPassword = 'ChangedRbac123!';
  const consoleIssues: string[] = [];
  const expectedForbiddenPaths = new Set<string>();

  captureBlockingIssues(page, consoleIssues, expectedForbiddenPaths);

  const health = await page.request.get(`${apiBaseUrl}/api/system/health`);
  expect(health.ok()).toBe(true);

  await login(page, adminLogin, seededPassword);
  await openAdministrationItem(page, /usuarios y permisos/i);
  await expect(page).toHaveURL(/\/administracion\/usuarios$/);
  await expect(page.getByRole('heading', { level: 1, name: /usuarios y funciones/i })).toBeVisible();

  const createUserButton = page.getByRole('button', { name: /^crear usuario$/i }).first();
  await expect(createUserButton).toBeEnabled();
  await createUserButton.click();
  const createUserDialog = page.getByRole('dialog', { name: /crear usuario/i });
  await expect(createUserDialog).toBeVisible({ timeout: 30_000 });

  await createUserDialog.getByLabel(/nombre completo/i).fill('Cajero Release E2E');
  await createUserDialog.getByLabel(/correo electrónico/i).fill(`${username}@hospital-san-isidro.local`);
  await createUserDialog.getByLabel(/nombre de usuario/i).fill(username);
  await createUserDialog.getByLabel(/contraseña inicial/i).fill(initialPassword);

  await expect(createUserDialog.getByLabel(/nombre completo/i)).toHaveValue('Cajero Release E2E');
  await expect(createUserDialog.getByLabel(/correo electrónico/i)).toHaveValue(`${username}@hospital-san-isidro.local`);
  await expect(createUserDialog.getByLabel(/nombre de usuario/i)).toHaveValue(username);
  await expect(createUserDialog.getByLabel(/contraseña inicial/i)).toHaveValue(initialPassword);
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
  expect(createdUser?.permissions).toContain('reports.cash_session.view');
  expect(createdUser?.permissions).not.toContain('users.view');
  expect(createdUser?.permissions).not.toContain('backups.view');
  expect(createdUser?.permissions).not.toContain('settings.fiscal.view');
  expect(createdUser?.permissions).not.toContain('receipt_settings.view');
  expect(createdUser?.permissions).not.toContain('receipt_settings.update');

  await logout(page);
  await login(page, username, initialPassword, /cambio obligatorio de contraseña/i);
  await page.getByLabel(/^contraseña actual/i).fill(initialPassword);
  await page.getByLabel(/^nueva contraseña/i).fill(changedPassword);
  await page.getByLabel(/^confirmar nueva contraseña/i).fill(changedPassword);
  await page.getByRole('button', { name: /actualizar contraseña/i }).click();

  // 1) Secciones primarias que el rol cajero autoriza (incluye Reportes por
  //    reports.cash_session.view). El cajero aterriza en Cobrar.
  await expect(page.getByRole('button', { name: /^salir$/i })).toBeVisible({ timeout: 30_000 });
  const primaryNav = page.getByRole('navigation', { name: /navegación principal/i });
  await expect(primaryNav.getByRole('link', { name: 'Cobrar' })).toBeVisible();
  await expect(primaryNav.getByRole('link', { name: 'Recibos' })).toBeVisible();
  await expect(primaryNav.getByRole('link', { name: 'Caja' })).toBeVisible();
  await expect(primaryNav.getByRole('link', { name: 'Reportes' })).toBeVisible();

  // 2) Administración queda acotada: solo Catálogo (catalog.view) y Ayuda.
  await page.getByRole('button', { name: /^administración$/i }).click();
  await expect(page.getByRole('menuitem', { name: /catálogo y precios/i })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /usuarios y permisos/i })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: /ajustes institucionales/i })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: /mantenimiento y respaldos/i })).toHaveCount(0);
  await page.keyboard.press('Escape');

  const authenticatedSession = await page.evaluate(async () => {
    const response = await fetch('/api/auth/session', { headers: { Accept: 'application/json' } });
    const payload = await response.json();
    return payload.data as { username?: string; must_change_password?: boolean } | null;
  });
  expect(authenticatedSession).toMatchObject({ username, must_change_password: false });

  // 3) El backend sigue siendo la autoridad: 403 en la API y "Sin permisos" en
  //    la ruta directa.
  expectedForbiddenPaths.add('/api/admin/users');
  const protectedUsersStatus = await page.evaluate(async () => {
    const response = await fetch('/api/admin/users', { headers: { Accept: 'application/json' } });
    return response.status;
  });
  expect(protectedUsersStatus).toBe(403);

  await page.goto('/administracion/usuarios');
  await expect(page.getByRole('heading', { level: 1, name: /sin permisos/i })).toBeVisible();
  await expect(page.getByText(/requiere permiso para administrar usuarios/i)).toBeVisible();

  expect(consoleIssues, consoleIssues.join('\n')).toEqual([]);
  releaseResults.push({
    name: 'administrator creates cashier user and new navigation scopes administration modules',
    status: 'passed',
    username,
    protected_users_status: protectedUsersStatus,
    console_issues: consoleIssues,
  });
});

async function login(page: Page, username: string, password: string, expectedHeading?: RegExp) {
  await page.goto(`${baseUrl}/login`);
  await page.locator('#login-input').fill(username);
  await page.locator('#password-input').fill(password);
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
  if (expectedHeading) {
    await expect(page.getByRole('heading', { name: expectedHeading })).toBeVisible({ timeout: 30_000 });
    return;
  }
  await expect(page.getByRole('button', { name: /^salir$/i })).toBeVisible({ timeout: 30_000 });
}

async function logout(page: Page) {
  await page.getByRole('button', { name: /^salir$/i }).click();
  await expect(page.locator('#login-input')).toBeVisible({ timeout: 30_000 });
}

async function openAdministrationItem(page: Page, label: RegExp) {
  await page.getByRole('button', { name: /^administración$/i }).click();
  await page.getByRole('menuitem', { name: label }).click();
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
