import playwright from '../../frontend/node_modules/playwright/index.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = playwright;

const baseUrl = process.env.F5_VISUAL_BASE_URL?.trim() || 'http://127.0.0.1:5173';
const loginUser = process.env.F5_VISUAL_USER?.trim() || 'admin.validacion';
const loginPassword = process.env.F5_VISUAL_PASSWORD?.trim() || 'Password123!';
const outputPhase = process.env.F5_VISUAL_OUTPUT_PHASE?.trim() || 'after';
const outputDir = path.resolve(import.meta.dirname, '..', 'screenshots', outputPhase);
const patientName = `Paciente Auditoria F5 ${Date.now()}`;

const forbiddenBranding = [
  /Billing\s+OS/i,
  /Expediente360/i,
  /AsisteHN/i,
  /Workspace/i,
  /SaaS/i,
  /Command\s+Center/i,
];

const routes = [
  { name: 'dashboard', path: '/dashboard', heading: /inicio/i, evidence: /Nueva factura|Caja|Reporte|Resumen/i },
  { name: 'new-invoice', path: '/billing/new', heading: /nueva factura/i, evidence: /paciente|servicio|total/i },
  { name: 'cashbox', path: '/cashbox', heading: /^caja$/i, evidence: /caja|monto|sesion/i },
  { name: 'catalog', path: '/catalog', heading: /cat[aá]logo/i, evidence: /servicio|categoria|precio/i },
  { name: 'invoice-history', path: '/invoices', heading: /historial/i, evidence: /factura|paciente|estado/i },
  { name: 'reports', path: '/reports', heading: /reportes/i, evidence: /diario|rango|caja|ingreso/i },
  { name: 'backups', path: '/backups', heading: /respaldos/i, evidence: /worker|backup|respaldo|estado/i },
  { name: 'settings-fiscal', path: '/settings/fiscal', heading: /configuraci[oó]n/i, evidence: /RTN|CAI|secuencia|recibo/i },
  { name: 'users', path: '/admin/users', heading: /usuarios/i, evidence: /usuario|rol|permiso/i },
  { name: 'help', path: '/help', heading: /ayuda/i, evidence: /caja|factura|respaldo|soporte/i },
  { name: 'about', path: '/about', heading: /acerca/i, evidence: /hospital|sistema|versi[oó]n|red local/i },
  { name: 'not-found', path: '/ruta-inexistente-f5', heading: /ruta no encontrada/i, evidence: /no existe|navegaci[oó]n principal/i },
];

const viewportSets = [
  { id: 'desktop-light', width: 1440, height: 960, theme: 'light', routes },
  {
    id: 'desktop-dark',
    width: 1440,
    height: 960,
    theme: 'dark',
    routes: routes.filter((route) => ['dashboard', 'new-invoice', 'cashbox', 'catalog', 'invoice-history', 'backups', 'settings-fiscal'].includes(route.name)),
  },
  {
    id: 'laptop-light',
    width: 1280,
    height: 720,
    theme: 'light',
    routes: routes.filter((route) => ['dashboard', 'new-invoice', 'cashbox', 'catalog', 'invoice-history', 'reports', 'settings-fiscal'].includes(route.name)),
  },
  {
    id: 'tablet-light',
    width: 820,
    height: 1180,
    theme: 'light',
    routes: routes.filter((route) => ['dashboard', 'new-invoice', 'cashbox', 'catalog', 'invoice-history', 'backups'].includes(route.name)),
  },
  {
    id: 'mobile-light',
    width: 390,
    height: 844,
    theme: 'light',
    routes: routes.filter((route) => ['login', 'dashboard', 'new-invoice', 'cashbox', 'invoice-history'].includes(route.name)),
  },
];

function sanitizeLogText(text) {
  return text
    .replaceAll(loginPassword, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
}

async function waitSettled(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(200);
}

async function bodyText(page) {
  return sanitizeLogText(await page.locator('body').innerText().catch(() => ''));
}

async function looksLikeLogin(page) {
  const text = await bodyText(page);
  const hasLoginButton = await page.getByRole('button', { name: /iniciar sesi/i }).isVisible().catch(() => false);
  const hasUserField = await page.getByLabel(/usuario o correo/i).isVisible().catch(() => false);
  const hasPasswordField = await page.locator('#password-input').isVisible().catch(() => false);

  return /iniciar sesi|usuario o correo|contrase/i.test(text) || (hasLoginButton && (hasUserField || hasPasswordField));
}

async function assertNoForbiddenBranding(page, context) {
  const text = await bodyText(page);
  const found = forbiddenBranding.find((pattern) => pattern.test(text));
  if (found) {
    throw new Error(`${context}: forbidden legacy branding detected (${String(found)})`);
  }
}

async function login(page) {
  await page.goto(`${baseUrl}/login`);
  await waitSettled(page);

  if (!await looksLikeLogin(page)) {
    return;
  }

  await page.getByLabel(/usuario o correo/i).fill(loginUser);
  await page.locator('#password-input').fill(loginPassword);
  await page.getByRole('button', { name: /iniciar sesi/i }).click();
  await page.waitForURL(/dashboard|cashbox|backups|settings|billing|catalog|invoices|reports|admin/, { timeout: 15000 });
  await waitSettled(page);
}

async function ensureCashSession(page, captures) {
  await page.goto(`${baseUrl}/cashbox`);
  await waitSettled(page);
  const alreadyOpen = await page.getByText(/caja lista para facturar|monto contado/i).first().isVisible().catch(() => false);
  if (alreadyOpen) return;

  const openingAmount = page.getByLabel(/monto inicial/i).first();
  if (await openingAmount.isVisible().catch(() => false)) {
    await openingAmount.fill('500.00');
    await page.getByRole('button', { name: /^abrir caja$/i }).last().click();
    await page.getByText(/caja abierta|caja lista para facturar|nueva factura/i).first().waitFor({ timeout: 15000 });
    await waitSettled(page);
    captures.push(await capture(page, 'desktop-light', 'cashbox-after-open'));
  }
}

async function createPaidInvoiceForReceipt(page, captures) {
  await page.goto(`${baseUrl}/billing/new`);
  await waitSettled(page);
  await page.getByRole('heading', { name: /nueva factura/i }).waitFor({ timeout: 15000 });

  if (await page.getByText(/debe abrir la caja antes/i).first().isVisible().catch(() => false)) {
    await ensureCashSession(page, captures);
    await page.goto(`${baseUrl}/billing/new`);
    await waitSettled(page);
  }

  await page.getByLabel(/nombre del paciente/i).fill(patientName);
  await addFirstAvailableService(page);
  captures.push(await capture(page, 'desktop-light', 'new-invoice-with-service'));
  await page.getByRole('button', { name: /emitir y cobrar/i }).click();
  await page.getByRole('button', { name: /emitir y abrir cobro/i }).click();
  await page.getByRole('heading', { name: /registrar pago/i }).waitFor({ timeout: 15000 });

  const previewCheckbox = page.getByLabel(/ver preview antes de imprimir/i);
  if (!await previewCheckbox.isChecked().catch(() => false)) {
    await previewCheckbox.check();
  }

  const amount = page.getByLabel(/monto recibido/i);
  const max = await amount.getAttribute('max');
  await amount.fill(max && Number(max) > 0 ? max : '1.00');
  await page.getByRole('button', { name: /confirmar cobro/i }).click();
  await page.getByRole('heading', { name: /vista previa del recibo/i }).waitFor({ timeout: 20000 });
  captures.push(await capture(page, 'desktop-light', 'receipt-payment-preview'));

  const closeButton = page.getByRole('button', { name: /cerrar modal|cerrar$/i }).first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
    await waitSettled(page);
  }

  await page.goto(`${baseUrl}/invoices?patient=${encodeURIComponent(patientName)}`);
  await waitSettled(page);
  await page.getByText(patientName).first().waitFor({ timeout: 15000 });
  captures.push(await capture(page, 'desktop-light', 'invoice-history-paid-search'));
  await page.getByRole('button', { name: /reimprimir/i }).first().click();
  await page.getByRole('button', { name: /registrar reimpresi/i }).click();
  await page.getByLabel(/recibo institucional/i).waitFor({ timeout: 15000 });
  captures.push(await capture(page, 'desktop-light', 'receipt-reprint-preview'));
}

async function addFirstAvailableService(page) {
  const search = page.getByLabel(/buscar por nombre, categor/i).first();
  for (const term of ['glucosa', 'hemograma', 'consulta']) {
    await search.fill(term);
    const serviceButton = await findPositivePriceServiceButton(page);
    if (serviceButton) {
      await serviceButton.click();
      return;
    }
  }

  throw new Error('new-invoice: no positive-price billable service found for F5 audit');
}

async function findPositivePriceServiceButton(page) {
  const buttons = page.locator('button[aria-label^="Agregar "]');
  if (!await buttons.first().waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) {
    return null;
  }

  const count = await buttons.count();
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    const label = await button.getAttribute('aria-label');
    if (label && !/L\.\s*0\.00\b/.test(label)) {
      return button;
    }
  }

  return null;
}

async function inspectPage(page) {
  return page.evaluate(() => {
    const namedElements = Array.from(document.querySelectorAll('input, select, textarea, button, a'));
    const unnamedControls = namedElements
      .filter((element) => {
        const elementBox = element.getBoundingClientRect();
        const isHiddenFromInteraction =
          element.hasAttribute('hidden') ||
          element.getAttribute('aria-hidden') === 'true' ||
          element.closest('[aria-hidden="true"]') ||
          (elementBox.width === 0 && elementBox.height === 0 && element.getClientRects().length === 0);

        if (isHiddenFromInteraction) return false;
        if (element.matches('a') && element.textContent?.trim()) return false;
        if (element.matches('button') && element.textContent?.trim()) return false;
        const id = element.getAttribute('id');
        const ariaLabel = element.getAttribute('aria-label');
        const labelledBy = element.getAttribute('aria-labelledby');
        const label = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
        return !ariaLabel && !labelledBy && !label;
      })
      .slice(0, 10)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute('type'),
        id: element.getAttribute('id'),
        text: element.textContent?.trim().slice(0, 60) ?? '',
      }));

    const overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
    const main = document.querySelector('main');
    const headings = Array.from(document.querySelectorAll('h1,h2,h3')).map((heading) => heading.textContent?.trim()).filter(Boolean);
    const activeElement = document.activeElement;

    return {
      title: document.title,
      overflowX,
      unnamedControls,
      headings,
      mainTextLength: main?.textContent?.trim().length ?? 0,
      focusedTag: activeElement?.tagName.toLowerCase() ?? null,
      hasVisibleSkipLink: Boolean(document.querySelector('a[href="#main-content"]')),
    };
  });
}

async function capture(page, viewportId, name) {
  await assertNoForbiddenBranding(page, `${viewportId}/${name}`);
  const screenshotPath = path.join(outputDir, `f5-${viewportId}-${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  const text = await bodyText(page);
  console.log(`captured ${viewportId}/${name}`);

  return {
    viewport: viewportId,
    name,
    route: new URL(page.url()).pathname,
    screenshot: screenshotPath,
    snippet: text.slice(0, 300),
    inspection: await inspectPage(page),
  };
}

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const captures = [];
const consoleEntries = [];

try {
  for (const viewport of viewportSets) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      ignoreHTTPSErrors: true,
    });
    await context.addInitScript((theme) => {
      localStorage.setItem('hospital-billing-theme', theme);
    }, viewport.theme);

    const page = await context.newPage();
    page.on('console', (message) => {
      if (!['error', 'warning', 'warn'].includes(message.type())) return;
      const text = sanitizeLogText(message.text());
      if (text.includes('/@vite') || text.includes('favicon') || text.includes('Download the React DevTools')) return;
      consoleEntries.push({ viewport: viewport.id, level: message.type(), text, url: page.url() });
    });
    page.on('pageerror', (error) => {
      consoleEntries.push({ viewport: viewport.id, level: 'pageerror', text: sanitizeLogText(error.message), url: page.url() });
    });
    page.on('response', (response) => {
      if (response.status() >= 500 || response.status() === 429) {
        consoleEntries.push({
          viewport: viewport.id,
          level: 'http',
          text: `${response.status()} ${response.request().method()} ${response.url()}`,
          url: page.url(),
        });
      }
    });

    await page.goto(`${baseUrl}/login`);
    await waitSettled(page);
    captures.push(await capture(page, viewport.id, 'login'));
    await login(page);

    if (viewport.id === 'desktop-light') {
      await ensureCashSession(page, captures);
      await createPaidInvoiceForReceipt(page, captures);
    }

    for (const route of viewport.routes) {
      await page.goto(`${baseUrl}${route.path}`);
      await waitSettled(page);
      await page.getByRole('heading', { name: route.heading }).first().waitFor({ timeout: 3500 }).catch(() => {});
      await page.getByText(route.evidence).first().waitFor({ timeout: 3500 }).catch(() => {});
      captures.push(await capture(page, viewport.id, route.name));
    }

    await context.close();
  }
} finally {
  await browser.close();
}

const report = {
  baseUrl,
  loginUser,
  outputPhase,
  generatedAt: new Date().toISOString(),
  patientName,
  captures,
  consoleEntries,
  summary: {
    captureCount: captures.length,
    consoleIssueCount: consoleEntries.length,
    overflowFindings: captures
      .filter((capture) => capture.inspection.overflowX > 1)
      .map((capture) => ({ name: `${capture.viewport}/${capture.name}`, overflowX: capture.inspection.overflowX })),
    unnamedControlFindings: captures
      .filter((capture) => capture.inspection.unnamedControls.length > 0)
      .map((capture) => ({ name: `${capture.viewport}/${capture.name}`, controls: capture.inspection.unnamedControls })),
  },
};

await writeFile(path.join(outputDir, 'f5-visual-ux-audit-report.json'), `${JSON.stringify(report, null, 2)}\n`);

if (consoleEntries.length > 0) {
  console.error(JSON.stringify(consoleEntries, null, 2));
}
