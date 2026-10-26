import { expect, test } from '@playwright/test';

test.skip(process.env.E2E_RELEASE_ALLOW_MUTATIONS !== '1', 'Requires the isolated release laboratory.');

test('auditoría consulta al servidor por nombre y restablece la consulta al limpiar', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#login-input').fill(process.env.E2E_RELEASE_ADMIN_LOGIN ?? 'admin.e2e');
  await page.locator('#password-input').fill(process.env.E2E_RELEASE_ADMIN_PASSWORD ?? process.env.E2E_RELEASE_PASSWORD ?? '');
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
  await expect(page.getByRole('button', { name: /^salir$/i })).toBeVisible();
  const initial = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/system/audit-logs');
  await page.goto('/administracion/auditoria');
  expect((await initial).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Auditoría', exact: true })).toBeVisible();
  await page.getByLabel('Nombre o usuario').fill('ningun-usuario-sintetico-1022');
  const filtered = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return url.pathname === '/api/system/audit-logs' && url.searchParams.get('user') === 'ningun-usuario-sintetico-1022';
  });
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  const result = await filtered;
  expect(result.status()).toBe(200);
  expect((await result.json() as { meta: { total: number } }).meta.total).toBe(0);
  await expect(page.getByText('Sin eventos para estos filtros')).toBeVisible();
  await page.getByRole('button', { name: 'Limpiar', exact: true }).click();
  await expect(page.getByLabel('Nombre o usuario')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Aplicar filtros' })).toBeEnabled();
});
