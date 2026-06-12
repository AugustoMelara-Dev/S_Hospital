import playwright from '../../frontend/node_modules/playwright/index.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = playwright;

const baseUrl = process.env.F6_VISUAL_BASE_URL?.trim() || 'http://127.0.0.1:5173';
const loginUser = process.env.F6_VISUAL_USER?.trim() || 'admin.validacion';
const loginPassword = process.env.F6_VISUAL_PASSWORD?.trim() || 'Password123!';
const outputPhase = process.env.F6_VISUAL_OUTPUT_PHASE?.trim() || 'smoke';
const outputDir = path.resolve(import.meta.dirname, '..', 'screenshots', outputPhase);
const reportPath = path.join(outputDir, 'f6-operational-polish-report.json');
const requestedViewportIds = splitEnvList(process.env.F6_VISUAL_VIEWPORTS);
const requestedRouteNames = splitEnvList(process.env.F6_VISUAL_ROUTES);
const mergeReport = process.env.F6_VISUAL_MERGE === '1';
const fullMatrix = process.env.F6_VISUAL_FULL === '1';

function splitEnvList(value) {
  return new Set(
    (value ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
}

const routes = [
  { name: 'dashboard', path: '/dashboard', evidence: /inicio|facturacion y cobros/i },
  { name: 'new-invoice', path: '/billing/new', evidence: /nueva factura|nombre del paciente/i },
  { name: 'cashbox', path: '/cashbox', evidence: /caja|monto contado|monto inicial/i },
  { name: 'catalog', path: '/catalog', evidence: /catalogo|servicios|precio/i },
  { name: 'invoice-history', path: '/invoices', evidence: /historial|facturas|paciente/i },
  { name: 'reports', path: '/reports', evidence: /reportes|diario|rango/i },
  { name: 'backups', path: '/backups', evidence: /respaldos|backup|estado operativo/i },
  { name: 'settings-fiscal', path: '/settings/fiscal', evidence: /configuracion|cai|rtn|recibo/i },
  { name: 'users', path: '/admin/users', evidence: /usuarios|rol|crear usuario/i },
];

const allViewportSets = [
  { id: 'desktop-light', width: 1440, height: 960, theme: 'light', routes },
  {
    id: 'desktop-dark',
    width: 1440,
    height: 960,
    theme: 'dark',
    routes: routes.filter((route) => ['dashboard', 'new-invoice', 'invoice-history', 'reports', 'backups'].includes(route.name)),
  },
  {
    id: 'laptop-light',
    width: 1280,
    height: 720,
    theme: 'light',
    routes: routes.filter((route) => ['dashboard', 'catalog', 'invoice-history', 'reports'].includes(route.name)),
  },
  {
    id: 'tablet-light',
    width: 820,
    height: 1180,
    theme: 'light',
    routes: routes.filter((route) => ['dashboard', 'new-invoice', 'catalog', 'invoice-history', 'backups'].includes(route.name)),
  },
  {
    id: 'mobile-light',
    width: 390,
    height: 844,
    theme: 'light',
    routes: routes.filter((route) => ['dashboard', 'new-invoice', 'invoice-history'].includes(route.name)),
  },
];

const defaultSmokeRoutes = new Map([
  ['desktop-light', new Set(['dashboard', 'new-invoice', 'catalog', 'invoice-history', 'reports'])],
]);

const viewportSets = allViewportSets
  .filter((viewport) => {
    if (requestedViewportIds.size > 0) return requestedViewportIds.has(viewport.id);
    if (fullMatrix) return true;

    return defaultSmokeRoutes.has(viewport.id);
  })
  .map((viewport) => ({
    ...viewport,
    routes: viewport.routes.filter((route) => {
      if (requestedRouteNames.size > 0) return requestedRouteNames.has(route.name);
      if (fullMatrix || requestedViewportIds.size > 0) return true;

      return defaultSmokeRoutes.get(viewport.id)?.has(route.name);
    }),
  }))
  .filter((viewport) => viewport.routes.length > 0 || requestedRouteNames.size === 0);

function sanitizeLogText(text) {
  return text.replaceAll(loginPassword, '[redacted]').replace(/\s+/g, ' ').trim();
}

async function waitSettled(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {});
  await page.waitForTimeout(900);
}

async function bodyText(page) {
  return sanitizeLogText(await page.locator('body').innerText().catch(() => ''));
}

async function waitForSessionGate(page) {
  await page.waitForFunction(
    () => !/cargando sesi/i.test(document.body?.innerText ?? ''),
    undefined,
    { timeout: 12000 },
  ).catch(() => {});
}

async function apiLogin(context) {
  const csrfResponse = await context.request.get(`${baseUrl}/sanctum/csrf-cookie`, {
    headers: { Accept: 'application/json' },
  });

  if (!csrfResponse.ok()) {
    throw new Error(`CSRF request failed with ${csrfResponse.status()}`);
  }

  const cookies = await context.cookies(baseUrl);
  const xsrfToken = cookies.find((cookie) => cookie.name === 'XSRF-TOKEN')?.value;
  const loginResponse = await context.request.post(`${baseUrl}/api/auth/login`, {
    data: { login: loginUser, password: loginPassword },
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(xsrfToken ? { 'X-XSRF-TOKEN': decodeURIComponent(xsrfToken) } : {}),
    },
  });

  if (!loginResponse.ok()) {
    throw new Error(`Login request failed with ${loginResponse.status()}: ${sanitizeLogText(await loginResponse.text())}`);
  }
}

async function login(page) {
  await page.goto(`${baseUrl}/login`);
  await waitSettled(page);
  await waitForSessionGate(page);

  if (!/iniciar sesi|usuario o correo|contrase/i.test(await bodyText(page))) {
    return true;
  }

  await page.getByLabel(/usuario o correo/i).fill(loginUser);
  await page.locator('#password-input').fill(loginPassword);
  await page.getByRole('button', { name: /iniciar sesi/i }).click();
  await page.waitForURL(/dashboard|cashbox|backups|settings|billing|catalog|invoices|reports|admin/, { timeout: 30000 }).catch(() => {});
  await page.getByText(/Administrador Validacion|Operacion en red local|Inicio|Nueva factura/i).first().waitFor({ timeout: 30000 }).catch(() => {});
  await waitSettled(page);
  await waitForSessionGate(page);

  const text = await bodyText(page);

  return !/iniciar sesi|usuario o correo|contrase|cargando sesi/i.test(text);
}

async function ensureCashSession(page, findings) {
  await page.goto(`${baseUrl}/cashbox`);
  await waitSettled(page);

  if (await page.getByText(/caja lista para facturar|monto contado/i).first().isVisible().catch(() => false)) {
    return;
  }

  const openingAmount = page.getByLabel(/monto inicial/i).first();
  if (!await openingAmount.isVisible().catch(() => false)) {
    findings.push({ level: 'warn', context: 'cashbox', message: 'No open cash form was visible.' });
    return;
  }

  await openingAmount.fill('500.00');
  await page.getByRole('button', { name: /abrir caja/i }).first().click();
  await page.getByText(/caja abierta|caja lista para facturar|nueva factura/i).first().waitFor({ timeout: 20000 }).catch(() => {});
  await waitSettled(page);
}

async function capture(page, viewportId, name, captures) {
  const screenshotPath = path.join(outputDir, `f6-${viewportId}-${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  const inspection = await inspectPage(page);

  captures.push({
    viewport: viewportId,
    name,
    route: new URL(page.url()).pathname,
    screenshot: screenshotPath,
    snippet: (await bodyText(page)).slice(0, 300),
    inspection,
  });

  console.log(`captured ${viewportId}/${name}`);
}

async function inspectPage(page) {
  return page.evaluate(() => {
    const unnamedControls = Array.from(document.querySelectorAll('input, select, textarea, button, a'))
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const hidden =
          element.hasAttribute('hidden') ||
          element.getAttribute('aria-hidden') === 'true' ||
          element.closest('[aria-hidden="true"]') ||
          (rect.width === 0 && rect.height === 0 && element.getClientRects().length === 0);

        if (hidden) return false;
        if (element.matches('a,button') && element.textContent?.trim()) return false;
        const id = element.getAttribute('id');
        const ariaLabel = element.getAttribute('aria-label');
        const labelledBy = element.getAttribute('aria-labelledby');
        const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;

        return !ariaLabel && !labelledBy && !label;
      })
      .slice(0, 12)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute('type'),
        id: element.getAttribute('id'),
        text: element.textContent?.trim().slice(0, 60) ?? '',
      }));

    return {
      title: document.title,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      unnamedControls,
      headings: Array.from(document.querySelectorAll('h1,h2,h3')).map((heading) => heading.textContent?.trim()).filter(Boolean).slice(0, 20),
      mainTextLength: document.querySelector('main')?.textContent?.trim().length ?? 0,
    };
  });
}

async function tryReceiptFlow(page, viewportId, captures, findings) {
  await ensureCashSession(page, findings);
  await page.goto(`${baseUrl}/billing/new`);
  await waitSettled(page);

  const patientInput = page.locator('#patient-name');
  if (!await patientInput.isVisible().catch(() => false)) {
    findings.push({ level: 'warn', context: 'receipt', message: 'Patient input was not visible; receipt flow skipped.' });
    return;
  }

  await patientInput.fill(`Paciente F6 ${Date.now()}`);
  const search = page.locator('input[aria-label="Buscar por nombre, categoria o codigo"]').first();
  await search.fill('consulta');
  await page.waitForTimeout(1500);

  const buttons = page.locator('button[aria-label^="Agregar "]');
  if (await buttons.count() === 0) {
    findings.push({ level: 'warn', context: 'receipt', message: 'No billable service button was visible; receipt flow skipped.' });
    return;
  }

  await buttons.first().click();
  await capture(page, viewportId, 'new-invoice-with-service', captures);

  const emitButton = page.getByRole('button', { name: /emitir y cobrar/i }).first();
  if (!await emitButton.isVisible().catch(() => false)) {
    findings.push({ level: 'warn', context: 'receipt', message: 'Emit and charge button was not visible.' });
    return;
  }

  await emitButton.click();
  await page.getByRole('button', { name: /emitir y abrir cobro/i }).click({ timeout: 10000 }).catch(() => {});
  await page.getByRole('heading', { name: /registrar pago/i }).waitFor({ timeout: 20000 }).catch(() => {});

  const previewCheckbox = page.getByLabel(/ver preview antes de imprimir/i);
  if (await previewCheckbox.isVisible().catch(() => false) && !await previewCheckbox.isChecked().catch(() => false)) {
    await previewCheckbox.check();
  }

  const amount = page.getByLabel(/monto recibido/i);
  if (!await amount.isVisible().catch(() => false)) {
    findings.push({ level: 'warn', context: 'receipt', message: 'Payment amount field was not visible.' });
    return;
  }

  const max = await amount.getAttribute('max');
  await amount.fill(max && Number(max) > 0 ? max : '1.00');
  await page.getByRole('button', { name: /confirmar cobro/i }).click();
  await page.getByLabel(/recibo institucional/i).waitFor({ timeout: 25000 }).catch(() => {});

  if (await page.getByLabel(/recibo institucional/i).isVisible().catch(() => false)) {
    await capture(page, viewportId, 'receipt-payment-preview', captures);
  } else {
    findings.push({ level: 'warn', context: 'receipt', message: 'Receipt preview did not become visible after payment.' });
  }
}

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const captures = [];
const consoleEntries = [];
const findings = [];
let activeViewportId = 'setup';

function attachPageObservers(page) {
  page.on('console', (message) => {
    if (!['error', 'warning', 'warn'].includes(message.type())) return;
    const text = sanitizeLogText(message.text());
    if (text.includes('/@vite') || text.includes('favicon') || text.includes('Download the React DevTools')) return;
    consoleEntries.push({ viewport: activeViewportId, level: message.type(), text, url: page.url() });
  });
  page.on('pageerror', (error) => {
    consoleEntries.push({ viewport: activeViewportId, level: 'pageerror', text: sanitizeLogText(error.message), url: page.url() });
  });
  page.on('response', (response) => {
    if (response.status() >= 500 || response.status() === 429) {
      consoleEntries.push({
        viewport: activeViewportId,
        level: 'http',
        text: `${response.status()} ${response.request().method()} ${response.url()}`,
        url: page.url(),
      });
    }
  });
}

try {
  for (const viewport of viewportSets) {
    activeViewportId = viewport.id;
    const loginContext = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      ignoreHTTPSErrors: true,
    });
    await loginContext.addInitScript((theme) => {
      localStorage.setItem('hospital-billing-theme', theme);
    }, viewport.theme);
    const loginPage = await loginContext.newPage();
    attachPageObservers(loginPage);
    await loginPage.goto(`${baseUrl}/login`);
    await waitSettled(loginPage);
    await loginPage.getByLabel(/usuario o correo/i).waitFor({ timeout: 10000 }).catch(() => {});
    await waitForSessionGate(loginPage);
    await capture(loginPage, viewport.id, 'login', captures);
    await loginContext.close();
  }

  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  attachPageObservers(page);

  try {
    if (!await login(page)) {
      throw new Error('UI login did not complete.');
    }
  } catch (error) {
    findings.push({
      level: 'error',
      context: 'auth',
      message: error instanceof Error ? error.message : 'UI login did not complete.',
    });
    throw error;
  }

  for (const viewport of viewportSets) {
    activeViewportId = viewport.id;
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(`${baseUrl}/dashboard`);
    await page.evaluate((theme) => localStorage.setItem('hospital-billing-theme', theme), viewport.theme);
    await waitSettled(page);
    await waitForSessionGate(page);

    if (viewport.id === 'desktop-light') {
      await tryReceiptFlow(page, viewport.id, captures, findings);
    }

    for (const route of viewport.routes) {
      await page.goto(`${baseUrl}${route.path}`);
      await waitSettled(page);
      await waitForSessionGate(page);
      if (/iniciar sesi|usuario o correo|contrase/i.test(await bodyText(page))) {
        await login(page);
        await page.goto(`${baseUrl}${route.path}`);
        await waitSettled(page);
        await waitForSessionGate(page);
      }
      if (!route.evidence.test(await bodyText(page))) {
        findings.push({ level: 'warn', context: `${viewport.id}/${route.name}`, message: 'Expected heading was not visible.' });
      }
      await capture(page, viewport.id, route.name, captures);
      await page.waitForTimeout(300);
    }
  }

  await context.close();
} finally {
  await browser.close();
}

let report = {
  baseUrl,
  loginUser,
  outputPhase,
  generatedAt: new Date().toISOString(),
  selectedViewports: viewportSets.map((viewport) => viewport.id),
  selectedRoutes: requestedRouteNames.size === 0 ? 'all' : Array.from(requestedRouteNames),
  captures,
  consoleEntries,
  findings,
  summary: {
    captureCount: captures.length,
    consoleIssueCount: consoleEntries.length,
    findingCount: findings.length,
    overflowFindings: captures
      .filter((capture) => capture.inspection.overflowX > 1)
      .map((capture) => ({ name: `${capture.viewport}/${capture.name}`, overflowX: capture.inspection.overflowX })),
    unnamedControlFindings: captures
      .filter((capture) => capture.inspection.unnamedControls.length > 0)
      .map((capture) => ({ name: `${capture.viewport}/${capture.name}`, controls: capture.inspection.unnamedControls })),
  },
};

if (mergeReport) {
  const previous = await readFile(reportPath, 'utf8')
    .then((content) => JSON.parse(content))
    .catch(() => null);

  if (previous?.captures) {
    const mergedCaptures = new Map();
    for (const capture of previous.captures) {
      mergedCaptures.set(`${capture.viewport}/${capture.name}`, capture);
    }
    for (const capture of captures) {
      mergedCaptures.set(`${capture.viewport}/${capture.name}`, capture);
    }

    const currentCaptureContexts = new Set(captures.map((capture) => `${capture.viewport}/${capture.name}`));
    const currentViewportIds = new Set(captures.map((capture) => capture.viewport));
    const mergedConsoleEntries = [
      ...(previous.consoleEntries ?? []).filter((entry) => !currentViewportIds.has(entry.viewport)),
      ...consoleEntries,
    ];
    const mergedFindings = [
      ...(previous.findings ?? []).filter((finding) => {
        if (currentCaptureContexts.has(finding.context)) return false;
        return !Array.from(currentViewportIds).some((viewportId) => finding.context?.startsWith(`${viewportId}/`));
      }),
      ...findings,
    ];
    const mergedCaptureList = Array.from(mergedCaptures.values());

    report = {
      ...report,
      generatedAt: new Date().toISOString(),
      captures: mergedCaptureList,
      consoleEntries: mergedConsoleEntries,
      findings: mergedFindings,
      summary: {
        captureCount: mergedCaptureList.length,
        consoleIssueCount: mergedConsoleEntries.length,
        findingCount: mergedFindings.length,
        overflowFindings: mergedCaptureList
          .filter((capture) => capture.inspection.overflowX > 1)
          .map((capture) => ({ name: `${capture.viewport}/${capture.name}`, overflowX: capture.inspection.overflowX })),
        unnamedControlFindings: mergedCaptureList
          .filter((capture) => capture.inspection.unnamedControls.length > 0)
          .map((capture) => ({ name: `${capture.viewport}/${capture.name}`, controls: capture.inspection.unnamedControls })),
      },
    };
  }
}

await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

if (consoleEntries.length > 0) {
  console.error(JSON.stringify(consoleEntries, null, 2));
}
