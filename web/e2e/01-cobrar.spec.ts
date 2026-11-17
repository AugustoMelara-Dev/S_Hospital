import { expect, test } from '@playwright/test';
import { closePopups, expectNoBrokenText, expectResponseType, login, trackErrors } from './helpers';

test.describe.configure({ mode: 'serial' });

test('cajero abre caja con L 500.00', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, 'cajero');
  await page.goto('/caja');
  await expect(page.getByRole('heading', { name: 'Apertura de caja' })).toBeVisible();
  await page.getByLabel('Monto inicial (L)').fill('500');
  await page.getByRole('button', { name: 'Abrir caja' }).click();
  await expect(page.getByRole('tab', { name: 'Arqueo' })).toBeVisible();
  await expect(page.locator('main')).toContainText('L 500.00');
  await expectNoBrokenText(page);
  expect(errors).toEqual([]);
});

test('cobrar: paciente, 2 conceptos por teclado, cantidad, ISV, efectivo con cambio e impresión', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, 'cajero');
  await page.goto('/cobrar');

  const patient = page.getByLabel('Nombre del paciente');
  await expect(patient).toBeFocused();
  await patient.fill('María López E2E');
  await patient.press('Enter');

  const search = page.getByRole('combobox', { name: 'Buscar concepto' });
  const account = page.getByRole('table', { name: 'Conceptos de la cuenta' });
  await expect(search).toBeFocused();
  await search.pressSequentially('Glucosa');
  await search.press('Enter');
  await expect(account.getByRole('row', { name: /Glucosa/ })).toBeVisible();
  await expect(search).toBeFocused();
  await search.pressSequentially('Hemograma Completo');
  await search.press('Enter');
  await expect(account.getByRole('row', { name: /Hemograma Completo/ })).toBeVisible();

  // Quantity of Glucosa: 1 → 2 with the keyboard.
  const qty = page.getByLabel('Cantidad de Glucosa', { exact: true });
  await qty.focus();
  await qty.press('ArrowUp');
  await expect(qty).toHaveValue(/^2(\.00)?$/);

  // 2 × 15.00 + 35.00 = 65.00 gravado, ISV 15 % = 9.75, total 74.75.
  const totals = page.getByRole('complementary', { name: 'Total de la operación' });
  await expect(totals.getByText('ISV 15 %')).toBeVisible();
  await expect(totals).toContainText('L 9.75');
  await expect(totals).toContainText('L 74.75');
  await expect(page.getByTestId('cobrar-status')).toHaveText('Listo para cobrar');

  await page.keyboard.press('F4');
  const dialog = page.getByRole('dialog', { name: 'Confirmar cobro' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Efectivo recibido').fill('100');
  await expect(dialog.getByTestId('payment-change')).toHaveText('L 25.25');
  await dialog.getByRole('button', { name: /Confirmar cobro/ }).click();

  await expect(page.getByRole('heading', { name: 'Operación cobrada' })).toBeVisible();
  await expect(page.locator('main')).toContainText('L 25.25');
  await expect(page.locator('main')).toContainText('María López E2E');
  await expectNoBrokenText(page);

  await expectResponseType(page, /\/api\/receipts\/\d+\/pdf/, /application\/pdf/, () =>
    page.getByRole('button', { name: 'Imprimir recibo' }).click(),
  );
  await closePopups(page);
  expect(errors).toEqual([]);
});

test('EPO: receta de diálisis deja la eritropoyetina sin cobro', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, 'cajero');
  await page.goto('/cobrar');
  await page.getByLabel('Nombre del paciente').fill('Paciente Diálisis E2E');
  await page.getByLabel('Nombre del paciente').press('Enter');
  const search = page.getByRole('combobox', { name: 'Buscar concepto' });
  const account = page.getByRole('table', { name: 'Conceptos de la cuenta' });
  await search.pressSequentially('Eritropoyetina');
  await search.press('Enter');
  await expect(account.getByRole('row', { name: /Eritropoyetina/ })).toBeVisible();
  await search.pressSequentially('Hemograma Completo');
  await search.press('Enter');
  await expect(account.getByRole('row', { name: /Hemograma Completo/ })).toBeVisible();

  const totals = page.getByRole('complementary', { name: 'Total de la operación' });
  // 25.00 + 35.00 = 60.00 + ISV 9.00 = 69.00 before the prescription.
  await expect(totals).toContainText('L 69.00');

  await page.getByLabel('Paciente con receta de diálisis').check();
  const epoRow = account.getByRole('row', { name: /Eritropoyetina/ });
  await expect(epoRow.getByText('Sin cobro por receta')).toBeVisible();
  // Only the Hemograma remains: 35.00 + ISV 5.25 = 40.25.
  await expect(totals).toContainText('L 40.25');
  await expect(totals).not.toContainText('L 69.00');

  await page.keyboard.press('F4');
  const dialog = page.getByRole('dialog', { name: 'Confirmar cobro' });
  await dialog.getByRole('button', { name: /Confirmar cobro · L 40\.25/ }).click();
  await expect(page.getByRole('heading', { name: 'Operación cobrada' })).toBeVisible();
  await expectNoBrokenText(page);
  expect(errors).toEqual([]);
});
