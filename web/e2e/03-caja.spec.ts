import { expect, test } from '@playwright/test';
import { closePopups, expectNoBrokenText, expectResponseType, login, trackErrors } from './helpers';

test('caja: movimientos, arqueo con diferencia, cierre con nota y resumen PDF', async ({ page }) => {
  const errors = trackErrors(page);
  await login(page, 'cajero');
  await page.goto('/caja');

  // Expected cash: opening 500.00 + 74.75 + 40.25 (cash payments of 01-cobrar) = 615.00.
  await page.getByRole('tab', { name: 'Movimientos' }).click();
  const movements = page.getByRole('tabpanel');
  await expect(movements).toContainText('L 74.75');
  await expect(movements).toContainText('L 40.25');
  await expectNoBrokenText(page);

  await page.getByRole('tab', { name: 'Arqueo' }).click();
  await page.getByLabel('Cantidad de billetes de L 500', { exact: true }).fill('1');
  await page.getByLabel('Cantidad de billetes de L 100', { exact: true }).fill('1');
  await page.getByLabel('Cantidad de billetes de L 10', { exact: true }).fill('1');
  await page.getByLabel('Monedas y otros').fill('4.50');
  const result = page.getByRole('complementary', { name: 'Resultado del arqueo' });
  await expect(result).toContainText('L 615.00');
  await expect(result).toContainText('L 614.50');
  const diff = page.getByTestId('arqueo-diferencia');
  await expect(diff).toContainText('Faltante');
  await expect(diff).toContainText('L 0.50');

  await page.getByRole('button', { name: 'Continuar al cierre' }).click();
  await page.getByLabel('Nota de cierre').fill('Faltan 50 centavos en monedas');
  await page.getByRole('button', { name: 'Cerrar caja' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cierre de caja' });
  await dialog.getByRole('button', { name: 'Cerrar caja' }).click();

  const turno = page.getByRole('region', { name: 'Turno actual' });
  await expect(turno.getByRole('button', { name: 'Imprimir resumen' })).toBeVisible();
  const main = page.locator('main');
  await expect(main).toContainText('Faltan 50 centavos en monedas');
  await expect(main).toContainText('Faltante');
  await expect(main).toContainText('L 614.50');
  await expectNoBrokenText(page);

  await expectResponseType(page, /\/api\/cash-sessions\/\d+\/summary\.pdf/, /application\/pdf/, () =>
    turno.getByRole('button', { name: 'Imprimir resumen' }).click(),
  );
  await closePopups(page);
  expect(errors).toEqual([]);
});
