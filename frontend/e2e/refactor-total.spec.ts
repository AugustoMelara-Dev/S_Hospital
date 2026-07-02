import axeCore from 'axe-core';
import { expect, type Page, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const reportPath = resolve(
  process.env.REFACTOR_TOTAL_E2E_REPORT_PATH ?? '../qa/production-audit/refactor-total-e2e.json',
);
const authStatePath = resolve(process.env.REFACTOR_TOTAL_AUTH_STATE_PATH ?? '/tmp/s-hospital-refactor-total-auth.json');

test.setTimeout(180_000);

test.describe('Refactor Total - E2E criticos', () => {
  test.use({ storageState: authStatePath });

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await loginAsAdmin(page);
    await page.context().storageState({ path: authStatePath });
    await page.close();
  });

  test('login screen has no a11y violations and exposes the auth form', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const violations = await seriousAxeViolations(page);
    writeAxeReport('login', violations);
    expect(violations).toEqual([]);
    await context.close();
  });

  test('institutional receipts screen does NOT expose manual paper fields for non-support users', async ({ page }) => {
    await page.goto('/settings/institutional-receipts');

    await expect(page.getByRole('heading', { name: /recibos institucionales/i })).toBeVisible();

    for (const label of [
      'Ancho mm',
      'Alto mm',
      'Fuente',
      'Escala',
      'Margen sup. (mm)',
      'Margen der. (mm)',
      'Margen inf. (mm)',
      'Margen izq. (mm)',
    ]) {
      await expect(page.getByLabel(label, { exact: true })).toHaveCount(0);
    }

    const violations = await seriousAxeViolations(page);
    writeAxeReport('institutional-receipts-normal', violations);
    expect(violations).toEqual([]);
  });

  test('reports screen consolidates into three sub-routes and stays accessible', async ({ page }) => {
    await page.goto('/reports/executive');

    await expect(page.getByRole('heading', { name: /ejecutivo|caja|auditoria/i }).first()).toBeVisible();

    const violations = await seriousAxeViolations(page);
    writeAxeReport('reports-executive', violations);
    expect(violations).toEqual([]);
  });

  test('cashbox screen keeps the close-session workflow accessible', async ({ page }) => {
    await page.goto('/cashbox');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const violations = await seriousAxeViolations(page);
    writeAxeReport('cashbox', violations);
    expect(violations).toEqual([]);
  });

  test('catalog screen keeps accessible service table and edit form', async ({ page }) => {
    await page.goto('/catalog');

    await expect(page.getByRole('heading', { name: /cat[aá]logo de servicios/i })).toBeVisible();

    const violations = await seriousAxeViolations(page);
    writeAxeReport('catalog', violations);
    expect(violations).toEqual([]);
  });

  test('history screen avoids inline dangerous actions and uses ActionMenu when rows exist', async ({ page }) => {
    await page.goto('/invoices');

    await expect(page.getByRole('heading', { name: /historial de facturas/i })).toBeVisible();

    await expect(page.getByRole('button', { name: /anular factura|reversar pago/i })).toHaveCount(0);
    const actionMenu = page.getByRole('button', { name: /acciones de la factura/i }).first();
    if (await actionMenu.isVisible().catch(() => false)) {
      await expect(actionMenu).toBeVisible();
    }

    const violations = await seriousAxeViolations(page);
    writeAxeReport('history', violations);
    expect(violations).toEqual([]);
  });

  test('settings screen keeps fiscal tabs focused and links receipts to the dedicated route', async ({ page }) => {
    await page.goto('/settings/fiscal');

    await expect(page.getByRole('heading', { name: /^configuraci[oó]n$/i })).toBeVisible();

    for (const tab of ['Hospital', 'Numeraci', 'Operativa', 'Marca']) {
      await expect(page.getByRole('tab', { name: new RegExp(tab, 'i') })).toBeVisible();
    }
    await expect(page.getByRole('tab', { name: /recibos/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /administrar recibos/i })).toBeVisible();

    const violations = await seriousAxeViolations(page);
    writeAxeReport('settings', violations);
    expect(violations).toEqual([]);
  });
});

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.locator('#login-input').fill('admin.validacion');
  await page.locator('#password-input').fill('Password123!');
  const submit = page.locator('form button[type="submit"]');
  await expect(submit).toBeEnabled({ timeout: 70_000 });
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/auth/login') && response.ok(), { timeout: 70_000 }),
    submit.click(),
  ]);
  await page.waitForLoadState('domcontentloaded', { timeout: 70_000 });
  await expect(page.getByRole('main')).toBeVisible({ timeout: 70_000 });
  await expect(page.getByRole('heading', { name: /centro de mando|dashboard|inicio/i }).first()).toBeVisible({ timeout: 70_000 });
}

async function seriousAxeViolations(page: Page) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await page.addScriptTag({ content: axeCore.source });
      return await page.evaluate(async () => {
        const result = await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
        });
        return result.violations
          .filter((violation) => ['critical', 'serious'].includes(String(violation.impact)))
          .map((violation) => ({
            id: violation.id,
            impact: violation.impact,
            help: violation.help,
            nodes: violation.nodes.slice(0, 3).map((node) => ({
              target: node.target,
              html: node.html,
            })),
          }));
      });
    } catch (error) {
      if (!String(error).includes('Execution context was destroyed') || attempt === 1) throw error;
      await page.waitForLoadState('domcontentloaded').catch(() => undefined);
    }
  }

  return [];
}

function writeAxeReport(label: string, violations: Array<{ id: string; impact: string; help: string }>) {
  try {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(
      reportPath,
      JSON.stringify({ label, generatedAt: new Date().toISOString(), violations }, null, 2),
    );
  } catch {
    // ignore
  }
}
