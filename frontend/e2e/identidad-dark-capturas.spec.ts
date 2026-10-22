import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { ADMIN, CASHIER, EVIDENCE_ROOT, PASSWORD, addCatalogItem, fetchJson, login, logout, safeFilePart, saveDownload, writeEvidence } from './identidad-dark-helpers';

/**
 * Suite de capturas de la identidad dark institucional (2026-10-16).
 * Renombrada desde `azul-blanco-capturas.spec.ts`; las capturas ya no acreditan
 * la identidad clara sino los tokens canónicos dark de
 * `hospital-ai/diseno/IDENTIDAD_DARK_20261016.md` (§1/§8). Los recibos y
 * documentos siguen sobre papel blanco (§4, excepción paper).
 */

const allowCaptures = (process.env.DARK_CAPTURE ?? process.env.AZB_CAPTURE) === '1';
const routes = [
  ['/resumen', 'resumen'],
  ['/cobrar', 'cobrar'],
  ['/recibos', 'recibos'],
  ['/caja', 'caja'],
  ['/reportes', 'reportes'],
  ['/administracion/catalogo', 'admin-catalogo'],
  ['/administracion/usuarios', 'admin-usuarios'],
  ['/administracion/ajustes', 'admin-ajustes'],
  ['/administracion/ajustes?panel=papel', 'admin-impresion'],
  ['/administracion/mantenimiento/respaldos', 'admin-respaldos'],
] as const;

test.skip(!allowCaptures, 'Use DARK_CAPTURE=1 cuando las vistas dark estén estables (backend real de laboratorio).');

test.afterAll(() => {
  const directory = resolve(EVIDENCE_ROOT, 'capturas');
  const captures = readdirSync(directory)
    .filter((name) => name.endsWith('.png'))
    .sort()
    .map((name) => {
      const png = readFileSync(resolve(directory, name));
      return { name, width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
    });
  writeEvidence('CAPTURAS-FINALES.json', {
    run_id: process.env.DARK_RUN_ID ?? process.env.AZB_RUN_ID ?? null,
    base_url: process.env.DARK_BASE_URL ?? process.env.AZB_BASE_URL ?? 'http://127.0.0.1:15173',
    identity: 'dark-20261016',
    assets: (process.env.DARK_ASSET_HASH ?? process.env.AZB_ASSET_HASH ?? '').split(',').filter(Boolean),
    files: captures.map(({ name }) => name),
    dimensions: Object.fromEntries(captures.map(({ name, width, height }) => [name, { width, height }])),
    file_metadata: Object.fromEntries(captures.map(({ name }) => [name, {
      build: process.env.DARK_ASSET_HASH ?? process.env.AZB_ASSET_HASH ?? null,
      batch: 'identidad-dark-20261016',
    }])),
    limitations: {
      mobile_keyboard: 'Viewport útil 390x520 simulado; teclado móvil nativo no verificado.',
      browser_zoom: 'Zoom real del navegador no verificado en este entorno.',
      receipt_paper: 'Los recibos/documentos permanecen sobre papel blanco (§4): las capturas de recepción NO se oscurecen.',
    },
  });
});

test('capturas directas 1366x768, 1920x1080 y 390x844 de rutas operativas', async ({ page }) => {
  mkdirSync(resolve(EVIDENCE_ROOT, 'capturas'), { recursive: true });
  await captureLogin(page, 1366, 768, 'desktop');
  await captureLogin(page, 1920, 1080, 'wide');
  await captureLogin(page, 390, 844, 'mobile');

  await login(page, ADMIN);
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }]) {
    await page.setViewportSize(viewport);
    for (const [path, name] of routes) {
      await captureRoute(page, path, name, `${viewport.width}x${viewport.height}`);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const [path, name] of routes) {
    await captureRoute(page, path, name, '390x844');
  }
  await logout(page);

  await page.setViewportSize({ width: 1366, height: 768 });
  await login(page, CASHIER);
  await page.goto('/reportes');
  await expect(page.getByRole('status')).toContainText(/sin caja activa/i);
  await page.screenshot({ path: resolve(EVIDENCE_ROOT, 'capturas', 'reportes-cajero-sin-caja-1366x768.png') });
});

test('recaptura Reportes, impresión y respaldos solo después del estado real final', async ({ page }) => {
  const responses: Array<{ method: string; path: string; status: number }> = [];
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname;
    if (path === '/api/settings/institutional-receipts/test-preview' || path === '/api/backups' || path === '/api/system/status') {
      responses.push({ method: response.request().method(), path, status: response.status() });
    }
  });
  await login(page, ADMIN);
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const [path, name] of routes.filter(([, name]) => name === 'reportes' || name === 'admin-impresion' || name === 'admin-respaldos')) {
      await captureRoute(page, path, name, `${viewport.width}x${viewport.height}`);
    }
  }
  writeEvidence('qa-admin-estados-finales.json', { run_id: process.env.DARK_RUN_ID ?? process.env.AZB_RUN_ID ?? null, responses });
});

test('recaptura final de bandas KPI en Resumen, Caja, Reportes y Usuarios', async ({ page }) => {
  await login(page, ADMIN);
  const moneyBoxes: Array<{ text: string; x: number; width: number; viewportWidth: number }> = [];
  for (const viewport of [{ width: 1366, height: 768 }, { width: 1920, height: 1080 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const [path, name] of routes.filter(([, name]) => ['resumen', 'caja', 'reportes', 'admin-usuarios'].includes(name))) {
      await captureRoute(page, path, name, `${viewport.width}x${viewport.height}`);
      if (name === 'resumen' && viewport.width === 390) {
        const band = page.getByRole('group', { name: /cohortes del corte/i });
        const values = band.locator(':scope > div > p:nth-child(2)');
        for (let index = 0; index < await values.count(); index += 1) {
          const value = values.nth(index);
          const box = await value.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
          moneyBoxes.push({ text: (await value.textContent())?.trim() ?? '', x: box!.x, width: box!.width, viewportWidth: viewport.width });
        }
      }
    }
  }
  writeEvidence('qa-resumen-kpi-bounding-boxes-final.json', { run_id: process.env.DARK_RUN_ID ?? process.env.AZB_RUN_ID ?? null, values: moneyBoxes });
});

test('la ruta retirada de propuestas no conserva bypass de autenticación', async ({ page }) => {
  await page.context().clearCookies();
  const protectedRequests: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (/^\/api\/(?:invoices|reports|cash-sessions|services)(?:\/|$)/.test(path) || path === '/api/settings') {
      protectedRequests.push(path);
    }
  });
  await page.goto('/propuestas');
  await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
  await expect(page.getByText(/laboratorio de dirección visual|propuesta a|propuesta b/i)).toHaveCount(0);
  expect(protectedRequests).toEqual([]);
  await page.locator('#login-input').fill(CASHIER);
  await page.locator('#password-input').fill(PASSWORD);
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/cobrar(?:\?|$)/);
});

test('contraste calculado, tokens dark canónicos, foco por teclado y movimiento reducido', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await login(page, ADMIN);
  await page.goto('/cobrar');
  const patient = page.getByLabel(/nombre del paciente/i);
  const contrast = await patient.evaluate((element) => {
    const parse = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const luminance = (rgb: number[]) => {
      const channels = rgb.map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const foreground = parse(getComputedStyle(element).color);
    let backgroundElement: Element | null = element;
    let background = [255, 255, 255];
    while (backgroundElement) {
      const candidate = getComputedStyle(backgroundElement).backgroundColor;
      if (!candidate.endsWith(', 0)') && candidate !== 'transparent') {
        background = parse(candidate);
        break;
      }
      backgroundElement = backgroundElement.parentElement;
    }
    const light = Math.max(luminance(foreground), luminance(background));
    const dark = Math.min(luminance(foreground), luminance(background));
    return { ratio: (light + 0.05) / (dark + 0.05), foreground, background };
  });
  expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);

  // Re-ancla a los tokens canónicos de la identidad dark (IDENTIDAD_DARK_20261016 §1/§10.1):
  // no basta AA genérico; la raíz debe resolver los valores vinculantes con
  // color-scheme dark. Esto es lo que convierte la medición en identidad.
  const rootTokens = await page.evaluate(() => {
    const style = getComputedStyle(document.documentElement);
    return {
      uiPaper: style.getPropertyValue('--ui-paper').trim(),
      uiSurface: style.getPropertyValue('--ui-surface').trim(),
      uiAction: style.getPropertyValue('--ui-action').trim(),
      uiActionForeground: style.getPropertyValue('--ui-action-foreground').trim(),
      uiDocSurface: style.getPropertyValue('--ui-doc-surface').trim(),
      colorScheme: style.getPropertyValue('color-scheme').trim(),
    };
  });
  expect(rootTokens.uiPaper.toLowerCase(), '--ui-paper debe ser #090A0C (§1.1)').toBe('#090a0c');
  expect(rootTokens.uiSurface.toLowerCase(), '--ui-surface debe ser #111318 (§1.1)').toBe('#111318');
  expect(rootTokens.uiAction.toLowerCase(), '--ui-action debe ser #70A8FF (§1.3)').toBe('#70a8ff');
  expect(rootTokens.uiActionForeground.toLowerCase(), '--ui-action-foreground debe ser #0B0E14 (§1.3)').toBe('#0b0e14');
  expect(rootTokens.uiDocSurface.toLowerCase(), '--ui-doc-surface sigue en papel blanco (§4)').toBe('#ffffff');
  expect(rootTokens.colorScheme.toLowerCase(), 'color-scheme dark fijo (§8)').toBe('dark');

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  for (let index = 0; index < 30; index += 1) {
    await page.keyboard.press('Tab');
    if (await patient.evaluate((element) => document.activeElement === element)) break;
  }
  await expect(patient).toBeFocused();
  const focusStyle = await patient.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow };
  });
  expect(focusStyle.outlineStyle !== 'none' || focusStyle.boxShadow !== 'none').toBe(true);

  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  const duration = await patient.evaluate((element) => getComputedStyle(element).transitionDuration);
  const durationMs = Math.max(...duration.split(',').map((value) => {
    const normalized = value.trim();
    return normalized.endsWith('ms') ? Number.parseFloat(normalized) : Number.parseFloat(normalized) * 1000;
  }));
  expect(durationMs).toBeLessThanOrEqual(1);
  writeEvidence('qa-accesibilidad-visual.json', { contrast, root_tokens: rootTokens, focusStyle, reduced_motion: true, transition_duration: duration });
});

test('redescarga desde botones los documentos finales sin volver a cobrar', async ({ page }) => {
  await login(page, CASHIER);
  await page.goto('/recibos');
  const patient = process.env.DARK_HISTORY_PATIENT ?? process.env.AZB_HISTORY_PATIENT ?? 'DARK-QA';
  await page.getByRole('searchbox', { name: /paciente o número/i }).fill(patient);
  await page.getByRole('button', { name: /^buscar$/i }).click();
  const operation = page.getByRole('row').filter({ hasText: patient }).first();
  await expect(operation).toBeVisible();
  await operation.getByRole('button', { name: /ver recibo/i }).click();
  const receiptDialog = page.getByRole('dialog', { name: /comprobante de factura/i });
  await expect(receiptDialog).toBeVisible();
  const receiptDownload = page.waitForEvent('download');
  await receiptDialog.getByRole('button', { name: /guardar pdf/i }).click();
  await saveDownload(await receiptDownload, 'qa-comprobante-historial-final.pdf');
  await receiptDialog.getByRole('button', { name: /^cerrar$/i }).first().click();
  await expect(receiptDialog).toHaveCount(0);

  await logout(page);
  await login(page, ADMIN);
  await page.goto('/reportes');
  await page.getByRole('button', { name: /^hoy$/i }).click();
  const dateFrom = await page.getByLabel(/^desde$/i).inputValue();
  const dateTo = await page.getByLabel(/^hasta$/i).inputValue();
  expect(dateFrom).toBe(dateTo);
  const reportResponse = page.waitForResponse((response) =>
    response.request().method() === 'GET'
      && /\/api\/reports\/executive\?/.test(response.url())
      && new URL(response.url()).searchParams.get('date_from') === dateFrom
      && new URL(response.url()).searchParams.get('date_to') === dateTo,
  );
  await page.getByRole('button', { name: /^aplicar$/i }).click();
  const appliedReport = await reportResponse;
  expect(appliedReport.ok()).toBe(true);
  const filters = Object.fromEntries(new URL(appliedReport.url()).searchParams.entries());
  writeEvidence('qa-reporte-api-mismo-filtro-final.json', {
    run_id: process.env.DARK_RUN_ID ?? process.env.AZB_RUN_ID ?? null,
    filters,
    response: await appliedReport.json(),
  });
  const pdfResponse = page.waitForResponse((response) => /\/api\/reports\/executive\/pdf\?/.test(response.url()));
  const pdfDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /exportar pdf/i }).click();
  expect(Object.fromEntries(new URL((await pdfResponse).url()).searchParams.entries())).toEqual(filters);
  await saveDownload(await pdfDownload, 'qa-reporte-ejecutivo-final.pdf');
  const excelResponse = page.waitForResponse((response) => /\/api\/reports\/executive\/excel\?/.test(response.url()));
  const excelDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: /exportar excel/i }).click();
  expect(Object.fromEntries(new URL((await excelResponse).url()).searchParams.entries())).toEqual(filters);
  await saveDownload(await excelDownload, 'qa-reporte-ejecutivo-final.xlsx');
});

test('smoke del build final usa rutas normales, backend real y ningún host externo', async ({ page }) => {
  const hosts = new Set<string>();
  page.on('request', (request) => hosts.add(new URL(request.url()).hostname));
  await login(page, ADMIN);
  for (const path of ['/resumen', '/recibos', '/caja', '/reportes', '/administracion/catalogo']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
  }

  const patient = 'DARK-QA BUILD FINAL BORRADOR';
  const before = await fetchJson<{ data: unknown[]; meta: { total: number } }>(
    page,
    `/api/invoices?patient=${encodeURIComponent(patient)}&per_page=10`,
  );
  await page.goto('/cobrar');
  await page.getByLabel(/nombre del paciente/i).fill(patient);
  await addCatalogItem(page, 'Glucosa');
  await expect(page.getByText('Calculando…', { exact: true })).toHaveCount(0);
  const previewResponse = page.waitForResponse((response) =>
    response.request().method() === 'POST' && /\/api\/invoices\/receipt-preview$/.test(response.url()),
  );
  await page.getByRole('button', { name: /^vista previa$/i }).click();
  expect((await previewResponse).ok()).toBe(true);
  await expect(page.getByRole('dialog', { name: /vista previa del comprobante/i })).toContainText('BORRADOR - SIN VALIDEZ');
  const after = await fetchJson<{ data: unknown[]; meta: { total: number } }>(
    page,
    `/api/invoices?patient=${encodeURIComponent(patient)}&per_page=10`,
  );
  expect(after.body.meta.total).toBe(before.body.meta.total);

  const assets = await page.evaluate(() => performance.getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((url) => /\.(?:js|css)(?:\?|$)/.test(url)));
  const externalHosts = [...hosts].filter((host) => host !== '127.0.0.1' && host !== 'localhost');
  expect(externalHosts).toEqual([]);
  writeEvidence('qa-build-final-smoke.json', {
    base_url: process.env.DARK_BASE_URL ?? process.env.AZB_BASE_URL ?? 'http://127.0.0.1:15173',
    assets,
    hosts: [...hosts],
    invoice_count_before: before.body.meta.total,
    invoice_count_after: after.body.meta.total,
  });
});

test('cuenta continua 1, 5, 11 y 25 líneas; móvil conserva búsqueda, total, foco y scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await login(page, CASHIER);
  await page.goto('/cobrar');
  await page.getByLabel(/nombre del paciente/i).fill('DARK-QA CAPTURA CUENTA');
  const catalog = await fetchJson<{ data: Array<{ name: string }> }>(
    page,
    '/api/services?active=1&visible_in_billing=1&per_page=30',
  );
  expect(catalog.body.data.length).toBeGreaterThanOrEqual(25);
  for (let index = 0; index < 25; index += 1) {
    const previewResponse = page.waitForResponse((response) =>
      response.request().method() === 'POST' && /\/api\/invoices\/preview$/.test(response.url()),
    );
    await addCatalogItem(page, catalog.body.data[index].name);
    expect((await previewResponse).ok()).toBe(true);
    await expect(page.getByText('Calculando…', { exact: true })).toHaveCount(0);
    const lineCount = index + 1;
    if ([1, 5, 11, 25].includes(lineCount)) {
      await expect(page.getByRole('table', { name: /líneas de la cuenta/i }).getByRole('row')).toHaveCount(lineCount + 1);
      await page.screenshot({
        path: resolve(EVIDENCE_ROOT, 'capturas', `cuenta-${lineCount}-lineas-1366x768.png`),
        fullPage: false,
      });
      await page.screenshot({
        path: resolve(EVIDENCE_ROOT, 'capturas', `cuenta-${lineCount}-lineas-1366x768-fullpage.png`),
        fullPage: true,
      });
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const search = page.getByRole('searchbox', { name: /buscar servicio o producto/i });
  await search.scrollIntoViewIfNeeded();
  await search.focus();
  await expect(search).toBeFocused();
  await expect(page.getByTestId('cobrar-mobile-action')).toBeVisible();
  await page.screenshot({ path: resolve(EVIDENCE_ROOT, 'capturas', 'cuenta-25-lineas-390x844.png'), fullPage: false });
  await page.screenshot({ path: resolve(EVIDENCE_ROOT, 'capturas', 'cuenta-25-lineas-390x844-fullpage.png'), fullPage: true });

  const accountScroller = page.getByRole('group', { name: /líneas de la cuenta/i });
  const horizontalScroll = await accountScroller.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
    return { scrollLeft: element.scrollLeft, max: element.scrollWidth - element.clientWidth };
  });
  expect(horizontalScroll.max).toBeGreaterThan(0);
  expect(horizontalScroll.scrollLeft).toBeGreaterThan(0);
  await expect(page.getByRole('columnheader', { name: /^importe$/i })).toBeInViewport();
  await expect(page.getByTestId('cobrar-mobile-action')).toBeVisible();
  await page.screenshot({ path: resolve(EVIDENCE_ROOT, 'capturas', 'cuenta-25-lineas-390x844-tabla-importe.png') });

  const lastAccountRow = page.getByRole('table', { name: /líneas de la cuenta/i }).getByRole('row').last();
  await lastAccountRow.scrollIntoViewIfNeeded();
  const verticalScroll = await accountScroller.evaluate((element) => {
    return { scrollTop: element.scrollTop, max: element.scrollHeight - element.clientHeight };
  });
  expect(verticalScroll.max).toBeGreaterThan(0);
  expect(verticalScroll.scrollTop).toBeGreaterThan(0);
  await expect(lastAccountRow).toBeInViewport();
  await expect(page.getByTestId('cobrar-mobile-action')).toBeVisible();
  await page.screenshot({ path: resolve(EVIDENCE_ROOT, 'capturas', 'cuenta-25-lineas-390x844-ultimas-lineas.png') });
  writeEvidence('qa-scroll-cuenta-final.json', {
    run_id: process.env.DARK_RUN_ID ?? process.env.AZB_RUN_ID ?? null,
    viewport: { width: 390, height: 844 },
    horizontal: horizontalScroll,
    vertical: verticalScroll,
    total_action_visible: true,
  });

  // Simula el viewport útil reducido por teclado virtual sin inventar cabecera
  // de dispositivo ni del antiguo laboratorio.
  await page.setViewportSize({ width: 390, height: 520 });
  await search.scrollIntoViewIfNeeded();
  await expect(search).toBeInViewport();
  await expect(page.getByTestId('cobrar-mobile-action')).toBeVisible();
  await page.screenshot({ path: resolve(EVIDENCE_ROOT, 'capturas', 'cobrar-mobile-teclado-scroll-390x520.png') });
});

test('borrador EPO mixto muestra gratuidad solo en la línea elegible y total positivo', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await login(page, CASHIER);
  await page.goto('/cobrar');
  await page.getByLabel(/nombre del paciente/i).fill('DARK-QA CAPTURA EPO MIXTA');
  await addCatalogItem(page, 'Eritropoyetina');
  await addCatalogItem(page, 'Glucosa');
  const valued = page.waitForResponse((response) => {
    if (response.request().method() !== 'POST' || !/\/api\/invoices\/preview$/.test(response.url())) return false;
    const payload = response.request().postDataJSON();
    return payload?.dialysis_prescription === true && payload?.items?.length === 2;
  });
  await page.getByRole('checkbox', { name: /paciente con receta de diálisis/i }).check();
  const preview = await (await valued).json() as {
    data: { totals: { total_cents: number }; items: Array<{ service_name: string; special_rule_applied: boolean }> };
  };
  expect(preview.data.totals.total_cents).toBeGreaterThan(0);
  expect(preview.data.items.filter((item) => item.special_rule_applied).map((item) => item.service_name)).toEqual(['Eritropoyetina']);
  await expect(page.getByText(/sin cobro por receta/i)).toHaveCount(1);
  await expect(page.getByText('Calculando…', { exact: true })).toHaveCount(0);
  await page.screenshot({ path: resolve(EVIDENCE_ROOT, 'capturas', 'cobrar-epo-mixta-1366x768.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('cobrar-mobile-action')).toBeVisible();
  await page.screenshot({ path: resolve(EVIDENCE_ROOT, 'capturas', 'cobrar-epo-mixta-390x844.png'), fullPage: true });
});

async function captureLogin(page: Page, width: number, height: number, label: string): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /iniciar sesión/i })).toBeVisible();
  await page.screenshot({ path: resolve(EVIDENCE_ROOT, 'capturas', `login-${label}-${width}x${height}.png`), fullPage: true });
}

async function captureRoute(page: Page, path: string, name: string, viewport: string): Promise<void> {
  await page.goto(path);
  const main = page.locator('main');
  await expect(main).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(main.locator('.animate-pulse')).toHaveCount(0);
  await expect(main.getByText(/^(?:cargando|buscando|calculando|consultando|actualizando)/i)).toHaveCount(0);
  if (path.startsWith('/administracion/catalogo')) {
    await expect(main.getByText(/^cargando servicios/i)).toHaveCount(0);
    if (!viewport.startsWith('390x')) await expect(main.getByRole('table')).toBeVisible();
  }
  if (path.startsWith('/administracion/usuarios')) {
    await expect(main.getByText(/^cargando usuarios/i)).toHaveCount(0);
    if (!viewport.startsWith('390x')) await expect(main.getByRole('table').first()).toBeVisible();
  }
  if (path.includes('panel=papel')) {
    await expect(main.getByTestId('receipt-copies-metric')).toBeVisible();
    await expect(main.getByText(/confirmando con el motor/i)).toHaveCount(0);
    await expect(
      main.getByText(/confirmado por el motor/i).or(main.getByText(/no se pudo.+(?:vista previa|motor)/i)),
    ).toBeVisible();
  }
  if (path.startsWith('/administracion/mantenimiento/respaldos')) {
    await expect(main.getByRole('button', { name: /actualizar respaldos y estado operativo/i })).toBeEnabled();
    const history = main.getByRole('group', { name: /historial de respaldos locales/i });
    await expect(history).toBeVisible();
    await expect(
      history.getByRole('region', { name: /historial de respaldos locales/i })
        .or(history.getByText(/^no hay respaldos$/i))
        .or(history.getByText(/^error al cargar respaldos$/i))
        .first(),
    ).toBeVisible();
  }
  await expect(page.getByText(/laboratorio de dirección visual|propuesta a|propuesta b|comanda táctica/i)).toHaveCount(0);
  await page.screenshot({
    path: resolve(EVIDENCE_ROOT, 'capturas', `${safeFilePart(name)}-${viewport}.png`),
    fullPage: false,
  });
  await page.screenshot({
    path: resolve(EVIDENCE_ROOT, 'capturas', `${safeFilePart(name)}-${viewport}-fullpage.png`),
    fullPage: true,
  });
}
