import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { expectNoBrokenText, login, trackErrors } from './helpers';

/**
 * Walks every page (and every tab) as each demo role after the other specs created
 * data: no console errors, no "undefined"/"NaN"/"Invalid Date" in the content, and a
 * full-page screenshot per view in e2e/screenshots/ (gitignored) for manual review.
 */
const SHOTS = join(dirname(fileURLToPath(import.meta.url)), 'screenshots');
mkdirSync(SHOTS, { recursive: true });

type View = { path: string; tabs?: string[] };

const VIEWS: Record<string, View[]> = {
  admin: [
    { path: '/' },
    { path: '/cobrar' },
    { path: '/recibos' },
    { path: '/caja', tabs: [] },
    { path: '/reportes', tabs: ['Detalle', 'Cobros', 'Caja', 'Gratuidades'] },
    { path: '/admin/catalogo', tabs: ['Categorías', 'Áreas'] },
    { path: '/admin/usuarios', tabs: ['Roles'] },
    { path: '/admin/ajustes', tabs: ['Numeración fiscal', 'Impuestos', 'Reglas de cobro', 'Impresión'] },
    { path: '/admin/respaldos' },
    { path: '/admin/auditoria' },
    { path: '/ayuda' },
  ],
  supervisor: [{ path: '/' }, { path: '/recibos' }, { path: '/caja' }, { path: '/reportes' }, { path: '/admin/catalogo' }],
  cajero: [{ path: '/' }, { path: '/cobrar' }, { path: '/recibos' }, { path: '/caja' }, { path: '/reportes' }],
  auditor: [{ path: '/' }, { path: '/recibos' }, { path: '/caja' }, { path: '/reportes' }, { path: '/admin/auditoria' }],
};

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator('main')).not.toHaveText(/^\s*Cargando…\s*$/);
}

const slug = (s: string) => s.replace(/^\//, '').replace(/[^a-z0-9áéíóúñ]+/gi, '-').replace(/^-|-$/g, '') || 'inicio';

for (const [user, views] of Object.entries(VIEWS)) {
  test(`recorrido como ${user}`, async ({ page }) => {
    test.setTimeout(180_000);
    const errors = trackErrors(page);
    await login(page, user);
    for (const view of views) {
      await page.goto(view.path);
      await settle(page);
      await expectNoBrokenText(page);
      await page.screenshot({ path: join(SHOTS, `${user}-${slug(view.path)}.png`), fullPage: true });
      for (const tab of view.tabs ?? []) {
        await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
        await settle(page);
        await expectNoBrokenText(page);
        await page.screenshot({ path: join(SHOTS, `${user}-${slug(view.path)}-${slug(tab)}.png`), fullPage: true });
      }
      expect(errors, `${user} ${view.path}`).toEqual([]);
    }
  });
}
