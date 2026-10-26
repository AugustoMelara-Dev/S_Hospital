import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

test.skip(!process.env.E2E_RELEASE_BASE_URL, 'Requires an explicitly selected release laboratory.');

const routes = [
  '/resumen', '/cobrar', '/recibos', '/caja', '/reportes',
  '/administracion/catalogo', '/administracion/usuarios', '/administracion/auditoria',
  ...['identidad', 'numeracion', 'impuestos', 'reglas', 'impresion']
    .map((panel) => `/administracion/ajustes?panel=${panel}`),
  '/administracion/mantenimiento/respaldos', '/administracion/ayuda',
];

for (const width of [1366, 390]) {
  test(`hospital claro: todas las pantallas a ${width}px`, async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ colorScheme: 'dark' });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 500) errors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });
    await page.goto('/login');
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await page.locator('#login-input').fill(process.env.E2E_RELEASE_ADMIN_LOGIN ?? 'admin.e2e');
    await page.locator('#password-input').fill(process.env.E2E_RELEASE_PASSWORD ?? '');
    await page.getByRole('button', { name: /iniciar sesión/i }).click();
    await expect(page).toHaveURL(/\/resumen$/);
    const evidence = resolve(testInfo.outputDir, 'screens');
    mkdirSync(evidence, { recursive: true });
    const findings: unknown[] = [];
    for (const [index, route] of routes.entries()) {
      const dataEndpoints: Record<string, string> = {
        '/cobrar': '/api/services',
        '/recibos': '/api/invoices',
        '/reportes': '/api/reports/executive',
        '/administracion/auditoria': '/api/system/audit-logs',
      };
      const dataEndpoint = dataEndpoints[route];
      const dataResponse = dataEndpoint
        ? page.waitForResponse((response) => response.request().method() === 'GET'
          && new URL(response.url()).pathname === dataEndpoint)
        : undefined;
      await page.goto(route);
      if (dataResponse) expect((await dataResponse).status(), `Datos de ${route}`).toBe(200);
      await expect(page.getByText(/^(Buscando|Cargando catálogo|Cargando operaciones|Cargando reporte)…$/)).toHaveCount(0);
      await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      if (route === '/administracion/auditoria') {
        const search = page.getByRole('button', { name: 'Aplicar filtros', exact: true });
        await expect(search).toBeEnabled();
        const enabledOpacity = await search.evaluate(async (element) => {
          const button = element as HTMLButtonElement;
          button.disabled = true;
          void getComputedStyle(button).opacity;
          await Promise.all(button.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
          button.disabled = false;
          return getComputedStyle(button).opacity;
        });
        expect(enabledOpacity, 'Audit action is fully legible immediately after enabling').toBe('1');
      }
      await expect(page.locator('html')).not.toHaveClass(/dark/);
      expect(await page.locator('body').evaluate((body) => getComputedStyle(body).colorScheme)).toBe('light');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), route).toBe(true);
      await page.addScriptTag({ path: resolve(process.cwd(), 'node_modules/axe-core/axe.min.js') });
      const results = await page.evaluate(async () => {
        if (!window.axe) throw new Error('axe unavailable');
        return window.axe.run(document, { resultTypes: ['violations', 'incomplete'] });
      });
      findings.push({ route, ...results });
      writeFileSync(resolve(testInfo.outputDir, 'accessibility.json'), JSON.stringify(findings, null, 2));
      await page.screenshot({ path: resolve(evidence, `${index}.png`), fullPage: true });
      expect(results.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
        `Accesibilidad ${route}`).toEqual([]);
      expect(errors, route).toEqual([]);
      if (route === '/administracion/auditoria') {
        await page.getByRole('button', { name: 'Aplicar filtros', exact: true }).hover();
        await page.evaluate(async () => {
          await Promise.all(document.getAnimations().filter((animation) =>
            animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().endTime),
          ).map((animation) => animation.finished.catch(() => undefined)));
        });
        const hovered = await page.evaluate(async () => {
          if (!window.axe) throw new Error('axe unavailable');
          return window.axe.run(document, { runOnly: ['color-contrast'], resultTypes: ['violations', 'incomplete'] });
        });
        findings.push({ route, state: 'hover', ...hovered });
        writeFileSync(resolve(testInfo.outputDir, 'accessibility.json'), JSON.stringify(findings, null, 2));
        await page.screenshot({ path: resolve(evidence, `audit-hover-${width}.png`), fullPage: true });
        expect(hovered.violations, 'Audit search button hover contrast').toEqual([]);
      }
    }
  });
}
