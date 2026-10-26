import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  installCajaMocks,
  installRecibosMocks,
  installResumenMocks,
} from './fixtures/visual-surfaces';

const require = createRequire(import.meta.url);
const evidence = resolve(process.env.CONTRAST_EVIDENCE_DIR ?? resolve(tmpdir(), 'sh-fixes-20261022', 'contrast'));
mkdirSync(evidence, { recursive: true });

test.use({ viewport: { width: 1366, height: 900 } });

for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`enabled actions immediately restore full contrast (${reducedMotion})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await installRecibosMocks(page);
    await page.goto('/recibos');
    const button = page.getByRole('button', { name: 'Buscar', exact: true });
    await expect(button).toBeEnabled();
    const opacity = await button.evaluate(async (element) => {
      const control = element as HTMLButtonElement;
      control.disabled = true;
      void getComputedStyle(control).opacity;
      await Promise.all(control.getAnimations().map(animation => animation.finished.catch(() => undefined)));
      control.disabled = false;
      return getComputedStyle(control).opacity;
    });
    expect(opacity, 'An enabled action must not fade in from the disabled low-contrast state').toBe('1');
  });
}

for (const surface of ['caja', 'recibos', 'palette'] as const) {
  test(`${surface}: rendered text meets AA contrast including selected and focused controls`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript(() => {
      localStorage.setItem('hospital-billing-theme', 'dark');
      document.documentElement.classList.add('dark');
    });
    if (surface === 'caja') await installCajaMocks(page);
    else if (surface === 'recibos') await installRecibosMocks(page);
    else await installResumenMocks(page);
    await page.goto(surface === 'palette' ? '/resumen' : surface === 'recibos' ? '/recibos?operacion=501' : '/caja');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
    await expect(page.locator('body')).toHaveCSS('color-scheme', 'light');
    await expect(page.locator('.ui-root')).toHaveCSS('background-color', 'rgb(248, 250, 252)');
    if (surface === 'palette') {
      await page.keyboard.press('Control+k');
      await expect(page.getByRole('dialog', { name: /paleta de comandos/i })).toBeVisible();
      await page.keyboard.press('ArrowDown');
    } else if (surface === 'caja') {
      await page.getByRole('tab', { name: 'Resumen', exact: true }).focus();
    } else {
      await page.getByRole('group', { name: /^líneas de la operación$/i }).focus();
    }
    await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
    const result = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: { run: (context: Document, options: unknown) => Promise<{ violations: unknown[]; incomplete: unknown[]; passes: unknown[] }> } }).axe;
      return axe.run(document, { runOnly: ['color-contrast'], resultTypes: ['violations', 'incomplete', 'passes'] });
    });
    writeFileSync(resolve(evidence, `${surface}.json`), JSON.stringify(result, null, 2));
    await page.screenshot({ path: resolve(evidence, `${surface}.png`), fullPage: true });
    expect(result.violations, 'axe color-contrast on actual rendered UI').toEqual([]);
    expect(result.passes.length, 'axe evaluated visible text').toBeGreaterThan(0);
    // Inspect real interaction states without activating navigation or submitting
    // a form. Release the pointer outside the control after the pressed scan.
    if (surface !== 'palette') {
      const control = surface === 'caja'
        ? page.getByRole('link', { name: 'Nueva operación', exact: true })
        : page.getByRole('button', { name: 'Buscar', exact: true });
      for (const state of ['hover', 'focus', 'pressed'] as const) {
        if (state === 'hover') await control.hover();
        else if (state === 'focus') await control.focus();
        else {
          await control.hover();
          await page.mouse.down();
        }
        // Wait for the component's color transition, not an arbitrary sleep.
        await page.evaluate(async () => {
          await Promise.all(document.getAnimations().filter(animation =>
            animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().endTime),
          ).map(animation => animation.finished.catch(() => undefined)));
        });
        const stateResult = await page.evaluate(async () => {
          const axe = (window as unknown as { axe: { run: (context: Document, options: unknown) => Promise<{ violations: unknown[] }> } }).axe;
          return axe.run(document, { runOnly: ['color-contrast'], resultTypes: ['violations', 'incomplete', 'passes'] });
        });
        writeFileSync(resolve(evidence, `${surface}-${state}.json`), JSON.stringify(stateResult, null, 2));
        await page.screenshot({ path: resolve(evidence, `${surface}-${state}.png`), fullPage: true });
        if (state === 'pressed') {
          await page.mouse.move(1, 1);
          await page.mouse.up();
        }
        expect(stateResult.violations, `axe color-contrast in ${state} state`).toEqual([]);
      }
    }
  });
}
