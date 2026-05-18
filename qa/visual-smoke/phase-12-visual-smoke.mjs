import playwright from '../../frontend/node_modules/playwright/index.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = playwright;

const root = path.resolve(import.meta.dirname, '..');
const screenshotDir = path.join(root, 'screenshots', 'phase-12-visual-smoke');
const baseUrl = process.env.VISUAL_SMOKE_BASE_URL ?? 'http://127.0.0.1:5173';
const user = process.env.VISUAL_SMOKE_USER ?? 'admin.demo';
const password = process.env.VISUAL_SMOKE_PASSWORD ?? 'Password123!';
const isLocalDemoTarget = baseUrl === 'http://127.0.0.1:8000' && user === 'admin.demo';
const allowMutations = process.env.VISUAL_SMOKE_ALLOW_MUTATIONS === '1' || isLocalDemoTarget;

if (!allowMutations) {
  throw new Error('Visual smoke creates invoices/payments. Set VISUAL_SMOKE_ALLOW_MUTATIONS=1 or use the local admin.demo target.');
}

const routeScreens = {
  dashboard: '/dashboard',
  'billing-new-empty': '/billing/new',
  'billing-new-with-services': '/billing/new',
  'billing-confirm-modal': '/billing/new',
  'receipt-preview': '/billing/new',
  cashbox: '/cashbox',
  catalog: '/catalog',
  'invoices-history': '/invoices',
  reports: '/reports',
  backups: '/backups',
  'fiscal-settings': '/settings/fiscal',
};

const routeLabels = {
  '/dashboard': /inicio/i,
  '/billing/new': /nueva factura/i,
  '/cashbox': /^caja$/i,
  '/catalog': /cat.logo/i,
  '/invoices': /historial/i,
  '/reports': /reportes/i,
  '/backups': /backups/i,
  '/settings/fiscal': /configuraci.n fiscal/i,
};

const consoleByScreen = {};
const findings = [];
let activeScreen = 'bootstrap';
let lastInvoiceNumber = '';

function mark(screen) {
  activeScreen = screen;
  consoleByScreen[screen] ??= [];
}

function record(issue) {
  consoleByScreen[activeScreen] ??= [];
  consoleByScreen[activeScreen].push(issue);
}

async function screenshot(page, name) {
  mark(name);
  await page.screenshot({ path: path.join(screenshotDir, `${name}.png`), fullPage: true });
}

async function waitSettled(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function waitServicesReady(page) {
  await page.getByText(/cargando servicios/i).waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {});
}

async function cartItemCount(page) {
  const emptyCartVisible = await page.getByText(/no hay servicios agregados/i).isVisible().catch(() => false);
  if (emptyCartVisible) return 0;

  const countText = await page.locator('#nueva-factura').getByText(/^\d+$/).last().textContent().catch(() => '');
  const parsed = Number.parseInt(countText || '1', 10);
  return Number.isFinite(parsed) ? parsed : 1;
}

async function clickFirstVisible(page, candidates, options = {}) {
  for (const candidate of candidates) {
    const locator = typeof candidate === 'string' ? page.getByRole('button', { name: candidate, exact: true }) : candidate;
    if (await locator.isVisible().catch(() => false)) {
      await locator.click(options);
      return true;
    }
  }
  return false;
}

async function closeOperationalDialogIfPresent(page) {
  const closeButtons = [
    page.getByRole('button', { name: /cerrar modal/i }).first(),
    page.getByRole('button', { name: /^cerrar$/i }).first(),
  ];

  for (const button of closeButtons) {
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      await waitSettled(page);
      return true;
    }
  }

  return false;
}

async function clearField(locator) {
  await locator.fill('Temporal');
  await locator.fill('');
  await locator.evaluate((element) => {
    const input = element;
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function isEmitEnabled(page) {
  const emitButton = page.getByRole('button', { name: /emitir factura/i });
  if (!(await emitButton.isVisible().catch(() => false))) {
    return false;
  }

  return emitButton.isEnabled();
}

async function firstActiveService(page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/services?active=1&per_page=150', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    const services = (await response.json()).data ?? [];
    return services.find((service) => service.scan_code || service.barcode || service.qr_code) ?? services[0] ?? null;
  }).catch(() => null);
}

async function ensureLoggedIn(page) {
  mark('login');
  await page.goto(`${baseUrl}/login`);
  await waitSettled(page);

  if (await page.getByRole('link', { name: /nueva factura/i }).isVisible().catch(() => false)) {
    return;
  }

  await page.getByLabel(/usuario o email/i).fill(user);
  await page.getByLabel(/contrasena/i).fill(password);
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL(/dashboard|billing|cashbox|catalog|invoices|reports|backups|settings/, { timeout: 15000 });
  await waitSettled(page);
}

async function ensureCashOpen(page) {
  const current = await page.evaluate(async () => {
    const response = await fetch('/api/cash-sessions/current', {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()).data;
  }).catch(() => null);

  if (current?.status === 'open') {
    return;
  }

  if (await page.getByText(/caja abierta/i).isVisible().catch(() => false)) {
    return;
  }

  if (await page.getByLabel(/monto inicial/i).isVisible().catch(() => false)) {
    await page.getByLabel(/monto inicial/i).fill('500.00');
    const openButtons = page.getByRole('button', { name: /^abrir caja$/i });
    const count = await openButtons.count();
    await openButtons.nth(Math.max(0, count - 1)).click();
    await waitSettled(page);
    await closeOperationalDialogIfPresent(page);
    return;
  }

  if (await page.getByRole('button', { name: /abrir caja/i }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /abrir caja/i }).click();
    await waitSettled(page);
    if (await page.getByLabel(/monto inicial/i).isVisible().catch(() => false)) {
      await page.getByLabel(/monto inicial/i).fill('500.00');
      const openButtons = page.getByRole('button', { name: /^abrir caja$/i });
      const count = await openButtons.count();
      await openButtons.nth(Math.max(0, count - 1)).click();
      await waitSettled(page);
    }
    await closeOperationalDialogIfPresent(page);
  }
}

async function navigate(page, route, screen) {
  mark(screen);
  if (new URL(page.url()).pathname !== route) {
    const label = routeLabels[route];
    const link = label ? page.getByRole('link', { name: label }) : null;

    if (link && await link.isVisible().catch(() => false)) {
      await link.click();
      await page.waitForURL((url) => url.pathname === route, { timeout: 10000 });
    } else {
      await page.goto(`${baseUrl}${route}`);
    }
  }
  await waitSettled(page);
  if (await page.getByText(/sesion vencida|vuelva a iniciar sesion/i).isVisible().catch(() => false)) {
    findings.push(`${screen}: la sesion aparece vencida durante el smoke.`);
  }
  if (await page.getByText(/unauthenticated/i).isVisible().catch(() => false)) {
    findings.push(`${screen}: texto crudo Unauthenticated visible.`);
  }
}

async function main() {
  await mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    baseURL: baseUrl,
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  page.on('console', (message) => {
    if (message.type() === 'error') {
      record(`console.error: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => record(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    const url = request.url();
    if (url.includes('/@vite') || url.includes('favicon') || url.includes('/sanctum/csrf-cookie')) {
      return;
    }
    record(`requestfailed: ${request.method()} ${url} ${failure?.errorText ?? ''}`.trim());
  });
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if ([401, 419].includes(status) || status >= 500) {
      record(`http.${status}: ${response.request().method()} ${url}`);
    }
  });

  try {
    await ensureLoggedIn(page);

    await navigate(page, routeScreens.dashboard, 'dashboard');
    await screenshot(page, 'dashboard');

    await navigate(page, routeScreens.cashbox, 'cashbox');
    await ensureCashOpen(page);

    await navigate(page, routeScreens['billing-new-empty'], 'billing-new-empty');
    await waitServicesReady(page);
    await clearField(page.locator('#nueva-factura input').first());
    await screenshot(page, 'billing-new-empty');

    const patientInput = page.locator('#nueva-factura input').first();
    await clearField(patientInput);

    const emitEnabledWithoutPatient = await isEmitEnabled(page);
    if (emitEnabledWithoutPatient) {
      findings.push('billing-new-empty: el boton Emitir Factura no debe estar habilitado sin paciente.');
    }

    const serviceForSmoke = await firstActiveService(page);
    const serviceCode = serviceForSmoke?.scan_code || serviceForSmoke?.barcode || serviceForSmoke?.qr_code || '';
    const serviceQuery = serviceCode || serviceForSmoke?.name || 'glucosa';
    const serviceName = serviceForSmoke?.name || serviceQuery;

    if (serviceCode) {
      await page.getByLabel(/scanner usb o codigo manual/i).fill(serviceCode);
      await page.getByRole('button', { name: /escanear/i }).click();
      await waitSettled(page);
      await waitServicesReady(page);
      await page.getByRole('button', { name: /emitir factura/i }).waitFor({ state: 'visible', timeout: 15000 });
    } else {
      const searchInput = page.getByLabel(/buscar por nombre/i);
      await searchInput.fill(serviceQuery);
      await waitSettled(page);

      const serviceButton = page.getByRole('button', { name: new RegExp(serviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }).first();
      if (await serviceButton.isVisible().catch(() => false)) {
        await serviceButton.click();
        await waitSettled(page);
      } else {
        await searchInput.fill('');
        await waitSettled(page);
        const firstVisibleService = page.locator('#nueva-factura button').filter({ hasText: /L\.\s*\d/ }).first();
        if (await firstVisibleService.isVisible().catch(() => false)) {
          await firstVisibleService.click();
          await waitSettled(page);
        } else {
          findings.push(`billing-new-with-services: no se encontro servicio activo visible para ${serviceQuery}.`);
        }
      }
    }
    if ((await cartItemCount(page)) < 1) {
      findings.push(`billing-new-with-services: scanner/busqueda no agrego ${serviceName} al carrito.`);
    }
    await screenshot(page, 'billing-new-with-services');

    const emitEnabledWithoutPatientAfterService = await isEmitEnabled(page);
    if (emitEnabledWithoutPatientAfterService) {
      findings.push('billing-new-with-services: el boton Emitir Factura no debe estar habilitado sin paciente.');
    }

    await patientInput.fill(`Paciente Smoke ${Date.now()}`);
    await waitSettled(page);
    await waitServicesReady(page);
    await page.getByRole('button', { name: /emitir factura/i }).waitFor({ state: 'visible', timeout: 15000 });

    const emitButton = page.getByRole('button', { name: /emitir factura/i });
    const emitEnabledWithPatient = await isEmitEnabled(page);
    if (!emitEnabledWithPatient) {
      findings.push('billing-new-with-services: el boton Emitir Factura debe estar habilitado con paciente y servicio.');
    }

    await emitButton.click();
    await page.getByRole('dialog', { name: /confirmar factura/i }).waitFor({ state: 'visible', timeout: 10000 });
    await screenshot(page, 'billing-confirm-modal');
    await page.getByRole('button', { name: /confirmar emision/i }).click();

    const successDialog = page.getByRole('dialog', { name: /factura emitida/i });
    const paymentHeading = page.getByRole('heading', { name: /registrar pago/i });
    await Promise.race([
      successDialog.waitFor({ state: 'visible', timeout: 15000 }),
      paymentHeading.waitFor({ state: 'visible', timeout: 15000 }),
    ]);

    if (await successDialog.isVisible().catch(() => false)) {
      const issuedText = await successDialog.innerText();
      lastInvoiceNumber = issuedText.match(/000-\d{3}-\d{2}-\d{8}/)?.[0] ?? '';
      await page.getByRole('button', { name: /cobrar ahora/i }).click();
      await paymentHeading.waitFor({ state: 'visible', timeout: 10000 });
    } else {
      const paymentText = await page.getByRole('dialog').filter({ has: paymentHeading }).innerText();
      lastInvoiceNumber = paymentText.match(/000-\d{3}-\d{2}-\d{8}/)?.[0] ?? '';
    }

    await page.getByRole('button', { name: /confirmar cobro/i }).click();
    await page.getByLabel(/vista previa del recibo/i).waitFor({ state: 'visible', timeout: 15000 });
    await screenshot(page, 'receipt-preview');
    await closeOperationalDialogIfPresent(page);

    await navigate(page, routeScreens.cashbox, 'cashbox');
    await screenshot(page, 'cashbox');

    await navigate(page, routeScreens['invoices-history'], 'invoices-history');
    if (lastInvoiceNumber && await page.getByLabel(/numero de factura/i).isVisible().catch(() => false)) {
      await clearField(page.getByLabel(/numero de factura/i));
      await page.getByLabel(/numero de factura/i).fill(lastInvoiceNumber);
    }
    await page.getByRole('button', { name: /buscar|filtrar/i }).click().catch(() => {});
    await waitSettled(page);
    await page.getByRole('button', { name: /buscar/i }).waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    if (lastInvoiceNumber) {
      await page.getByText(lastInvoiceNumber).first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    }
    if (lastInvoiceNumber && !(await page.getByText(lastInvoiceNumber).first().isVisible().catch(() => false))) {
      findings.push(`invoices-history: la factura ${lastInvoiceNumber} no aparece visible en historial.`);
    }
    await screenshot(page, 'invoices-history');
    const invoiceRow = lastInvoiceNumber
      ? page.locator('tr').filter({ hasText: lastInvoiceNumber }).first()
      : page.locator('tr').filter({ has: page.getByRole('button', { name: /ver acciones de factura/i }) }).first();
    await invoiceRow.getByRole('button', { name: /ver acciones de factura/i }).click();
    await page.getByRole('button', { name: /reimprimir/i }).click();
    await page.getByLabel(/vista previa del recibo/i).waitFor({ state: 'visible', timeout: 15000 });
    await closeOperationalDialogIfPresent(page);

    await navigate(page, routeScreens.catalog, 'catalog');
    if (await page.getByLabel(/buscar/i).isVisible().catch(() => false)) {
      await page.getByLabel(/buscar/i).fill('glucosa');
      await waitSettled(page);
    }
    await screenshot(page, 'catalog');

    await navigate(page, routeScreens.reports, 'reports');
    await page.getByRole('tab', { name: /rango/i }).click().catch(async () => {
      await page.getByRole('button', { name: /rango/i }).click();
    });
    await page.getByRole('button', { name: /ver rango/i }).click().catch(() => {});
    await page.getByText(/total cobrado/i).waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await screenshot(page, 'reports');
    const reportsText = await page.locator('body').innerText();
    if (!/total cobrado|total ingresos|top servicios|auditoria operativa/i.test(reportsText)) {
      findings.push('reports: no se encontraron metricas utiles visibles.');
    }

    await navigate(page, routeScreens.backups, 'backups');
    await page.getByText(/no hay backups|pendiente|completado|fallido/i).waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await screenshot(page, 'backups');
    const backupsText = await page.locator('body').innerText();
    if (!/no hay backups|backup|pendiente|completado|fallido/i.test(backupsText)) {
      findings.push('backups: el estado vacio o pendiente no se entiende visualmente.');
    }

    await navigate(page, routeScreens['fiscal-settings'], 'fiscal-settings');
    await page.getByText(/cai|rtn|secuencia|ancho de recibo/i).waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await screenshot(page, 'fiscal-settings');
    const fiscalText = await page.locator('body').innerText();
    if (!/cai|rtn|recibo|secuencia/i.test(fiscalText)) {
      findings.push('fiscal-settings: no se ve guia fiscal suficiente.');
    }
  } finally {
    const allIssues = Object.entries(consoleByScreen)
      .flatMap(([screen, issues]) => issues.map((issue) => `${screen}: ${issue}`));
    const report = {
      url: baseUrl,
      user,
      role: 'admin',
      environment: 'local-real',
      mutationMode: process.env.VISUAL_SMOKE_ALLOW_MUTATIONS === '1' ? 'explicit' : 'local-admin-demo-default',
      screenshots: Object.keys(routeScreens).map((name) => ({
        name,
        route: routeScreens[name],
        path: path.join(screenshotDir, `${name}.png`),
      })),
      lastInvoiceNumber,
      consoleByScreen,
      consoleIssueCount: allIssues.length,
      findings,
      blockerCount: allIssues.length + findings.length,
    };
    await writeFile(path.join(screenshotDir, 'visual-smoke-report.json'), JSON.stringify(report, null, 2));
    await browser.close();

    if (allIssues.length > 0 || findings.length > 0) {
      throw new Error(`Visual smoke found blockers: ${[...allIssues, ...findings].join(' | ')}`);
    }
  }
}

await main();
