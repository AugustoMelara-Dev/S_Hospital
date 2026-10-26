import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test.skip(process.env.E2E_RELEASE_ALLOW_MUTATIONS !== '1', 'Requires the isolated release laboratory.');

async function saveProfile(page: Page) {
  const saved = page.waitForResponse((response) => response.request().method() === 'PATCH'
    && /\/print-profiles\/\d+$/.test(new URL(response.url()).pathname));
  await page.getByRole('button', { name: /^guardar perfil$/i }).click();
  const response = await saved;
  expect(response.ok(), await response.text()).toBe(true);
  return response;
}

test('basic paper saves without technical fields and custom activation requires a visible reason', async ({ page }, testInfo) => {
  const serverErrors: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('/login');
  await page.locator('#login-input').fill(process.env.E2E_RELEASE_ADMIN_LOGIN ?? 'admin.e2e');
  await page.locator('#password-input').fill(process.env.E2E_RELEASE_PASSWORD ?? '');
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
  await expect(page.getByRole('button', { name: /^salir$/i })).toBeVisible();
  await page.goto('/administracion/ajustes?panel=impresion');
  await page.getByRole('radio', { name: 'A5', exact: true }).check();
  const standard = await saveProfile(page);
  expect(standard.request().postDataJSON()).not.toHaveProperty('support_reason');
  expect(standard.request().postDataJSON()).not.toHaveProperty('width_mm');

  await page.getByRole('radio', { name: 'Personalizado', exact: true }).check();
  await page.getByRole('button', { name: /^guardar perfil$/i }).click();
  await expect(page.getByRole('button', { name: 'Ajustes técnicos avanzados', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Documente el motivo de soporte.', { exact: true })).toBeVisible();
  await page.getByLabel('Motivo de soporte', { exact: true }).fill('QA entrega: comprobar activación del formato personalizado.');
  const savedCustomPreview = page.waitForResponse((response) => {
    if (!response.url().endsWith('/api/settings/institutional-receipts/test-preview')
      || response.request().method() !== 'POST') return false;
    const payload = response.request().postDataJSON() as { profile_code?: string; draft?: unknown };
    return payload.profile_code === 'recibo_pequeno_personalizado' && !payload.draft;
  });
  const custom = await saveProfile(page);
  const customBody = await custom.json() as { data: { code: string } };
  expect(customBody.data.code).toBe('recibo_pequeno_personalizado');
  expect(custom.request().postDataJSON()).toHaveProperty('support_reason');
  const previewResponse = await savedCustomPreview;
  expect(previewResponse.status(), await previewResponse.text()).toBe(200);

  const csrf = (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN');
  expect(csrf).toBeDefined();
  const headers = { 'X-XSRF-TOKEN': decodeURIComponent(csrf!.value), Accept: 'application/json' };
  const before = await (await page.request.get('/api/settings/institutional-receipts')).json();
  const customProfile = before.data.print_profiles.find((profile: { code: string }) => profile.code === customBody.data.code);
  for (const draft of [undefined, { copies_mode: 'original_first' }]) {
    const response = await page.request.post('/api/settings/institutional-receipts/test-preview', {
      headers,
      data: {
        profile_code: customBody.data.code,
        payer_name: 'Prueba de geometría personalizada',
        amount: '25.00',
        ...(draft ? { draft } : {}),
      },
    });
    expect(response.status(), await response.text()).toBe(200);
    const result = await response.json();
    expect(result.data.reserved_number).toBe(false);
    expect(result.data.document.paper.kind).toBe('custom_mm');
    expect(result.data.document.paper.width_pt).toBeCloseTo(Number(customProfile.width_mm) * 72 / 25.4, 1);
    expect(result.data.document.paper.height_pt).toBeCloseTo(Number(customProfile.height_mm) * 72 / 25.4, 1);
  }
  const printed = await page.request.post('/api/settings/institutional-receipts/test-print', {
    headers,
    data: { profile_code: customBody.data.code, payer_name: 'Prueba PDF personalizada', amount: '25.00' },
  });
  expect(printed.status()).toBe(200);
  expect(printed.headers()['content-type']).toContain('application/pdf');
  const pdf = await printed.body();
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  await writeFile(testInfo.outputPath('custom-test-print.pdf'), pdf);
  const after = await (await page.request.get('/api/settings/institutional-receipts')).json();
  expect(after.data.active_series.current_number).toBe(before.data.active_series.current_number);
  expect(after.data.print_profiles.find((profile: { code: string }) => profile.code === customBody.data.code).width_mm).toBe(customProfile.width_mm);

  // Restaurar un formato institucional estándar únicamente en el laboratorio.
  await page.getByRole('radio', { name: 'Carta vertical', exact: true }).check();
  const restored = await saveProfile(page);
  expect(restored.request().postDataJSON()).not.toHaveProperty('support_reason');
  await page.waitForLoadState('networkidle');
  expect(serverErrors).toEqual([]);
});
