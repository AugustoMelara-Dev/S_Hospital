import { expect, test, type Route } from '@playwright/test';
import { assertStrictMockGuard, installStrictMockGuard } from './fixtures/strict-mock-guard';
import {
  installAdminApi,
  openCashSessionFixture,
  json,
  type AdminTestCashSession,
  type AdminTestUser,
} from './fixtures/admin-e2e';

/**
 * Caja — apertura y cierre sobre el producto nuevo `CajaView`/`CashBoxView`.
 * La sesión es un fixture sintético; el POST de apertura/cierre nunca llega a
 * un backend real.
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
    'cash.view',
    'cash.open',
    'cash.close',
    'invoices.create',
    'invoices.view',
    'payments.create',
  ],
  must_change_password: false,
};

function closedFixture(overrides: Partial<AdminTestCashSession> = {}): AdminTestCashSession {
  return openCashSessionFixture({
    status: 'closed',
    closing_amount: '500.00',
    closed_at: '2026-09-18T16:00:00-06:00',
    ...overrides,
  });
}

test.describe('Caja — apertura y cierre', () => {
  test('abre una caja sin sesión y confirma el monto inicial', async ({ page }) => {
    const api = await installAdminApi(page, { user: CASHIER, cashSession: null });
    let openPayload: Record<string, unknown> | null = null;

    await page.route(/\/api\/cash-sessions\/open$/, async (route: Route) => {
      openPayload = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
      const opened = openCashSessionFixture();
      api.setCashSession(opened);
      return json(route, { data: opened }, 201);
    });

    await page.goto('/caja');
    await expect(page.getByRole('heading', { level: 1, name: /^caja$/i })).toBeVisible();
    await expect(page.getByText(/no hay una caja abierta actualmente/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /apertura de caja/i })).toBeVisible();

    await page.getByLabel(/monto inicial/i).fill('500.00');
    await page.getByRole('combobox', { name: 'Caja física', exact: true }).selectOption('1');
    await page.getByRole('button', { name: /^abrir caja$/i }).click();

    const dialog = page.getByRole('dialog', { name: /confirmar apertura de caja/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^abrir caja$/i }).click();

    await expect.poll(() => openPayload).not.toBeNull();
    expect(openPayload).toMatchObject({ opening_amount: '500.00', cash_register_id: 1 });
    await expect(page.getByText('Caja abierta').first()).toBeVisible({ timeout: 10_000 });
    const sessionIdentity = page.getByRole('region', { name: /caja, usuario y sesión/i });
    await expect(sessionIdentity).toContainText('Caja abierta');
    await expect(sessionIdentity).toContainText(CASHIER.name);
  });

  test('cierra la caja abierta con el monto contado y muestra el resumen', async ({ page }) => {
    const api = await installAdminApi(page, { user: CASHIER, cashSession: openCashSessionFixture() });
    let closePayload: Record<string, unknown> | null = null;

    await page.route(/\/api\/cash-sessions\/7\/close$/, async (route: Route) => {
      closePayload = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
      const closed = closedFixture();
      api.setCashSession(null);
      return json(route, { data: closed });
    });

    await page.goto('/caja');
    await expect(page.getByText('Caja abierta').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: 'Cierre' }).click();
    await page.getByLabel(/monto contado/i).fill('500.00');
    await page.getByRole('button', { name: /^cerrar caja$/i }).click();

    const dialog = page.getByRole('dialog', { name: /cierre de caja/i });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^cerrar caja$/i }).click();

    await expect.poll(() => closePayload).not.toBeNull();
    expect(closePayload).toMatchObject({ closing_amount: '500.00', notes: null });
    await expect(page.getByRole('heading', { name: /resumen de cierre confirmado/i })).toBeVisible();
    await expect(page.getByText(/no hay una caja abierta actualmente/i)).toBeVisible();
  });
});
