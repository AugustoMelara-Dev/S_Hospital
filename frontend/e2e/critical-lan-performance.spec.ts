import { expect, test, type Page, type Request } from '@playwright/test';

const baseUrl = process.env.E2E_REAL_BASE_URL?.replace(/\/$/, '');
const login = process.env.E2E_REAL_LOGIN;
const password = process.env.E2E_REAL_PASSWORD;

type CriticalRequest = {
  method: string;
  path: string;
  query: string;
  durationMs: number;
  status: number;
};

test.beforeAll(() => {
  const missing = [
    ['E2E_REAL_BASE_URL', baseUrl],
    ['E2E_REAL_LOGIN', login],
    ['E2E_REAL_PASSWORD', password],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missing.length > 0) {
    throw new Error(`Critical LAN performance requires ${missing.join(', ')}.`);
  }
});

test('critical requests are unique and complete below two seconds', async ({ page }, testInfo) => {
  const started = new Map<Request, { startedAt: number; path: string; query: string }>();
  const attempts: Array<Pick<CriticalRequest, 'method' | 'path' | 'query'>> = [];
  const completed: CriticalRequest[] = [];

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['/api/auth/login', '/api/system/setup-status', '/api/services'].includes(url.pathname)) return;

    attempts.push({
      method: request.method(),
      path: url.pathname,
      query: url.search,
    });
    started.set(request, {
      startedAt: Date.now(),
      path: url.pathname,
      query: url.search,
    });
  });
  page.on('response', (response) => {
    const timing = started.get(response.request());
    if (!timing) return;

    completed.push({
      method: response.request().method(),
      path: timing.path,
      query: timing.query,
      durationMs: Date.now() - timing.startedAt,
      status: response.status(),
    });
  });

  await loginToRealApp(page, completed);
  await expect.poll(
    () => completed.some((request) => request.path === '/api/system/setup-status'),
    { timeout: 30_000 },
  ).toBe(true);

  await page.goto(`${baseUrl}/billing/new`);
  await expect(page.getByRole('heading', { name: /nueva factura/i })).toBeVisible();
  await page.getByLabel(/buscar por nombre/i).fill('glucosa');
  await expect.poll(
    () => completed.some(
      (request) => request.path === '/api/services' && request.query.includes('search=glucosa'),
    ),
    { timeout: 20_000 },
  ).toBe(true);

  await testInfo.attach('critical-lan-requests', {
    body: JSON.stringify({ attempts, completed }, null, 2),
    contentType: 'application/json',
  });

  const loginAttempts = attempts.filter((request) => request.path === '/api/auth/login');
  const setupAttempts = attempts.filter((request) => request.path === '/api/system/setup-status');
  const initialServices = attempts.filter(
    (request) => request.path === '/api/services' && !request.query.includes('search='),
  );
  const searchedServices = completed.filter(
    (request) => request.path === '/api/services' && request.query.includes('search=glucosa'),
  );

  expect(loginAttempts, JSON.stringify({ attempts, completed }, null, 2)).toHaveLength(1);
  expect(setupAttempts, JSON.stringify({ attempts, completed }, null, 2)).toHaveLength(1);
  expect(initialServices, JSON.stringify({ attempts, completed }, null, 2)).toHaveLength(0);
  expect(searchedServices, JSON.stringify({ attempts, completed }, null, 2)).toHaveLength(1);
  expect(completed.every((request) => request.status >= 200 && request.status < 300)).toBe(true);
  expect(completed.every((request) => request.durationMs < 2000), JSON.stringify(completed, null, 2)).toBe(true);
});

async function loginToRealApp(page: Page, completed: CriticalRequest[]) {
  await page.context().clearCookies();
  await page.goto(`${baseUrl}/login`);
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.getByRole('textbox', { name: /usuario|correo|email/i }).fill(login ?? '');
  await page.getByRole('textbox', { name: /contrase(?:ñ|n)a|password/i }).fill(password ?? '');
  await page.getByRole('button', { name: /entrar|iniciar/i }).click();
  await expect.poll(
    () => completed.some((request) => request.path === '/api/auth/login'),
    { timeout: 20_000 },
  ).toBe(true);
  await expect(page.getByRole('link', { name: /nueva factura/i })).toBeVisible();
}
