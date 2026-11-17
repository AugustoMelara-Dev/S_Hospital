import { expect, test } from '@playwright/test';
import { login, trackErrors } from './helpers';

const FORBIDDEN = 'No tiene permiso para ver esta sección';

test('cajero: sin enlaces de Administración y 403 en /admin/usuarios', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, 'cajero');
  const nav = page.getByRole('navigation').first();
  await expect(nav.getByRole('link', { name: /Cobrar/ })).toBeVisible();
  for (const label of ['Catálogo', 'Usuarios', 'Ajustes', 'Respaldos', 'Auditoría']) {
    await expect(nav.getByRole('link', { name: new RegExp(label) })).toHaveCount(0);
  }
  await expect(nav.getByText('Administración', { exact: true })).toHaveCount(0);
  await page.goto('/admin/usuarios');
  await expect(page.getByText(FORBIDDEN)).toBeVisible();
  await page.goto('/admin/catalogo');
  await expect(page.getByText(FORBIDDEN)).toBeVisible();
  expect(errors).toEqual([]);
});

test('auditor: solo lectura', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, 'auditor');
  const nav = page.getByRole('navigation').first();
  await expect(nav.getByRole('link', { name: /Cobrar/ })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: /Recibos/ })).toBeVisible();

  await page.goto('/cobrar');
  await expect(page.getByText(FORBIDDEN)).toBeVisible();

  await page.goto('/recibos');
  await page.getByLabel('Paciente o número').fill('María López E2E');
  await page.getByRole('table', { name: 'Facturas y recibos' }).getByRole('row', { name: /María López E2E/ }).click();
  await expect(page).toHaveURL(/\/recibos\/\d+$/);
  await expect(page.getByText('Glucosa')).toBeVisible();
  for (const name of ['Anular', 'Revertir', 'Reimprimir', 'Registrar abono', 'Cobrar saldo']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  }

  await page.goto('/caja');
  await expect(page.getByRole('heading', { name: 'Caja', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abrir caja' })).toHaveCount(0);

  await page.goto('/admin/catalogo');
  await page.getByRole('textbox', { name: 'Buscar concepto' }).fill('Glucosa');
  await expect(page.getByRole('row', { name: /^Glucosa\b/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Editar / })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nuevo concepto' })).toHaveCount(0);

  await page.goto('/admin/ajustes');
  await expect(page.getByLabel('Teléfono')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toHaveCount(0);

  await page.goto('/admin/respaldos');
  await expect(page.getByRole('heading', { name: 'Respaldos', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Crear respaldo' })).toHaveCount(0);

  await page.goto('/admin/usuarios');
  await expect(page.getByText(FORBIDDEN)).toBeVisible();
  expect(errors).toEqual([]);
});
