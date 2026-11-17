import { expect, test } from '@playwright/test';
import { expectNoBrokenText, login, trackErrors } from './helpers';

test.describe.configure({ mode: 'serial' });

test('catálogo: cambio de precio con motivo queda en el historial', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, 'admin');
  await page.goto('/admin/catalogo');
  await page.getByRole('textbox', { name: 'Buscar concepto' }).fill('Glucosa');
  const row = page.getByRole('row', { name: /^Glucosa\b/ });
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: 'Editar Glucosa' }).click();

  const drawer = page.getByRole('dialog', { name: 'Editar concepto' });
  await drawer.getByRole('textbox', { name: 'Precio', exact: true }).fill('17.50');
  await drawer.getByLabel('Motivo del cambio de precio').fill('Ajuste de tarifa 2026');
  await drawer.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Concepto actualizado.')).toBeVisible();
  await expect(row).toContainText('L 17.50');

  await row.getByRole('button', { name: 'Historial de precios de Glucosa' }).click();
  const history = page.getByRole('dialog', { name: 'Historial de precios' });
  const entry = history.getByRole('row', { name: /Ajuste de tarifa 2026/ });
  await expect(entry).toContainText('L 15.00');
  await expect(entry).toContainText('L 17.50');
  await expect(entry).toContainText('Administración Demo');
  await expectNoBrokenText(page);
  expect(errors).toEqual([]);
});

test('usuarios: crear cajero y su primer ingreso obliga a cambiar la clave', async ({ page, browser }) => {
  const errors = trackErrors(page);
  await login(page, 'admin');
  await page.goto('/admin/usuarios');
  await page.getByRole('button', { name: 'Crear usuario' }).click();
  const drawer = page.getByRole('dialog', { name: 'Crear usuario' });
  await drawer.getByLabel('Nombre completo').fill('Carla Nueva E2E');
  await drawer.getByRole('textbox', { name: 'Usuario', exact: true }).fill('carla.e2e');
  await drawer.getByLabel('Contraseña inicial').fill('Inicial#2026x');
  await drawer.getByRole('combobox', { name: 'Rol' }).selectOption({ label: 'Caja' });
  await drawer.getByRole('button', { name: 'Crear usuario' }).click();
  const row = page.getByRole('row', { name: /Carla Nueva E2E/ });
  await expect(row).toBeVisible();
  await expect(row).toContainText('Cambio de clave pendiente');
  await expectNoBrokenText(page);
  expect(errors).toEqual([]);

  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await login(p2, 'carla.e2e', 'Inicial#2026x');
  await expect(p2).toHaveURL(/\/cambiar-clave/);
  await p2.getByLabel('Contraseña actual').fill('Inicial#2026x');
  await p2.getByLabel('Nueva contraseña').fill('Carla#Segura2026');
  await p2.getByLabel('Confirmar contraseña').fill('Carla#Segura2026');
  await p2.getByRole('button', { name: 'Actualizar contraseña' }).click();
  await expect(p2).not.toHaveURL(/\/cambiar-clave/);
  await expect(p2.getByRole('navigation').first().getByRole('link', { name: /Cobrar/ })).toBeVisible();
  await ctx.close();
});

test('ajustes: la edición de identidad persiste', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, 'admin');
  await page.goto('/admin/ajustes');
  const phone = page.getByLabel('Teléfono');
  await expect(phone).toBeVisible();
  await phone.fill('2222-0000 ext. 15');
  await page.getByLabel('Lema').fill('Servimos con calidez E2E');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText(/guardad|actualizad/i).first()).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Teléfono')).toHaveValue('2222-0000 ext. 15');
  await expect(page.getByLabel('Lema')).toHaveValue('Servimos con calidez E2E');
  await expectNoBrokenText(page);
  expect(errors).toEqual([]);
});

test('respaldos: crear respaldo termina como correcto', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, 'admin');
  await page.goto('/admin/respaldos');
  await expect(page.getByRole('heading', { name: 'Estado del sistema' })).toBeVisible();
  await page.getByRole('button', { name: 'Crear respaldo' }).click();
  await page.getByRole('dialog', { name: 'Crear respaldo' }).getByRole('button', { name: 'Crear respaldo' }).click();
  const table = page.getByRole('table', { name: 'Historial de respaldos' });
  await expect(table.getByText('Correcto').first()).toBeVisible({ timeout: 30_000 });
  await expectNoBrokenText(page);
  expect(errors).toEqual([]);
});

test('auditoría: lista las acciones realizadas', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, 'admin');
  await page.goto('/admin/auditoria');
  const table = page.getByRole('table', { name: 'Registro de auditoría' });
  await expect(table.getByText('Cambio de precio').first()).toBeVisible();
  await expect(table.getByText('Usuario creado').first()).toBeVisible();
  await expect(table.getByText('Respaldo solicitado').first()).toBeVisible();
  await page.getByLabel('Acción').selectOption({ label: 'Anulación de factura' });
  const voided = table.getByRole('row', { name: /Anulación de factura/ });
  await expect(voided).toHaveCount(1);
  await expect(voided).toContainText('Paciente duplicado en caja');
  await voided.click();
  await expect(page.getByRole('dialog', { name: 'Anulación de factura' })).toBeVisible();
  await expectNoBrokenText(page);
  expect(errors).toEqual([]);
});
