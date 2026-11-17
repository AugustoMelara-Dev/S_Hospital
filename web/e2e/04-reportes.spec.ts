import { expect, test } from '@playwright/test';
import { expectNoBrokenText, login, trackErrors } from './helpers';

test('reportes (supervisor): resumen del mes con las operaciones y exportación a Excel', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, 'supervisor');
  await page.goto('/reportes');
  await expect(page.getByText('Todas las cajas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Este mes' })).toHaveAttribute('aria-pressed', 'true');

  // 74.75 + 40.25 + 0.00 (sin cobro); the voided invoice is excluded.
  await expect(page.getByRole('group', { name: 'Facturado' })).toContainText('L 115.00');

  const ops = page.getByRole('table', { name: 'Operaciones' });
  await expect(ops.getByRole('row', { name: /María López E2E/ })).toBeVisible();
  await expect(ops.getByRole('row', { name: /Paciente Diálisis E2E/ })).toBeVisible();
  await expect(ops.getByRole('row', { name: /Pendiente Anular E2E/ })).toContainText('Anulada');
  await expect(ops.getByRole('row', { name: /María López E2E/ })).toContainText('Cajero Demo');
  await expectNoBrokenText(page);

  await page.getByRole('tab', { name: /Gratuidades/ }).click();
  await expect(page.getByRole('table', { name: 'Gratuidades' })).toContainText('Eritropoyetina');
  await page.getByRole('tab', { name: /^Caja/ }).click();
  await expect(page.getByRole('table', { name: 'Turnos de caja' })).toContainText('Faltante');
  await expectNoBrokenText(page);

  const [download, res] = await Promise.all([
    page.waitForEvent('download'),
    page.waitForResponse((r) => r.url().includes('/api/reports/summary.xlsx')),
    page.getByRole('button', { name: 'Exportar Excel' }).click(),
  ]);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('spreadsheetml');
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/);

  // Status filter "Emitida sin cobro" maps to the API value without_charge.
  await page.getByRole('tab', { name: /Operaciones/ }).click();
  await page.getByLabel('Estado').selectOption({ label: 'Emitida sin cobro' });
  const [filtered] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/reports/summary?') && r.url().includes('status=without_charge')),
    page.getByRole('button', { name: 'Aplicar' }).click(),
  ]);
  expect(filtered.status()).toBe(200);
  await expect(ops.getByRole('row', { name: /Sin Cobro E2E/ })).toBeVisible();
  await expect(ops.getByRole('row', { name: /María López E2E/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});
