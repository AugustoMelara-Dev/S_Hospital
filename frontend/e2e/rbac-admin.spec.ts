import { expect, test } from '@playwright/test';
import { assertStrictMockGuard, installStrictMockGuard } from './fixtures/strict-mock-guard';
import { installAdminApi, openCashSessionFixture, type AdminTestUser } from './fixtures/admin-e2e';

/**
 * RBAC — rutas del producto nuevo por permiso y redirecciones de las rutas R2.
 * El usuario mínimo solo tiene `cash.view`: las secciones que exigen más
 * permisos quedan bloqueadas por PermissionGate sin contactar al backend.
 */

test.beforeEach(async ({ page }) => installStrictMockGuard(page));
test.afterEach(async ({ page }) => assertStrictMockGuard(page));

const LIMITED: AdminTestUser = {
  id: 90,
  name: 'Usuario Limitado',
  email: 'limitado@hospital.local',
  username: 'limitado.local',
  active: true,
  roles: ['consulta'],
  permissions: ['cash.view'],
  must_change_password: false,
};

test.describe('RBAC — secciones primarias por permiso', () => {
  test('bloquea Cobrar, Recibos y Reportes sin permiso y solo muestra las secciones autorizadas', async ({ page }) => {
    await installAdminApi(page, { user: LIMITED, cashSession: openCashSessionFixture() });

    await page.goto('/cobrar');
    await expect(page.getByRole('heading', { name: /sin permisos/i })).toBeVisible();
    await expect(page.getByText(/cajero completo/i)).toBeVisible();

    await page.goto('/recibos');
    await expect(page.getByRole('heading', { name: /sin permisos/i })).toBeVisible();
    await expect(page.getByText(/consultar el historial de operaciones y recibos/i)).toBeVisible();

    await page.goto('/reportes');
    await expect(page.getByRole('heading', { name: /sin permisos/i })).toBeVisible();

    // Caja sí está autorizada por cash.view.
    await page.goto('/caja');
    await expect(page.getByRole('heading', { level: 1, name: /^caja$/i })).toBeVisible();

    const primaryNav = page.getByRole('navigation', { name: /navegación principal/i });
    await expect(primaryNav.getByRole('link', { name: 'Caja' })).toBeVisible();
    await expect(primaryNav.getByRole('link', { name: 'Cobrar' })).toHaveCount(0);
    await expect(primaryNav.getByRole('link', { name: 'Recibos' })).toHaveCount(0);
    await expect(primaryNav.getByRole('link', { name: 'Reportes' })).toHaveCount(0);
  });
});

test.describe('RBAC — redirecciones de rutas retiradas', () => {
  test('las rutas R2 redirigen al destino nuevo del producto', async ({ page }) => {
    await installAdminApi(page, { user: LIMITED, cashSession: openCashSessionFixture() });

    await page.goto('/billing/new');
    await expect(page).toHaveURL(/\/cobrar$/);

    await page.goto('/invoices');
    await expect(page).toHaveURL(/\/recibos$/);

    await page.goto('/cashbox');
    await expect(page).toHaveURL(/\/caja$/);

    await page.goto('/reports/executive');
    await expect(page).toHaveURL(/\/reportes$/);

    await page.goto('/admin/users');
    await expect(page).toHaveURL(/\/administracion\/usuarios$/);

    await page.goto('/catalog');
    await expect(page).toHaveURL(/\/administracion\/catalogo$/);
  });
});
