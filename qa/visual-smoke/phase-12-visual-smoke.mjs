import playwright from '../../frontend/node_modules/playwright/index.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = playwright;

const root = path.resolve(import.meta.dirname, '..');
const screenshotDir = path.join(root, 'screenshots', 'phase-12-visual-smoke');
const baseUrl = process.env.VISUAL_SMOKE_BASE_URL ?? 'http://127.0.0.1:5173';
const user = process.env.VISUAL_SMOKE_USER ?? 'admin.demo';
const password = process.env.VISUAL_SMOKE_PASSWORD ?? 'Password123!';

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
  '/catalog': /catalogo/i,
  '/invoices': /historial/i,
  '/reports': /reportes/i,
  '/backups': /backups/i,
  '/settings/fiscal': /configuracion fiscal/i,
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
    page.getByRole('button', { name: /cerrar modal/i }),
    page.getByRole('button', { name: /^cerrar$/i }),
  ];

  for (const button of closeButtons) {
    if (await button.isVisible().catch(() => false)) {
      await button.click();
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
    await clearField(page.locator('#nueva-factura input').first());
    await screenshot(page, 'billing-new-empty');

    const emitButton = page.getByRole('button', { name: /emitir factura/i });
    const patientInput = page.locator('#nueva-factura input').first();
    await clearField(patientInput);

    const searchInput = page.getByLabel(/buscar por nombre/i);
    await searchInput.fill('eritropoyetina');
    await waitSettled(page);

    const categoryButton = page.getByRole('button', { name: /medicamentos/i }).first();
    if (await categoryButton.isVisible().catch(() => false)) {
      await categoryButton.click();
    }

    const serviceButton = page.getByRole('button', { name: /eritropoyetina/i }).first();
    await serviceButton.click();
    await waitSettled(page);
    await clearField(patientInput);
    await screenshot(page, 'billing-new-with-services');

    await clearField(patientInput);
    await emitButton.click();
    await page.getByText(/ingrese el nombre del paciente|falta el nombre del paciente/i).waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    const missingPatientText = await page.locator('body').innerText();
    if (!/ingrese el nombre del paciente|falta el nombre del paciente/i.test(missingPatientText)) {
      findings.push('billing-new-with-services: no se vio alerta inmediata al intentar emitir sin paciente.');
    }

    await patientInput.fill(`Paciente Smoke ${Date.now()}`);
    await emitButton.click();
    await page.getByRole('dialog', { name: /confirmar factura/i }).waitFor({ state: 'visible', timeout: 10000 });
    await screenshot(page, 'billing-confirm-modal');
    await page.getByRole('button', { name: /confirmar emision/i }).click();
    await page.getByRole('dialog', { name: /factura emitida/i }).waitFor({ state: 'visible', timeout: 15000 });
    const issuedText = await page.getByRole('dialog', { name: /factura emitida/i }).innerText();
    lastInvoiceNumber = issuedText.match(/000-\d{3}-\d{2}-\d{8}/)?.[0] ?? '';

    await page.getByRole('button', { name: /cobrar ahora/i }).click();
    await page.getByRole('heading', { name: /registrar pago/i }).waitFor({ state: 'visible', timeout: 10000 });
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
    if (lastInvoiceNumber) {
      await page.getByText(lastInvoiceNumber).waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    }
    if (lastInvoiceNumber && !(await page.getByText(lastInvoiceNumber).isVisible().catch(() => false))) {
      findings.push(`invoices-history: la factura ${lastInvoiceNumber} no aparece visible en historial.`);
    }
    await screenshot(page, 'invoices-history');
    await page.getByRole('main').getByRole('button', { name: /ver acciones de factura/i }).first().click();
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
    if (!/total cobrado|top servicios|auditoria operativa/i.test(reportsText)) {
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
