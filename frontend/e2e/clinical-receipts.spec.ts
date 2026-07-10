import { expect, type Page, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const adminUsername = (
  process.env.CLINICAL_RECEIPTS_E2E_USERNAME
  ?? process.env.REFACTOR_TOTAL_E2E_USERNAME
  ?? ''
).trim();
const adminPassword = process.env.CLINICAL_RECEIPTS_E2E_PASSWORD ?? process.env.REFACTOR_TOTAL_E2E_PASSWORD ?? '';
const authStatePath = resolve('./test-results/.auth/clinical-receipts.json');

test.describe('Recibos clínicos - papel institucional', () => {
  test.skip(
    !adminUsername || !adminPassword,
    'Requiere una cuenta administrativa temporal para el servidor QA.',
  );
  test.use({ storageState: authStatePath });

  test.beforeAll(async ({ browser }) => {
    mkdirSync(dirname(authStatePath), { recursive: true });
    const page = await browser.newPage({ storageState: undefined });
    await loginAsAdmin(page);
    await page.context().storageState({ path: authStatePath });
    await page.close();
  });

  test('elige Carta, Media carta y A5 sin exponer controles técnicos', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/settings/institutional-receipts');
    await expect(page.getByRole('heading', { name: /recibos institucionales/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('tab', { name: /papel y copias/i }).click();

    for (const paper of [
      { name: 'Carta', file: 'carta' },
      { name: 'Media carta', file: 'media-carta' },
      { name: 'A5', file: 'a5' },
    ]) {
      const radio = page.getByRole('radio', { name: new RegExp(`^${paper.name}\\b`, 'i') });
      await radio.check();
      await expect(radio).toBeChecked();
      await expect(page.getByRole('region', { name: `Vista previa de recibo ${paper.name}` })).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`recibo-${paper.file}-1366.png`),
        fullPage: true,
      });
    }

    const compatibility = page.getByRole('group', { name: 'Compatibilidad térmica' });
    await expect(compatibility.getByRole('listitem')).toHaveCount(2);
    await expect(compatibility.getByRole('radio')).toHaveCount(0);

    for (const label of [
      'Ancho mm',
      'Alto mm',
      'Fuente',
      'Escala',
      'Tamaño tipográfico',
      'Margen sup. (mm)',
      'Margen der. (mm)',
      'Margen inf. (mm)',
      'Margen izq. (mm)',
    ]) {
      await expect(page.getByLabel(label, { exact: true })).toHaveCount(0);
    }

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByRole('radio', { name: /^Media carta\b/i })).toBeVisible();
    await page.setViewportSize({ width: 320, height: 720 });
    await page.getByRole('radio', { name: /^Media carta\b/i }).check();
    const mobilePaper = page.getByRole('region', { name: 'Vista previa de recibo Media carta' }).first();
    const mobileContent = mobilePaper.locator('[data-receipt-preview-content]');
    await expect(mobilePaper).toBeVisible();
    await expect(mobileContent).toBeVisible();

    const mobileMetrics = await mobilePaper.evaluate((paper) => {
      const content = paper.querySelector<HTMLElement>('[data-receipt-preview-content]');
      if (!content) throw new Error('No se encontró la superficie de preview móvil.');
      const criticalSelectors = [
        '[data-receipt-preview-table]',
        '[data-receipt-preview-signatures]',
        '[data-receipt-preview-footer]',
      ];
      const missingSelectors = criticalSelectors.filter((selector) => !content.querySelector(selector));
      if (missingSelectors.length > 0) {
        throw new Error(`Faltan bloques críticos del recibo: ${missingSelectors.join(', ')}`);
      }
      const criticalElements = criticalSelectors.map(
        (selector) => content.querySelector<HTMLElement>(selector) as HTMLElement,
      );
      const paperRect = paper.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      return {
        pageClientWidth: document.documentElement.clientWidth,
        pageScrollWidth: document.documentElement.scrollWidth,
        paperRect: {
          top: paperRect.top,
          bottom: paperRect.bottom,
          left: paperRect.left,
          right: paperRect.right,
          width: paperRect.width,
          height: paperRect.height,
        },
        contentRect: {
          top: contentRect.top,
          bottom: contentRect.bottom,
          left: contentRect.left,
          right: contentRect.right,
          width: contentRect.width,
          height: contentRect.height,
        },
        transform: getComputedStyle(content).transform,
        criticalRects: criticalElements.map((element) => {
          const rect = (element as HTMLElement).getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right };
        }),
      };
    });

    expect(mobileMetrics.transform).not.toBe('none');
    expect(mobileMetrics.contentRect.left).toBeGreaterThanOrEqual(mobileMetrics.paperRect.left - 1);
    expect(mobileMetrics.contentRect.right).toBeLessThanOrEqual(mobileMetrics.paperRect.right + 1);
    expect(mobileMetrics.contentRect.top).toBeGreaterThanOrEqual(mobileMetrics.paperRect.top - 1);
    expect(mobileMetrics.contentRect.bottom).toBeLessThanOrEqual(mobileMetrics.paperRect.bottom + 1);
    for (const rect of mobileMetrics.criticalRects) {
      expect(rect.top).toBeGreaterThanOrEqual(mobileMetrics.paperRect.top - 1);
      expect(rect.bottom).toBeLessThanOrEqual(mobileMetrics.paperRect.bottom + 1);
      expect(rect.left).toBeGreaterThanOrEqual(mobileMetrics.paperRect.left - 1);
      expect(rect.right).toBeLessThanOrEqual(mobileMetrics.paperRect.right + 1);
    }
    expect(mobileMetrics.paperRect.width / mobileMetrics.paperRect.height).toBeCloseTo(8.5 / 5.5, 1);
    expect(mobileMetrics.pageScrollWidth).toBeLessThanOrEqual(mobileMetrics.pageClientWidth + 1);

    await page.screenshot({
      path: testInfo.outputPath('recibo-media-carta-320.png'),
      fullPage: true,
    });

    const pageWidth = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(pageWidth.scroll).toBeLessThanOrEqual(pageWidth.client + 1);
  });
});

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.locator('#login-input').fill(adminUsername);
  await page.locator('#password-input').fill(adminPassword);
  const submit = page.locator('form button[type="submit"]');
  await expect(submit).toBeEnabled();
  await Promise.all([
    page.waitForResponse((response) => response.url().includes('/api/auth/login') && response.ok()),
    submit.click(),
  ]);
  await expect(page.getByRole('main')).toBeVisible();
}
