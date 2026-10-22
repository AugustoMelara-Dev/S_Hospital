import { expect, test, type Page } from '@playwright/test';
import { assertStrictMockGuard, installStrictMockGuard } from './fixtures/strict-mock-guard';
import {
  installCatalog,
  installAdminApi,
  type CatalogCategory,
  type CatalogService,
  type AdminTestUser,
} from './fixtures/admin-e2e';

/**
 * T-UI-12 — Regresión de layout del buscador de catálogo de Cobrar.
 *
 * Hallazgo MEDIUM de T-QA-02: en escritorio el `select` de categoría y el botón
 * "Agregar primero" consumían la fila y el input medía 0 px. Aquí se mide su
 * ancho real (no solo visibilidad) y se comprueba que sigue escribiendo/filtrando.
 */

test.beforeEach(async ({ page }) => installStrictMockGuard(page));
test.afterEach(async ({ page }) => assertStrictMockGuard(page));

const CASHIER: AdminTestUser = {
  id: 71,
  name: 'Cajera Facturacion',
  email: 'facturacion@hospital.local',
  username: 'facturacion.caja',
  active: true,
  roles: ['cashier'],
  permissions: [
    'catalog.view',
    'cash.view',
    'invoices.create',
    'invoices.view',
    'payments.create',
    'receipts.view',
  ],
  must_change_password: false,
};

const CATEGORY: CatalogCategory = { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true };

const GLUCOSE: CatalogService = {
  id: 11,
  category_id: 1,
  name: 'Glucosa basal',
  slug: 'glucosa-basal',
  price: '15.00',
  taxable: true,
  active: true,
  visible_in_billing: true,
  is_billable: true,
  special_rule_code: null,
  category: { id: 1, name: 'Laboratorio' },
};

const ERYTHROPOIETIN: CatalogService = {
  id: 33,
  category_id: 1,
  name: 'Eritropoyetina',
  slug: 'eritropoyetina',
  price: '2500.00',
  taxable: false,
  active: true,
  visible_in_billing: true,
  is_billable: true,
  special_rule_code: null,
  category: { id: 1, name: 'Laboratorio' },
};

async function measureSearchWidth(page: Page): Promise<number> {
  const input = page.locator('#cobrar-catalog-search');
  await expect(input).toBeVisible();
  const box = await input.boundingBox();
  expect(box, 'el buscador debe tener caja de layout').not.toBeNull();
  return box?.width ?? 0;
}

async function openCatalog(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await installAdminApi(page, { user: CASHIER, cashSession: null });
  await installCatalog(page, { categories: [CATEGORY], services: [GLUCOSE, ERYTHROPOIETIN] });
  await page.goto('/cobrar');
  await expect(page.getByRole('heading', { level: 1, name: /^cobrar$/i })).toBeVisible();
}

test('el buscador conserva ancho útil en escritorio y móvil', async ({ page }) => {
  await openCatalog(page, { width: 1366, height: 768 });

  const desktopWidth = await measureSearchWidth(page);
  expect(desktopWidth, 'ancho real del buscador en 1366×768').toBeGreaterThan(120);

  // El control sigue operativo: escribir filtra el catálogo del servidor.
  await page.locator('#cobrar-catalog-search').fill('Glucosa');
  await expect(page.getByRole('button', { name: /agregar glucosa basal/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /agregar eritropoyetina/i })).toHaveCount(0);

  // En móvil el campo se apila pero no se aplasta.
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileWidth = await measureSearchWidth(page);
  expect(mobileWidth, 'ancho real del buscador en 390 px').toBeGreaterThan(120);
});
