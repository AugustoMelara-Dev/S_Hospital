import { expect, test, type Download, type Locator, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ADMIN, CASHIER, addCatalogItem, fetchJson, login } from './identidad-dark-helpers';

const enabled = process.env.REDISENO_INTEGRAL_CAPTURE === '1';
const outputRoot = resolve('../hospital-ai/evidencia/REDISENO-INTEGRAL-20260928');
const capturesRoot = resolve(outputRoot, 'capturas');
const desktop = { width: 1366, height: 900 };
const mobile = { width: 390, height: 844 };
const compactMobile = { width: 390, height: 520 };

type ViewportName = 'desktop-1366x900' | 'mobile-390x844' | 'mobile-390x520-proxy';
type CoverageStatus = 'captured' | 'dependency-missing';
type CoverageEntry = {
  file?: string;
  route: string;
  surface: string;
  viewport: ViewportName;
  status: CoverageStatus;
  note?: string;
};

const coverage: CoverageEntry[] = [];
const pageErrors: string[] = [];
const businessMutations: string[] = [];
const unexpectedExternalRequests: string[] = [];

test.skip(!enabled, 'Use REDISENO_INTEGRAL_CAPTURE=1 sólo cuando el build y el backend real estén congelados.');
test.use({ actionTimeout: 15_000, navigationTimeout: 30_000 });

test.beforeAll(() => mkdirSync(capturesRoot, { recursive: true }));

test.afterAll(() => {
  writeFileSync(resolve(outputRoot, 'MANIFEST.json'), `${JSON.stringify({
    generated_at: new Date().toISOString(),
    run_id: process.env.REDISENO_INTEGRAL_RUN_ID ?? null,
    base_url: process.env.AZB_BASE_URL ?? null,
    backend: process.env.AZB_API_URL ?? null,
    read_only: true,
    viewports: { desktop, mobile, compact_mobile_proxy: compactMobile },
    coverage,
    page_errors: pageErrors,
    unexpected_business_mutations: businessMutations,
    unexpected_external_requests: unexpectedExternalRequests,
    limitations: {
      missing_data: 'Una superficie marcada dependency-missing no se considera aprobada ni se reemplaza con fixtures.',
      mobile_keyboard: 'Viewport móvil directo 390×844 y proxy 390×520 con buscador enfocado; Playwright de escritorio no certifica teclado virtual nativo.',
      printing: 'No se imprime físicamente ni se confirma ningún cobro, cierre, respaldo o cambio administrativo.',
    },
  }, null, 2)}\n`, 'utf8');
});

test('acceso y recuperación local visibles con foco de teclado', async ({ page }) => {
  test.setTimeout(45_000);
  await registerReadOnlyGuards(page);
  await page.setViewportSize(desktop);
  await page.goto('/login');
  await expect(page.getByRole('heading', { level: 1, name: /iniciar sesión/i })).toBeVisible();
  const loginInput = page.locator('#login-input');
  for (let index = 0; index < 6 && !await loginInput.evaluate((element) => element === document.activeElement); index += 1) {
    await page.keyboard.press('Tab');
  }
  await expect(loginInput).toBeFocused();
  const focusFrame = loginInput.locator('xpath=ancestor::*[@data-ui-focus-frame][1]');
  const focusStyle = await focusFrame.evaluate((element) => {
    const style = getComputedStyle(element);
    return { outlineStyle: style.outlineStyle, outlineWidth: parseFloat(style.outlineWidth) };
  });
  expect(focusStyle.outlineStyle).not.toBe('none');
  expect(focusStyle.outlineWidth).toBeGreaterThan(0);
  await capture(page, '/login', '00-acceso', 'Acceso con foco visible de teclado', 'desktop-1366x900');

  await page.getByRole('button', { name: /olvidó su contraseña/i }).click();
  await expect(page.getByText(/Recuperar acceso a S_Hospital/i)).toBeVisible();
  await capture(page, '/login', '00b-acceso-recuperacion', 'Acceso — ayuda de recuperación local', 'desktop-1366x900');
  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  expect(businessMutations, businessMutations.join('\n')).toEqual([]);
  expect(unexpectedExternalRequests, unexpectedExternalRequests.join('\n')).toEqual([]);
});

test('inventario visual integral de escritorio y superficies secundarias', async ({ page }) => {
  test.setTimeout(240_000);
  await registerReadOnlyGuards(page);
  await page.setViewportSize(desktop);
  await login(page, ADMIN);

  await captureRoute(page, '/resumen', /^resumen$/i, '01-resumen', 'Resumen y actividad del día', 'desktop-1366x900');
  await auditCobrar(page, 'desktop-1366x900', true);
  await auditRecibos(page, 'desktop-1366x900', true);
  await auditCaja(page, 'desktop-1366x900', true);
  await auditReportes(page, 'desktop-1366x900', true);

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  expect(businessMutations, businessMutations.join('\n')).toEqual([]);
  expect(unexpectedExternalRequests, unexpectedExternalRequests.join('\n')).toEqual([]);
});

test('inventario visual de administración en escritorio', async ({ page }) => {
  test.setTimeout(180_000);
  await registerReadOnlyGuards(page);
  await page.setViewportSize(desktop);
  await login(page, ADMIN);

  await auditCatalogo(page, 'desktop-1366x900', true);
  await auditUsuarios(page, 'desktop-1366x900', true);
  await auditAjustes(page, 'desktop-1366x900', true);
  await auditRespaldos(page, 'desktop-1366x900', true);
  await auditAyuda(page, 'desktop-1366x900', true);

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  expect(businessMutations, businessMutations.join('\n')).toEqual([]);
  expect(unexpectedExternalRequests, unexpectedExternalRequests.join('\n')).toEqual([]);
});

test('Recibos corregido en escritorio conserva foco y abre secundarios', async ({ page }) => {
  test.setTimeout(120_000);
  await registerReadOnlyGuards(page);
  await page.setViewportSize(desktop);
  await login(page, ADMIN);
  await auditRecibos(page, 'desktop-1366x900', true);

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  expect(businessMutations, businessMutations.join('\n')).toEqual([]);
  expect(unexpectedExternalRequests, unexpectedExternalRequests.join('\n')).toEqual([]);
});

test('administración final desde Ajustes hasta Ayuda', async ({ page }) => {
  test.setTimeout(120_000);
  await registerReadOnlyGuards(page);
  await page.setViewportSize(desktop);
  await login(page, ADMIN);
  await auditAjustes(page, 'desktop-1366x900', true);
  await auditRespaldos(page, 'desktop-1366x900', true);
  await auditAyuda(page, 'desktop-1366x900', true);

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  expect(businessMutations, businessMutations.join('\n')).toEqual([]);
  expect(unexpectedExternalRequests, unexpectedExternalRequests.join('\n')).toEqual([]);
});

test('móvil focal muestra cuenta, total y detalle de Recibos', async ({ page }) => {
  test.setTimeout(120_000);
  await registerReadOnlyGuards(page);
  await page.setViewportSize(mobile);
  await login(page, ADMIN);
  await auditCobrar(page, 'mobile-390x844', true);
  await auditRecibos(page, 'mobile-390x844', true);

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  expect(businessMutations, businessMutations.join('\n')).toEqual([]);
  expect(unexpectedExternalRequests, unexpectedExternalRequests.join('\n')).toEqual([]);
});

test('móvil continúa Ajustes, Respaldos y Ayuda', async ({ page }) => {
  test.setTimeout(120_000);
  await registerReadOnlyGuards(page);
  await page.setViewportSize(mobile);
  await login(page, ADMIN);
  await auditAjustes(page, 'mobile-390x844', true);
  await auditRespaldos(page, 'mobile-390x844', true);
  await auditAyuda(page, 'mobile-390x844', true);

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  expect(businessMutations, businessMutations.join('\n')).toEqual([]);
  expect(unexpectedExternalRequests, unexpectedExternalRequests.join('\n')).toEqual([]);
});

test('móvil Usuarios conserva formularios y acciones en el diálogo', async ({ page }) => {
  test.setTimeout(90_000);
  await registerReadOnlyGuards(page);
  await page.setViewportSize(mobile);
  await login(page, ADMIN);
  await auditUsuarios(page, 'mobile-390x844', true);

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  expect(businessMutations, businessMutations.join('\n')).toEqual([]);
  expect(unexpectedExternalRequests, unexpectedExternalRequests.join('\n')).toEqual([]);
});

test('cerrar sesión respeta el borrador de Ajustes', async ({ page }) => {
  test.setTimeout(60_000);
  await registerReadOnlyGuards(page);
  await page.setViewportSize(desktop);
  await login(page, ADMIN);
  await page.goto('/administracion/ajustes?panel=papel');
  await page.getByRole('tab', { name: /^impresión$/i }).click();

  const receiptLegalText = page.getByLabel(/texto legal del recibo/i);
  await expect(receiptLegalText).toBeEnabled();
  const original = await receiptLegalText.inputValue();
  const draft = `${original} QA BORRADOR SIN GUARDAR`.trim();
  await receiptLegalText.fill(draft);
  let logoutRequests = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/auth/logout') logoutRequests += 1;
  });

  await page.getByRole('button', { name: /^salir$/i }).click();
  const warning = page.getByRole('alertdialog', { name: /descartar cambios sin guardar/i });
  await expect(warning).toBeVisible();
  await capture(page, '/administracion/ajustes?panel=papel', '38-ajustes-cerrar-sesion-borrador', 'Ajustes — cerrar sesión protege el borrador', 'desktop-1366x900');
  await warning.getByRole('button', { name: /seguir editando/i }).click();
  await expect(warning).toHaveCount(0);
  await expect(receiptLegalText).toHaveValue(draft);
  await expect(page.locator('#login-input')).toHaveCount(0);
  expect(logoutRequests).toBe(0);
  expect(businessMutations, businessMutations.join('\n')).toEqual([]);
  expect(unexpectedExternalRequests, unexpectedExternalRequests.join('\n')).toEqual([]);
});

test('Resumen final y Cobrar móvil conservan jerarquía y altura táctil', async ({ page }) => {
  test.setTimeout(75_000);
  await registerReadOnlyGuards(page);
  await page.setViewportSize(desktop);
  await login(page, ADMIN);
  await captureRoute(page, '/resumen', /^resumen$/i, '01-resumen', 'Resumen final sin acción duplicada', 'desktop-1366x900');
  await page.setViewportSize(mobile);
  await auditCobrar(page, 'mobile-390x844', true);

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  expect(businessMutations, businessMutations.join('\n')).toEqual([]);
  expect(unexpectedExternalRequests, unexpectedExternalRequests.join('\n')).toEqual([]);
});

test('inventario visual integral móvil sin desborde del documento', async ({ page }) => {
  test.setTimeout(240_000);
  await registerReadOnlyGuards(page);
  await page.setViewportSize(mobile);
  await login(page, ADMIN);

  await captureRoute(page, '/resumen', /^resumen$/i, 'm01-resumen', 'Resumen móvil', 'mobile-390x844');
  await auditCobrar(page, 'mobile-390x844', true);
  await auditRecibos(page, 'mobile-390x844', true);
  await auditCaja(page, 'mobile-390x844', false);
  await auditReportes(page, 'mobile-390x844', true);
  await auditCatalogo(page, 'mobile-390x844', true);
  await assertAdministrationRailContained(page);
  await auditUsuarios(page, 'mobile-390x844', true);
  await auditAjustes(page, 'mobile-390x844', true);
  await auditRespaldos(page, 'mobile-390x844', true);
  await auditAyuda(page, 'mobile-390x844', true);

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  expect(businessMutations, businessMutations.join('\n')).toEqual([]);
  expect(unexpectedExternalRequests, unexpectedExternalRequests.join('\n')).toEqual([]);
});

test('Cobrar operativo con cajero y caja abierta sin emitir', async ({ page }) => {
  test.setTimeout(90_000);
  await registerReadOnlyGuards(page);
  await page.setViewportSize(desktop);
  await login(page, CASHIER);
  await page.goto('/cobrar');
  await expect(page.getByRole('heading', { level: 1, name: /^cobrar$/i })).toBeVisible();

  const catalog = await fetchJson<{ data?: Array<{ name?: string }> }>(page, '/api/services?active=1&visible_in_billing=1&per_page=1');
  const serviceName = catalog.status === 200 ? catalog.body.data?.[0]?.name?.trim() : '';
  expect(serviceName, 'El catálogo real debe ofrecer un concepto facturable para la revisión de Cobrar').toBeTruthy();

  await page.getByLabel(/nombre del paciente/i).fill('QA REVISIÓN VISUAL SIN EMISIÓN');
  const preview = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/invoices/preview');
  await addCatalogItem(page, serviceName!);
  expect((await preview).ok()).toBe(true);
  await expect(page.getByText('Calculando…', { exact: true })).toHaveCount(0);

  const confirmButton = page.getByTestId('cobrar-primary-action');
  await expect(confirmButton).toBeEnabled();
  await capture(page, '/cobrar', '04-cobrar-cajero-operativo', 'Cobrar con cajero, caja abierta y cuenta valorada', 'desktop-1366x900');
  await confirmButton.click();
  const dialog = page.getByRole('dialog', { name: /confirmar (?:cobro|emisión sin cobro)/i });
  await expect(dialog).toBeVisible();
  await assertAdminDialogLayout(dialog);
  await capture(page, '/cobrar', '04b-cobrar-cajero-confirmacion', 'Cobrar — confirmación operativa sin confirmar', 'desktop-1366x900');
  await closeDialog(page, dialog);

  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  expect(businessMutations, businessMutations.join('\n')).toEqual([]);
  expect(unexpectedExternalRequests, unexpectedExternalRequests.join('\n')).toEqual([]);
});

async function registerReadOnlyGuards(page: Page): Promise<void> {
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('request', (request) => {
    const method = request.method();
    const path = new URL(request.url()).pathname;
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return;
    if (method === 'POST' && path === '/api/auth/login') return;
    if (method === 'POST' && ['/api/invoices/preview', '/api/invoices/receipt-preview'].includes(path)) return;
    if (method === 'POST' && path === '/api/settings/institutional-receipts/test-preview') return;
    businessMutations.push(`${method} ${path}`);
  });
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (!['http:', 'https:'].includes(url.protocol) || ['127.0.0.1', 'localhost'].includes(url.hostname)) {
      await route.continue();
      return;
    }
    unexpectedExternalRequests.push(`${route.request().method()} ${url.origin}${url.pathname}`);
    await route.abort('blockedbyclient');
  });
}

async function captureRoute(
  page: Page,
  route: string,
  heading: RegExp,
  fileBase: string,
  surface: string,
  viewport: ViewportName,
): Promise<void> {
  await page.goto(route);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  await capture(page, route, fileBase, surface, viewport);
}

async function auditCobrar(page: Page, viewport: ViewportName, secondaries: boolean): Promise<void> {
  const route = '/cobrar';
  await page.goto(route);
  await expect(page.getByRole('heading', { level: 1, name: /^cobrar$/i })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: /buscar servicio o producto/i })).toBeVisible();

  const catalog = await fetchJson<{ data?: Array<{ name?: string }> }>(page, '/api/services?active=1&visible_in_billing=1&per_page=1');
  const serviceName = catalog.status === 200 ? catalog.body.data?.[0]?.name?.trim() : '';
  if (!serviceName) {
    dependency(route, 'Cobrar — cuenta con concepto', viewport, 'El catálogo real no devolvió un concepto facturable activo.');
    await capture(page, route, `${prefix(viewport)}02-cobrar-vacio`, 'Cobrar vacío', viewport);
    return;
  }

  await page.getByLabel(/nombre del paciente/i).fill('QA REVISIÓN VISUAL SIN EMISIÓN');
  const preview = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/invoices/preview');
  await addCatalogItem(page, serviceName);
  expect((await preview).ok()).toBe(true);
  await expect(page.getByText('Calculando…', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('table', { name: /líneas de la cuenta/i })).toBeVisible();
  await capture(page, route, `${prefix(viewport)}02-cobrar-cuenta`, 'Cobrar con búsqueda, cuenta y total valorado', viewport);
  if (viewport === 'mobile-390x844') {
    const accountTable = page.getByRole('table', { name: /líneas de la cuenta/i });
    const totalAction = page.getByRole('complementary', { name: /total y acción/i });
    await accountTable.evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await expect(totalAction).toBeVisible();
    const mobileActions = [
      page.getByTestId('cobrar-primary-action'),
      page.getByRole('button', { name: /^vista previa$/i }),
    ];
    for (const action of mobileActions) {
      const box = await action.boundingBox();
      expect(box, `La acción ${await action.textContent()} debe tener caja visible`).not.toBeNull();
      expect(box!.height, `La acción ${await action.textContent()} debe conservar altura táctil`).toBeGreaterThanOrEqual(40);
    }
    await capture(page, route, 'm02b-cobrar-cuenta-total', 'Cobrar móvil — cuenta y total inferior', viewport);

    await page.setViewportSize(compactMobile);
    const search = page.getByRole('searchbox', { name: /buscar servicio o producto/i });
    await search.evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await search.focus();
    await expect(search).toBeFocused();
    await capture(page, route, 'm02c-cobrar-teclado-proxy', 'Cobrar móvil — buscador enfocado con espacio reducido', 'mobile-390x520-proxy');
    await accountTable.evaluate((element) => element.scrollIntoView({ block: 'start' }));
    await expect(totalAction).toBeVisible();
    await capture(page, route, 'm02d-cobrar-scroll-proxy', 'Cobrar móvil — cuenta, desplazamiento y total con espacio reducido', 'mobile-390x520-proxy');
    await page.setViewportSize(mobile);
  }

  if (!secondaries) return;
  const draftButton = page.getByRole('button', { name: /^vista previa$/i });
  if (await isUsable(draftButton)) {
    await draftButton.click();
    const dialog = page.getByRole('dialog', { name: /vista previa del comprobante/i });
    await expect(dialog).toBeVisible();
    await assertAdminDialogLayout(dialog);
    await capture(page, route, `${prefix(viewport)}03-cobrar-borrador`, 'Cobrar — vista previa sin emitir', viewport);
    await closeDialog(page, dialog);
  } else {
    dependency(route, 'Cobrar — vista previa', viewport, 'La vista previa no quedó habilitada con el concepto real disponible.');
  }

  const confirmButton = page.getByTestId(viewport.startsWith('mobile') ? 'cobrar-mobile-action' : 'cobrar-primary-action');
  if (await isUsable(confirmButton)) {
    await confirmButton.click();
    const dialog = page.getByRole('dialog', { name: /confirmar (?:cobro|emisión sin cobro)/i });
    await expect(dialog).toBeVisible();
    await assertAdminDialogLayout(dialog);
    await capture(page, route, `${prefix(viewport)}04-cobrar-confirmacion`, 'Cobrar — confirmación abierta sin confirmar', viewport);
    await closeDialog(page, dialog);
  } else {
    dependency(route, 'Cobrar — confirmación', viewport, 'La acción requiere caja abierta/permisos y no estaba disponible; no se abrió una caja para fabricar el estado.');
  }
}

async function auditRecibos(page: Page, viewport: ViewportName, secondaries: boolean): Promise<void> {
  const route = '/recibos';
  await page.goto(route);
  await expect(page.getByRole('heading', { level: 1, name: /^recibos$/i })).toBeVisible();
  await expect(page.getByRole('status', { name: /cargando operaciones/i })).toHaveCount(0);
  await capture(page, route, `${prefix(viewport)}05-recibos`, 'Recibos — historial', viewport);
  if (!secondaries) return;

  const detailTriggers = viewport === 'desktop-1366x900'
    ? page.getByRole('button', { name: /más acciones de la operación/i })
    : page.getByRole('button', { name: /^detalle$/i });
  if (await detailTriggers.count() === 0) {
    dependency(route, 'Recibos — detalle y diálogos', viewport, 'No hay operaciones visibles en el historial real.');
    return;
  }

  const detail = await openRecibosDetailWithFocus(page, viewport);
  await detail.getByRole('heading', { level: 2 }).scrollIntoViewIfNeeded();
  await capture(page, route, `${prefix(viewport)}06-recibos-detalle`, 'Recibos — detalle de operación', viewport);
  if (viewport === 'mobile-390x844') {
    const footer = detail.locator('footer');
    if (await footer.isVisible().catch(() => false)) {
      await footer.scrollIntoViewIfNeeded();
      await capture(page, route, 'm06b-recibos-detalle-acciones', 'Recibos móvil — acciones del detalle', viewport);
    }
  }

  await openDetailAction(
    page,
    detail,
    /ver \/ imprimir recibo/i,
    /^comprobante\b/i,
    route,
    viewport,
    '07-recibos-comprobante',
    'Recibos — comprobante',
    viewport === 'desktop-1366x900' ? 'recibo-existente-ui.pdf' : undefined,
  );
  await openDetailAction(page, detail, /cobrar saldo/i, /registrar pago/i, route, viewport, '08-recibos-pago', 'Recibos — registrar pago');
  await openDetailAction(page, detail, /^anular$/i, /anular factura/i, route, viewport, '09-recibos-anulacion', 'Recibos — anulación');
}

async function openRecibosDetailWithFocus(page: Page, viewport: ViewportName): Promise<Locator> {
  const desktopViewport = viewport === 'desktop-1366x900';
  const trigger = desktopViewport
    ? page.getByRole('button', { name: /más acciones de la operación/i }).first()
    : page.getByRole('button', { name: /^detalle$/i }).first();
  const detail = page.getByRole('complementary', { name: /detalle de la operación/i });

  const open = async () => {
    await trigger.click();
    if (desktopViewport) {
      await page.getByRole('menuitem', { name: /^detalle$/i }).click();
      // Radix cierra el menú de forma asíncrona (cierre animado + onCloseAutoFocus).
      // Esperar el cierre real antes de asertar la vista destino, si no el menú
      // puede re-capturar el foco durante las aserciones del detail.
      await expect(page.getByRole('menu')).toHaveCount(0, { timeout: 10_000 });
    }
    await expect(detail).toBeVisible();
    await expect(detail).toBeFocused();
    await assertRecibosDetailReadyAndPositioned(detail);
  };

  await open();
  await detail.getByRole('button', { name: /cerrar detalle/i }).click();
  await expect(detail).toHaveCount(0);
  const returnedFocus = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    return {
      detailTrigger: Boolean(active?.hasAttribute('data-invoice-detail-trigger')),
      label: active?.getAttribute('aria-label') ?? active?.textContent?.trim() ?? '',
      visible: Boolean(active && active.getClientRects().length > 0),
    };
  });
  expect(returnedFocus.visible).toBe(true);
  expect(
    desktopViewport
      ? returnedFocus.detailTrigger || /más acciones de la operación/i.test(returnedFocus.label)
      : /^detalle$/i.test(returnedFocus.label),
    `El foco volvió a un control inesperado: ${returnedFocus.label}`,
  ).toBe(true);
  await open();
  return detail;
}

async function openDetailAction(
  page: Page,
  detail: Locator,
  actionName: RegExp,
  dialogName: RegExp,
  route: string,
  viewport: ViewportName,
  fileBase: string,
  surface: string,
  downloadFile?: string,
): Promise<void> {
  let action = detail.getByRole('button', { name: actionName });
  if (!await isUsable(action)) {
    const triggers = page.locator('[data-invoice-detail-trigger]:visible');
    for (let index = 1; index < Math.min(await triggers.count(), 12); index += 1) {
      await detail.getByRole('button', { name: /cerrar detalle/i }).click();
      await triggers.nth(index).click();
      await expect(detail).toBeVisible();
      await assertRecibosDetailReadyAndPositioned(detail);
      action = detail.getByRole('button', { name: actionName });
      if (await isUsable(action)) break;
    }
  }
  if (!await isUsable(action)) {
    dependency(route, surface, viewport, `Ninguna de las operaciones visibles habilita ${actionName.source}.`);
    return;
  }
  await action.click();
  const dialog = page.getByRole('dialog', { name: dialogName });
  await expect(dialog).toBeVisible();
  await assertDialogInsideViewport(dialog);
  await capture(page, route, `${prefix(viewport)}${fileBase}`, surface, viewport);
  if (downloadFile) {
    const downloadButton = dialog.getByRole('button', { name: /guardar pdf/i });
    if (await isUsable(downloadButton)) {
      const downloadPromise = page.waitForEvent('download');
      await downloadButton.click();
      await saveDownload(await downloadPromise, downloadFile);
    } else {
      dependency(route, `${surface} — descarga PDF`, viewport, 'El comprobante visible no ofrece Guardar PDF.');
    }
  }
  await closeDialog(page, dialog);
}

async function assertRecibosDetailReadyAndPositioned(detail: Locator): Promise<void> {
  await expect(detail.getByRole('status').filter({ hasText: /cargando detalle/i })).toHaveCount(0, { timeout: 15_000 });
  const heading = detail.getByRole('heading', { level: 2 });
  await expect(heading).toBeVisible();
  const headingBox = await heading.boundingBox();
  const viewport = detail.page().viewportSize();
  expect(headingBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  const minimumTop = viewport!.width < 1024 ? 56 : 0;
  expect(headingBox!.y, 'El encabezado del detalle debe quedar debajo de la cabecera fija cuando existe').toBeGreaterThanOrEqual(minimumTop);
  expect(headingBox!.y, 'El encabezado del detalle debe quedar dentro del viewport').toBeLessThan(viewport!.height);
}

async function auditCaja(page: Page, viewport: ViewportName, secondaries: boolean): Promise<void> {
  const route = '/caja';
  await page.goto(route);
  await expect(page.getByRole('heading', { level: 1, name: /^caja$/i })).toBeVisible();
  await capture(page, route, `${prefix(viewport)}10-caja`, 'Caja — estado actual', viewport);
  const tabs = page.getByRole('tablist', { name: /vista activa de caja/i });
  if (!await tabs.isVisible().catch(() => false)) {
    dependency(route, 'Caja — movimientos, arqueo y cierre', viewport, 'No hay una sesión de caja abierta; la auditoría no abre una sesión.');
    return;
  }

  for (const [name, file, surface] of [
    [/^movimientos$/i, '11-caja-movimientos', 'Caja — movimientos'],
    [/^arqueo$/i, '12-caja-arqueo', 'Caja — arqueo'],
    [/^cierre$/i, '13-caja-cierre', 'Caja — cierre'],
  ] as const) {
    await tabs.getByRole('tab', { name }).click();
    await capture(page, route, `${prefix(viewport)}${file}`, surface, viewport);
  }

  if (!secondaries) return;
  await tabs.getByRole('tab', { name: /^movimientos$/i }).click();
  const detailButton = page.getByRole('button', { name: /ver detalle del movimiento/i }).first();
  if (await isUsable(detailButton)) {
    await detailButton.click();
    const dialog = page.getByRole('dialog', { name: /detalle del movimiento/i });
    await expect(dialog).toBeVisible();
    await assertAdminDialogLayout(dialog);
    await capture(page, route, `${prefix(viewport)}14-caja-movimiento-detalle`, 'Caja — detalle de movimiento', viewport);
    await closeDialog(page, dialog);
  } else {
    dependency(route, 'Caja — detalle de movimiento', viewport, 'La sesión no tiene movimientos visibles.');
  }

  await tabs.getByRole('tab', { name: /^cierre$/i }).click();
  const closeButton = page.getByRole('button', { name: /^cerrar caja$/i });
  if (await isUsable(closeButton)) {
    const current = await fetchJson<{ data?: { expected_cash_amount?: string | null; expected_amount?: string | null; opening_amount?: string | null } }>(
      page,
      '/api/cash-sessions/current?scope=closable',
    );
    const countedAmount = current.body.data?.expected_cash_amount ?? current.body.data?.expected_amount ?? current.body.data?.opening_amount;
    expect(countedAmount, 'La sesión cerrable debe informar el efectivo esperado para revisar la confirmación sin mutar').toBeTruthy();
    await page.getByLabel(/monto contado/i).fill(countedAmount!);
    await closeButton.click();
    const dialog = page.getByRole('dialog', { name: /^cierre de caja$/i });
    await expect(dialog).toBeVisible();
    await assertAdminDialogLayout(dialog);
    await capture(page, route, `${prefix(viewport)}15-caja-cierre-revision`, 'Caja — revisión final del cierre sin confirmar', viewport);
    await closeDialog(page, dialog);
  } else {
    dependency(route, 'Caja — revisión final del cierre', viewport, 'El cierre tiene precondiciones pendientes o el usuario no puede cerrarlo.');
  }
}

async function auditReportes(page: Page, viewport: ViewportName, secondaries: boolean): Promise<void> {
  const route = '/reportes';
  await page.goto(route);
  await expect(page.getByRole('heading', { level: 1, name: /^reportes$/i })).toBeVisible();
  await capture(page, route, `${prefix(viewport)}16-reportes`, 'Reportes — resumen', viewport);
  if (!secondaries) return;
  const filters = page.getByRole('button', { name: /^filtros/i });
  if (await filters.isVisible().catch(() => false)) {
    await filters.click();
    await expect(page.locator('#reportes-filtros-secundarios')).toBeVisible();
    await capture(page, route, `${prefix(viewport)}17-reportes-filtros`, 'Reportes — filtros secundarios', viewport);
  }
  if (viewport === 'desktop-1366x900') await downloadCurrentReport(page, route, viewport);
}

async function downloadCurrentReport(page: Page, route: string, viewport: ViewportName): Promise<void> {
  const apply = page.getByRole('button', { name: /^aplicar$/i });
  if (!await isUsable(apply)) {
    dependency(route, 'Reportes — descargas PDF y Excel', viewport, 'El período o la aplicación de filtros no está disponible.');
    return;
  }
  await expect(page.getByText(/cargando reporte/i)).toHaveCount(0, { timeout: 15_000 });
  const fromInput = page.getByLabel(/^desde$/i);
  const toInput = page.getByLabel(/^hasta$/i);
  const currentFrom = await fromInput.inputValue();
  const currentTo = await toInput.inputValue();
  // Aplicar exactamente el mismo rango puede quedar servido por TanStack Query
  // sin una nueva respuesta HTTP. Elegimos un rango válido y distinto que
  // siempre conserva el último día vigente: día actual si venía un período, o
  // dos días si ya estaba aplicado un único día.
  const dateTo = currentTo;
  const dateFrom = currentFrom === currentTo ? previousIsoDay(currentFrom) : currentTo;
  await fromInput.fill(dateFrom);
  await toInput.fill(dateTo);
  const reportPromise = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET' || new URL(response.url()).pathname !== '/api/reports/executive') return false;
    const params = new URL(response.url()).searchParams;
    return params.get('date_from') === dateFrom && params.get('date_to') === dateTo;
  });
  await apply.click();
  const report = await reportPromise;
  expect(report.ok()).toBe(true);
  const filters = Object.fromEntries(new URL(report.url()).searchParams.entries());
  writeFileSync(resolve(outputRoot, 'reporte-api.json'), `${JSON.stringify({ filters, response: await report.json() }, null, 2)}\n`, 'utf8');

  for (const [buttonName, endpoint, file] of [
    [/exportar pdf/i, '/api/reports/executive/pdf', 'reporte-ejecutivo-ui.pdf'],
    [/exportar excel/i, '/api/reports/executive/excel', 'reporte-ejecutivo-ui.xlsx'],
  ] as const) {
    const button = page.getByRole('button', { name: buttonName });
    if (!await isUsable(button)) {
      dependency(route, `Reportes — ${file}`, viewport, 'La exportación está deshabilitada con el filtro aplicado.');
      continue;
    }
    const responsePromise = page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname === endpoint);
    const downloadPromise = page.waitForEvent('download');
    await button.click();
    const response = await responsePromise;
    expect(response.ok()).toBe(true);
    expect(Object.fromEntries(new URL(response.url()).searchParams.entries())).toEqual(filters);
    await saveDownload(await downloadPromise, file);
  }
}

async function auditCatalogo(page: Page, viewport: ViewportName, secondaries: boolean): Promise<void> {
  const route = '/administracion/catalogo';
  await page.goto(route);
  await expect(page.getByRole('heading', { level: 1, name: 'Productos y servicios', exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: /cargando productos y servicios/i })).toHaveCount(0);
  await capture(page, route, `${prefix(viewport)}18-catalogo`, 'Administración — catálogo', viewport);
  if (!secondaries) return;

  await openButtonDialog(page, route, viewport, /nuevo producto o servicio/i, /nuevo producto o servicio/i, '19-catalogo-nuevo', 'Catálogo — nuevo producto o servicio');

  const categories = page.getByRole('button', { name: /categorías del catálogo/i });
  if (await categories.isVisible().catch(() => false)) {
    await categories.click();
    await capture(page, route, `${prefix(viewport)}20-catalogo-categorias`, 'Catálogo — categorías desplegadas', viewport);
    await openButtonDialog(page, route, viewport, /nueva categoría/i, /nueva categoría/i, '21-catalogo-nueva-categoria', 'Catálogo — nueva categoría');
  }

  const actionTrigger = page.getByRole('button', { name: /acciones de servicio/i }).first();
  if (!await actionTrigger.isVisible().catch(() => false)) {
    dependency(route, 'Catálogo — editar e historial', viewport, 'No hay conceptos visibles con menú de acciones.');
    return;
  }
  await assertMenuEscapeRestoresFocus(page, actionTrigger);
  await openMenuDialog(page, actionTrigger, /editar/i, /editar producto o servicio/i, route, viewport, '22-catalogo-editar', 'Catálogo — editar producto o servicio');
  await openMenuDialog(page, actionTrigger, /historial/i, /historial de/i, route, viewport, '23-catalogo-historial', 'Catálogo — historial');
}

async function auditUsuarios(page: Page, viewport: ViewportName, secondaries: boolean): Promise<void> {
  const route = '/administracion/usuarios';
  await page.goto(route);
  await expect(page.getByRole('heading', { name: /usuarios y roles/i })).toBeVisible();
  await capture(page, route, `${prefix(viewport)}24-usuarios`, 'Administración — usuarios y roles', viewport);
  if (!secondaries) return;
  await openButtonDialog(page, route, viewport, /^crear usuario$/i, /^crear usuario$/i, '25-usuarios-crear', 'Usuarios — crear usuario');
  await openButtonDialog(page, route, viewport, /^nuevo rol$/i, /^nuevo rol$/i, '26-usuarios-rol', 'Usuarios — nuevo rol');

  const trigger = page.getByRole('button', { name: /acciones de usuario/i }).first();
  if (await trigger.isVisible().catch(() => false)) {
    await assertMenuEscapeRestoresFocus(page, trigger);
    await openMenuDialog(page, trigger, /^editar$/i, /^editar usuario$/i, route, viewport, '27-usuarios-editar', 'Usuarios — editar usuario');
    const visibleTriggers = page.locator('button[aria-label*="Acciones de usuario"]:visible');
    let permissionsCaptured = false;
    for (let index = 0; index < Math.min(await visibleTriggers.count(), 8); index += 1) {
      await visibleTriggers.nth(index).click();
      const edit = page.getByRole('menuitem', { name: /^editar$/i });
      if (!await isUsable(edit)) {
        await page.keyboard.press('Escape');
        continue;
      }
      await edit.click();
      const dialog = page.getByRole('dialog', { name: /^editar usuario$/i });
      await expect(dialog).toBeVisible();
      const advancedPermissions = dialog.getByRole('button', { name: /permisos exactos avanzados/i });
      if (await isUsable(advancedPermissions)) {
        await advancedPermissions.click();
        await expect(dialog.getByRole('heading', { name: /acceso por modulos/i })).toBeVisible();
        await capture(page, route, `${prefix(viewport)}27b-usuarios-permisos`, 'Usuarios — permisos exactos avanzados', viewport);
        permissionsCaptured = true;
        await closeDialog(page, dialog);
        break;
      }
      await closeDialog(page, dialog);
    }
    if (!permissionsCaptured) {
      dependency(route, 'Usuarios — permisos exactos avanzados', viewport, 'Ninguna cuenta visible permite revisar permisos exactos con este rol.');
    }
  } else {
    dependency(route, 'Usuarios — editar usuario', viewport, 'No hay usuario visible con menú de acciones editable.');
  }
}

async function auditAjustes(page: Page, viewport: ViewportName, secondaries: boolean): Promise<void> {
  const route = '/administracion/ajustes';
  await page.goto(route);
  await expect(page.getByRole('heading', { level: 1, name: /ajustes institucionales/i })).toBeVisible();
  await capture(page, route, `${prefix(viewport)}28-ajustes`, 'Ajustes — sección inicial', viewport);
  if (!secondaries) return;

  const settingsTabs = [/^identidad$/i, /^numeración$/i, /reglas de cobro/i, /^impresión$/i];
  for (const [index, tabName] of settingsTabs.entries()) {
    const tab = page.getByRole('tab', { name: tabName }).last();
    if (!await tab.isVisible().catch(() => false)) {
      dependency(route, `Ajustes — ${tabName.source}`, viewport, 'La subsección no está autorizada para este usuario.');
      continue;
    }
    await tab.click();
    await capture(page, route, `${prefix(viewport)}${29 + index}-ajustes-seccion-${index + 1}`, `Ajustes — ${await tab.textContent()}`, viewport);
  }

  // El guard de salida se revisa con un cambio local que nunca se guarda. La
  // ida y vuelta entre pestañas también acredita que el borrador no desaparece
  // por cambiar de subsección.
  const identityTab = page.getByRole('tab', { name: /^identidad$/i }).last();
  if (await identityTab.isVisible().catch(() => false)) {
    await identityTab.click();
    const hospitalName = page.getByLabel(/^nombre del hospital$/i);
    if (await hospitalName.isEnabled().catch(() => false)) {
      const originalName = await hospitalName.inputValue();
      const draftName = `${originalName || 'Hospital'} QA VISUAL`;
      await hospitalName.fill(draftName);
      const numerationTab = page.getByRole('tab', { name: /numeración/i }).last();
      await numerationTab.click();
      await identityTab.click();
      await expect(hospitalName).toHaveValue(draftName);

      const catalogLink = page.locator('a[href="/administracion/catalogo"]').last();
      await expect(catalogLink).toHaveAccessibleName(/^catálogo y precios$/i);
      await catalogLink.click();
      const warning = page.getByRole('alertdialog', { name: /descartar cambios sin guardar/i });
      await expect(warning).toBeVisible();
      await assertDialogInsideViewport(warning);
      await capture(page, route, `${prefix(viewport)}33-ajustes-cambios-sin-guardar`, 'Ajustes — advertencia de salida con borrador', viewport);
      await warning.getByRole('button', { name: /seguir editando/i }).click();
      await expect(warning).toHaveCount(0);
      await expect(page).toHaveURL(/\/administracion\/ajustes/);
      await expect(hospitalName).toHaveValue(draftName);
      await hospitalName.fill(originalName);
    } else {
      dependency(route, 'Ajustes — advertencia de cambios sin guardar', viewport, 'El formulario Hospital está en modo lectura.');
    }
  }

  const advancedTab = page.getByRole('tab', { name: /^impresión$/i });
  if (!await advancedTab.isVisible().catch(() => false)) {
    dependency(route, 'Ajustes — impresión', viewport, 'El usuario no tiene permiso de impresión.');
    return;
  }
  await advancedTab.click();
  for (const [index, sectionName] of [/^serie institucional$/i, /^papel del recibo$/i, /^vista previa del motor$/i].entries()) {
    const heading = page.getByRole('heading', { name: sectionName }).last();
    await expect(heading).toBeVisible();
    await heading.scrollIntoViewIfNeeded();
    await capture(page, `${route}?panel=papel`, `${prefix(viewport)}${34 + index}-ajustes-recibo-${index + 1}`, `Ajustes — ${await heading.textContent()}`, viewport);
  }
}

async function auditRespaldos(page: Page, viewport: ViewportName, secondaries: boolean): Promise<void> {
  const route = '/administracion/mantenimiento/respaldos';
  await page.goto(route);
  await expect(page.getByRole('heading', { name: /^respaldos$/i })).toBeVisible();
  await expect(page.getByRole('status', { name: /verificando salud del respaldo/i })).toHaveCount(0);
  await capture(page, route, `${prefix(viewport)}36-respaldos`, 'Respaldos — salud e historial', viewport);
  if (!secondaries) return;
  const maintenance = page.getByText(/^mantenimiento y preparación$/i);
  if (await maintenance.isVisible().catch(() => false)) {
    await maintenance.click();
    await expect(page.getByRole('heading', { name: /restauración local/i })).toBeVisible();
    await capture(page, route, `${prefix(viewport)}37-respaldos-recuperacion`, 'Respaldos — preparación y recuperación local', viewport);
  } else {
    dependency(route, 'Respaldos — preparación y recuperación', viewport, 'El estado técnico no está disponible para este rol.');
  }
}

async function auditAyuda(page: Page, viewport: ViewportName, secondaries: boolean): Promise<void> {
  const route = '/administracion/ayuda';
  await page.goto(route);
  await expect(page.getByRole('heading', { name: /^ayuda$/i })).toBeVisible();
  if (secondaries) {
    const summaries = page.locator('summary');
    for (let index = 0; index < Math.min(await summaries.count(), 4); index += 1) await summaries.nth(index).click();
  }
  await capture(page, route, `${prefix(viewport)}38-ayuda`, 'Ayuda por tarea', viewport);
}

async function openButtonDialog(
  page: Page,
  route: string,
  viewport: ViewportName,
  buttonName: RegExp,
  dialogName: RegExp,
  fileBase: string,
  surface: string,
): Promise<void> {
  const button = page.getByRole('button', { name: buttonName }).first();
  if (!await isUsable(button)) {
    dependency(route, surface, viewport, `No está disponible la acción ${buttonName.source}.`);
    return;
  }
  await button.click();
  const dialog = page.getByRole('dialog', { name: dialogName });
  await expect(dialog).toBeVisible();
  await assertAdminDialogLayout(dialog);
  await capture(page, route, `${prefix(viewport)}${fileBase}`, surface, viewport);
  await closeDialog(page, dialog);
}

async function openMenuDialog(
  page: Page,
  trigger: Locator,
  itemName: RegExp,
  dialogName: RegExp,
  route: string,
  viewport: ViewportName,
  fileBase: string,
  surface: string,
): Promise<void> {
  await trigger.click();
  const item = page.getByRole('menuitem', { name: itemName });
  if (!await item.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    dependency(route, surface, viewport, `El menú no ofrece ${itemName.source} para el registro visible.`);
    return;
  }
  await item.click();
  const dialog = page.getByRole('dialog', { name: dialogName });
  await expect(dialog).toBeVisible();
  await assertAdminDialogLayout(dialog);
  await capture(page, route, `${prefix(viewport)}${fileBase}`, surface, viewport);
  await closeDialog(page, dialog);
}

async function assertMenuEscapeRestoresFocus(page: Page, trigger: Locator): Promise<void> {
  await trigger.focus();
  await trigger.press('Enter');
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(trigger).toBeFocused();
}

async function assertAdminDialogLayout(dialog: Locator): Promise<void> {
  await assertDialogInsideViewport(dialog);
  const layout = await dialog.evaluate((element) => {
    const header = element.querySelector(':scope > header');
    const body = header?.nextElementSibling;
    const footer = body?.nextElementSibling?.querySelector('button') ? body.nextElementSibling : null;
    const box = element.getBoundingClientRect();
    const headerBox = header?.getBoundingClientRect();
    const bodyStyle = body ? getComputedStyle(body) : null;
    const footerBox = footer?.getBoundingClientRect();
    return {
      overflow: getComputedStyle(element).overflow,
      headerFixed: Boolean(headerBox && Math.abs(headerBox.top - box.top) <= 2),
      bodyOverflowY: bodyStyle?.overflowY ?? '',
      footerFixed: footerBox ? Math.abs(footerBox.bottom - box.bottom) <= 2 : null,
    };
  });
  expect(layout.overflow).toBe('hidden');
  expect(layout.headerFixed).toBe(true);
  expect(['auto', 'scroll']).toContain(layout.bodyOverflowY);
  if (layout.footerFixed !== null) expect(layout.footerFixed).toBe(true);
}

async function assertDialogInsideViewport(dialog: Locator): Promise<void> {
  const box = await dialog.boundingBox();
  const viewport = dialog.page().viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(-1);
  expect(box!.y).toBeGreaterThanOrEqual(-1);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
}

async function closeDialog(page: Page, dialog: Locator): Promise<void> {
  const close = dialog.getByRole('button', { name: /^cerrar$/i }).first();
  await expect(close).toBeEnabled();
  await close.click();
  await expect(dialog).toHaveCount(0);
}

async function assertAdministrationRailContained(page: Page): Promise<void> {
  const nav = page.getByRole('navigation', { name: /secciones de administración/i });
  await expect(nav).toBeVisible();
  const metrics = await nav.evaluate((element) => {
    const scroller = element.parentElement as HTMLElement | null;
    return {
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      scrollerOverflowX: scroller ? getComputedStyle(scroller).overflowX : '',
      scrollerScrollWidth: scroller?.scrollWidth ?? 0,
      scrollerClientWidth: scroller?.clientWidth ?? 0,
    };
  });
  expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.documentClientWidth + 1);
  expect(['auto', 'scroll']).toContain(metrics.scrollerOverflowX);
  expect(metrics.scrollerScrollWidth).toBeGreaterThanOrEqual(metrics.scrollerClientWidth);
}

async function capture(
  page: Page,
  route: string,
  fileBase: string,
  surface: string,
  viewport: ViewportName,
): Promise<void> {
  await expect(page.locator('main')).toBeVisible();
  await expect(page.locator('[aria-busy="true"]:visible')).toHaveCount(0, { timeout: 20_000 });
  await expect(
    page.locator('[role="status"]:visible').filter({ hasText: /(?:cargando|preparando|buscando|consultando|comprobando)/i }),
  ).toHaveCount(0, { timeout: 20_000 });
  await assertNoDocumentOverflow(page);
  const file = `${fileBase}.png`;
  await page.screenshot({ path: resolve(capturesRoot, file), fullPage: false });
  coverage.push({ file, route, surface, viewport, status: 'captured' });
}

async function saveDownload(download: Download, filename: string): Promise<void> {
  const directory = resolve(outputRoot, 'documentos');
  mkdirSync(directory, { recursive: true });
  await download.saveAs(resolve(directory, filename));
}

async function assertNoDocumentOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth, `Desborde horizontal: ${metrics.scrollWidth}px > ${metrics.clientWidth}px`).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function isUsable(locator: Locator): Promise<boolean> {
  if (await locator.count() === 0) return false;
  try {
    await expect(locator.first()).toBeVisible({ timeout: 5_000 });
    await expect(locator.first()).toBeEnabled({ timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

function dependency(route: string, surface: string, viewport: ViewportName, note: string): void {
  coverage.push({ route, surface, viewport, status: 'dependency-missing', note });
}

function prefix(viewport: ViewportName): string {
  return viewport.startsWith('mobile') ? 'm' : '';
}

function previousIsoDay(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

