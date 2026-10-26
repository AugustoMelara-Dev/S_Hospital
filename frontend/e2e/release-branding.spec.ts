import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test.skip(process.env.E2E_RELEASE_ALLOW_MUTATIONS !== '1', 'Requires the isolated release laboratory.');

async function post(page: Page, path: string, data: unknown) {
  return page.evaluate(async ({ path, data }) => {
    const token = decodeURIComponent(document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='))?.slice(11) ?? '');
    const response = await fetch(path, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token, 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(data) });
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    return response.json();
  }, { path, data });
}

async function saveHospitalName(page: Page, name: string) {
  await page.goto('/administracion/ajustes?panel=identidad');
  const input = page.getByRole('textbox', { name: 'Nombre del hospital', exact: true });
  await expect(input).toBeEditable();
  if (await input.inputValue() === name) return;
  await input.fill(name);
  const saved = page.waitForResponse((response) => response.request().method() === 'PUT'
    && new URL(response.url()).pathname === '/api/settings/fiscal');
  await page.getByRole('button', { name: 'Guardar datos del hospital', exact: true }).click();
  expect((await saved).status()).toBe(200);
  await expect(input).toHaveValue(name);
}

test('saved hospital name immediately reaches navigation, reload and a new paid receipt', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.goto('/login');
  await page.locator('#login-input').fill(process.env.E2E_RELEASE_ADMIN_LOGIN ?? 'admin.e2e');
  await page.locator('#password-input').fill(process.env.E2E_RELEASE_PASSWORD ?? '');
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/resumen$/);
  const original = (await (await page.request.get('/api/settings/fiscal')).json()).data as { hospital_name: string };
  const name = original.hospital_name === 'Hospital General San Isidro' ? 'Hospital San Isidro' : 'Hospital General San Isidro';
  let opened = false;
  try {
    await saveHospitalName(page, name);
    await expect(page.getByRole('link', { name: `${name} — inicio`, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: `${name} — inicio`, exact: true })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('banner').getByText(name, { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 1366, height: 768 });
    const current = (await (await page.request.get('/api/cash-sessions/current')).json()).data;
    expect(current, 'Administrator starts without a cash session in the laboratory').toBeNull();
    const registers = (await (await page.request.get('/api/cash-registers')).json()).data as Array<{ id: number; active: boolean }>;
    const sessionsResponse = await page.request.get('/api/cash-sessions?status=open&per_page=50');
    expect(sessionsResponse.status()).toBe(200);
    const sessions = (await sessionsResponse.json()).data as Array<{ cash_register_id: number | null }>;
    const occupied = new Set(sessions.map((session) => session.cash_register_id));
    const register = registers.find((item) => item.active && !occupied.has(item.id));
    expect(register, 'Branding needs an available register without taking the cashier release fixture').toBeTruthy();
    await post(page, '/api/cash-sessions/open', { cash_register_id: register!.id, opening_amount: '0.00' });
    opened = true;
    await page.goto('/cobrar');
    await page.getByLabel(/nombre del paciente/i).fill(`QA identidad ${Date.now()}`);
    await page.getByRole('searchbox', { name: /buscar servicio o producto/i }).fill('F3 concepto 0');
    await page.getByRole('button', { name: 'Agregar resultado: F3 concepto 0', exact: true }).click();
    await page.getByTestId('cobrar-primary-action').click();
    const dialog = page.getByRole('dialog', { name: /confirmar cobro/i });
    await dialog.getByRole('button', { name: /monto exacto/i }).click();
    const paid = page.waitForResponse((response) => response.request().method() === 'POST' && /\/invoices\/\d+\/payments$/.test(new URL(response.url()).pathname));
    await dialog.getByTestId('cobrar-confirm').click();
    const paidResponse = await paid;
    expect(paidResponse.ok()).toBe(true);
    const result = (await paidResponse.json()).data as { invoice: { id: number; hospital_name: string }; institutional_receipt: { id: number; institution_snapshot: { hospital_name: string } } };
    expect(result.invoice.hospital_name).toBe(name);
    expect(result.institutional_receipt.institution_snapshot.hospital_name).toBe(name);
    const pdf = await page.request.get(`/api/institutional-receipts/${result.institutional_receipt.id}/pdf`);
    expect(pdf.status()).toBe(200);
    const bytes = await pdf.body();
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
    await writeFile(testInfo.outputPath('branding-receipt.pdf'), bytes);
    await writeFile(testInfo.outputPath('branding-proof.json'), JSON.stringify(result, null, 2));
    await testInfo.attach('receipt-pdf', { body: bytes, contentType: 'application/pdf' });
    await testInfo.attach('branding-proof', { body: JSON.stringify(result), contentType: 'application/json' });
  } finally {
    try {
      if (opened) {
        const session = (await (await page.request.get('/api/cash-sessions/current')).json()).data;
        if (session) await post(page, `/api/cash-sessions/${session.id}/close`, { closing_amount: session.expected_cash_amount ?? session.expected_amount, notes: 'QA identidad: cierre conciliado.' });
      }
    } finally {
      await page.setViewportSize({ width: 1366, height: 768 });
      await saveHospitalName(page, original.hospital_name);
      const restored = (await (await page.request.get('/api/settings/fiscal')).json()).data;
      expect(restored.hospital_name).toBe(original.hospital_name);
    }
  }
});
