import { expect, test, type Page } from '@playwright/test';

const baseUrl = (process.env.E2E_RELEASE_BASE_URL ?? 'http://127.0.0.1:5174').replace(/\/$/, '');
const apiBaseUrl = (process.env.E2E_RELEASE_API_BASE_URL ?? 'http://127.0.0.1:18081').replace(/\/$/, '');
const adminLogin = process.env.E2E_RELEASE_ADMIN_LOGIN ?? 'admin.e2e';
const seededPassword = process.env.E2E_RELEASE_PASSWORD ?? 'Password123!';
const allowMutations = process.env.E2E_RELEASE_ALLOW_MUTATIONS === '1';

test.skip(!allowMutations, 'RBAC E2E requires E2E_RELEASE_ALLOW_MUTATIONS=1 against a prepared non-production database.');

test('administrator creates exact catalog-only user and navigation enforces module access', async ({ page }) => {
  const username = `catalogo-e2e-${Date.now()}`;
  const initialPassword = 'InitialRbac123!';
  const changedPassword = 'ChangedRbac123!';
  const consoleIssues: string[] = [];

  captureBlockingIssues(page, consoleIssues);

  const health = await page.request.get(`${apiBaseUrl}/api/system/health`);
  expect(health.ok()).toBe(true);

  await login(page, adminLogin, seededPassword);
  await page.getByRole('link', { name: /usuarios/i }).click();
  await expect(page.getByRole('heading', { name: /usuarios y permisos/i })).toBeVisible();

  const createUserButton = page.getByRole('button', { name: /^crear usuario$/i });
  await expect(createUserButton).toBeEnabled();
  await createUserButton.click();
  await expect(page.getByRole('dialog', { name: /crear usuario/i })).toBeVisible({ timeout: 30_000 });

  await page.getByLabel(/nombre completo/i).fill('Catalogo E2E Exacto');
  await page.getByLabel(/correo electr/i).fill(`${username}@hospital-san-isidro.local`);
  await page.getByLabel(/nombre de usuario/i).fill(username);
  await page.getByLabel(/contrase/i).fill(initialPassword);

  await leaveOnlyPermission(page, 'catalog.view');

  await page.getByRole('button', { name: /^crear usuario$/i }).click();
  await expect(page.getByRole('status').filter({ hasText: /usuario catalogo e2e exacto creado correctamente/i }).first()).toBeVisible();
  await expect(page.getByRole('dialog', { name: /crear usuario/i })).toBeHidden();
  await expect(page.getByRole('row', { name: new RegExp(username, 'i') })).toBeVisible();

  const createdPayload = await fetchJsonFromPage<{ data: { username: string; direct_permissions: string[]; permissions: string[] }[] }>(
    page,
    '/api/admin/users',
  );
  const createdUser = createdPayload.data.find((user) => user.username === username);
  expect(createdUser?.direct_permissions).toEqual(['catalog.view']);
  expect(createdUser?.permissions).toEqual(['catalog.view']);

  await logout(page);
  await login(page, username, initialPassword, /cambio obligatorio de contrase/i);
  await page.getByLabel(/contrase.a actual/i).fill(initialPassword);
  await page.getByLabel(/^nueva contrase/i).fill(changedPassword);
  await page.getByLabel(/confirmar nueva contrase/i).fill(changedPassword);
  await page.getByRole('button', { name: /actualizar contrase/i }).click();

  await expect(page.getByRole('link', { name: /cat.logo/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /nueva factura/i })).toBeHidden();
  await expect(page.getByRole('link', { name: /reportes/i })).toBeHidden();
  await expect(page.getByRole('link', { name: /usuarios/i })).toBeHidden();

  await page.getByRole('link', { name: /cat.logo/i }).click();
  await expect(page.getByRole('heading', { name: /cat.logo/i })).toBeVisible();

  await page.evaluate(() => {
    window.history.pushState({}, '', '/reports');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByText(/requiere permiso para consultar reportes/i)).toBeVisible();

  expect(consoleIssues, consoleIssues.join('\n')).toEqual([]);
});

async function login(page: Page, username: string, password: string, expectedHeading?: RegExp) {
  await page.goto(`${baseUrl}/login`);
  await page.getByLabel(/usuario|correo/i).fill(username);
  await page.getByRole('textbox', { name: /contrase(?:n|ñ)a|password/i }).fill(password);
  await page.getByRole('button', { name: /iniciar sesi(?:o|ó)n|entrar/i }).click();
  if (expectedHeading) {
    await expect(page.getByRole('heading', { name: expectedHeading })).toBeVisible({ timeout: 30_000 });
    return;
  }
  await expect(page.getByRole('button', { name: /men[uú] de usuario/i })).toBeVisible({ timeout: 30_000 });
}

async function logout(page: Page) {
  await page.getByRole('button', { name: /men[uú] de usuario/i }).click();
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/auth/logout') && response.ok()),
    page.getByRole('menuitem', { name: /cerrar sesi[oó]n/i }).click(),
  ]);
  await expect(page.locator('#login-input')).toBeVisible();
}

async function leaveOnlyPermission(page: Page, permission: string) {
  const permissionButtons = page.locator('button[id^="user-permission-"]');
  const count = await permissionButtons.count();

  for (let index = 0; index < count; index += 1) {
    const checkbox = permissionButtons.nth(index);
    if ((await checkbox.getAttribute('data-state')) === 'checked') {
      await checkbox.click();
    }
  }

  const id = `#user-permission-${permission.replace(/[^A-Za-z0-9_-]/g, '-')}`;
  const target = page.locator(id);
  await target.click();
  await expect(target).toHaveAttribute('data-state', 'checked');
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
    if (request.method() === 'GET' && failure?.errorText === 'net::ERR_ABORTED') {
      return;
    }

    consoleIssues.push(`requestfailed: ${request.method()} ${request.url()} ${failure?.errorText ?? ''}`.trim());
  });

  page.on('response', (response) => {
    const status = response.status();
    if ([401, 419, 422].includes(status) || status >= 500) {
      consoleIssues.push(`http.${status}: ${response.request().method()} ${response.url()}`);
    }
  });
}
