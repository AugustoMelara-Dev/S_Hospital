import { expect, test } from '@playwright/test';
import {
  apiAs,
  closePopups,
  createUnpaidInvoice,
  ensureCashOpen,
  expectNoBrokenText,
  expectResponseType,
  idemKey,
  login,
  serviceId,
  trackErrors,
} from './helpers';

test.describe.configure({ mode: 'serial' });

test('recibos: buscar por paciente, ver detalle, imprimir y reimprimir con motivo', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, 'cajero');
  await page.goto('/recibos');
  await page.getByLabel('Paciente o número').fill('María López E2E');
  const table = page.getByRole('table', { name: 'Facturas y recibos' });
  const row = table.getByRole('row', { name: /María López E2E/ });
  await expect(row).toHaveCount(1);
  await expect(row.getByText('Pagada')).toBeVisible();
  await row.click();

  await expect(page).toHaveURL(/\/recibos\/\d+$/);
  await expect(page.getByText('María López E2E').first()).toBeVisible();
  await expect(page.getByText('Emitido', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/LEMPIRAS/i)).toBeVisible();
  await expect(page.getByText('Glucosa')).toBeVisible();
  await expect(page.locator('main')).toContainText('L 74.75');
  await expectNoBrokenText(page);

  await expectResponseType(page, /\/api\/receipts\/\d+\/pdf/, /application\/pdf/, () =>
    page.getByRole('button', { name: 'Imprimir recibo' }).click(),
  );
  await closePopups(page);

  await page.getByRole('button', { name: 'Reimprimir' }).click();
  const dialog = page.getByRole('dialog', { name: 'Reimprimir recibo' });
  await dialog.getByLabel(/Motivo de reimpresión/).fill('Paciente extravió el original');
  await expectResponseType(page, /\/api\/receipts\/\d+\/reprint/, /application\/pdf/, () =>
    dialog.getByRole('button', { name: 'Reimprimir' }).click(),
  );
  await expect(page.getByText('Reimpresión registrada.')).toBeVisible();
  await closePopups(page);
  expect(errors).toEqual([]);
});

test('recibos: factura pendiente creada por API se anula con motivo (supervisor)', async ({ page, baseURL }) => {
  const cajero = await apiAs(baseURL!, 'cajero');
  await ensureCashOpen(cajero);
  const inv = await createUnpaidInvoice(cajero, 'Pendiente Anular E2E');
  await cajero.dispose();

  const errors = trackErrors(page);
  await login(page, 'supervisor');
  await page.goto('/recibos');
  await page.getByLabel('Estado').selectOption({ label: 'Pendiente de cobro' });
  await page.getByLabel('Paciente o número').fill('Pendiente Anular');
  const row = page.getByRole('table', { name: 'Facturas y recibos' }).getByRole('row', { name: /Pendiente Anular E2E/ });
  await expect(row).toHaveCount(1);
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/recibos/${inv.id}$`));
  await expect(page.getByText(inv.number).first()).toBeVisible();

  await page.getByRole('button', { name: 'Anular' }).click();
  const dialog = page.getByRole('dialog', { name: 'Anular factura' });
  await dialog.getByLabel(/Motivo de anulación/).fill('Paciente duplicado en caja');
  await dialog.getByRole('button', { name: 'Anular factura' }).click();
  await expect(page.getByText('Factura anulada.')).toBeVisible();
  await expect(page.getByRole('note')).toContainText('Motivo: Paciente duplicado en caja');
  await expect(page.getByRole('button', { name: 'Anular' })).toHaveCount(0);
  await expectNoBrokenText(page);
  expect(errors).toEqual([]);
});

test('recibos: filtro "Emitida sin cobro" usa el estado del API', async ({ page, baseURL }) => {
  const cajero = await apiAs(baseURL!, 'cajero');
  await ensureCashOpen(cajero);
  const epo = await serviceId(cajero, 'Eritropoyetina');
  const res = await cajero.post('/api/invoices', {
    data: { patient_name: 'Sin Cobro E2E', items: [{ service_id: epo, quantity_hundredths: 100 }], dialysis_prescription: true },
    headers: { 'Idempotency-Key': idemKey() },
  });
  expect(res.status(), await res.text()).toBe(201);
  expect(((await res.json()) as { settlement: string }).settlement).toBe('free_by_rule');
  await cajero.dispose();

  await login(page, 'cajero');
  await page.goto('/recibos');
  const [listRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/invoices?') && r.url().includes('status=without_charge')),
    page.getByLabel('Estado').selectOption({ label: 'Emitida sin cobro' }),
  ]);
  expect(listRes.status()).toBe(200);
  const table = page.getByRole('table', { name: 'Facturas y recibos' });
  await expect(table.getByRole('row', { name: /Sin Cobro E2E/ })).toBeVisible();
  await expect(table.getByRole('row', { name: /María López E2E/ })).toHaveCount(0);
});
