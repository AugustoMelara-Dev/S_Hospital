import { expect, test } from '@playwright/test';

// Solo laboratorio sintético preparado. No cambia usuarios, permisos ni caja.
test.skip(process.env.E2E_RELEASE_ALLOW_MUTATIONS !== '1', 'Requires the isolated release laboratory.');

test('cashier report is scoped from its first request and ignores foreign URL scopes', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#login-input').fill(process.env.E2E_RELEASE_LOGIN ?? 'cajero.e2e');
  await page.locator('#password-input').fill(process.env.E2E_RELEASE_PASSWORD ?? '');
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
  await expect(page.getByRole('button', { name: /^salir$/i })).toBeVisible();

  const response = await page.request.get('/api/cash-sessions/current');
  expect(response.ok()).toBe(true);
  const { data: session } = await response.json() as { data: { id: number } | null };
  expect(session, 'Prepared cashier must have an open synthetic session').not.toBeNull();

  const requests: URL[] = [];
  const statuses: number[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/reports/executive') requests.push(url);
  });
  page.on('response', (result) => {
    if (new URL(result.url()).pathname === '/api/reports/executive') statuses.push(result.status());
  });

  for (const path of ['/reportes', '/reportes?cash_session_id=999999&user_id=999999']) {
    const report = page.waitForResponse((result) => new URL(result.url()).pathname === '/api/reports/executive');
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1, name: /^reportes$/i })).toBeVisible();
    expect((await report).status()).toBe(200);
    await page.waitForLoadState('networkidle');
  }

  expect(requests.length).toBeGreaterThanOrEqual(2);
  for (const url of requests) {
    expect(url.searchParams.get('cash_session_id')).toBe(String(session!.id));
    expect(url.searchParams.has('user_id')).toBe(false);
  }
  expect(statuses.every((status) => status === 200)).toBe(true);
});
