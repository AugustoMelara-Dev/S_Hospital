import playwright from '../../frontend/node_modules/playwright/index.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = playwright;

const baseUrl = (process.env.V1_2_BEFORE_BASE_URL ?? 'http://192.168.1.10:8081').replace(/\/$/, '');
const loginUser = process.env.V1_2_BEFORE_USER?.trim() || 'admin.validacion';
const loginPassword = process.env.V1_2_BEFORE_PASSWORD?.trim() || 'Password123!';
const allowMutations = process.env.V1_2_ALLOW_MUTATIONS === '1';

const outputDir = path.resolve(import.meta.dirname, '..', 'v1-2-visible-ui-delta', 'before');
const reportPath = path.join(outputDir, 'before-screenshots-report.json');
const summaryPath = path.join(outputDir, 'BEFORE_SCREENSHOTS.md');

const desktopScreens = [
  { name: 'login', path: '/login', evidence: /iniciar sesi|usuario|contrase/i, auth: false },
  { name: 'dashboard', path: '/dashboard', evidence: /inicio|facturaci|cobros|dashboard/i },
  { name: 'billing-empty', path: '/billing/new', evidence: /nueva factura|nombre del paciente|servicios/i },
  { name: 'cashbox', path: '/cashbox', evidence: /caja|monto|apertura|cierre/i },
  { name: 'invoice-history', path: '/invoices', evidence: /historial|facturas|paciente/i },
  { name: 'reports-executive', path: '/reports', evidence: /reportes|diario|rango|servicios|caja/i },
  { name: 'reports-cash', path: '/reports?tab=cash', evidence: /reportes|caja|cajero|metodo/i },
  { name: 'reports-services', path: '/reports?tab=services', evidence: /reportes|servicios|categoria|vendidos/i },
  { name: 'receipt-settings', path: '/settings/institutional-receipts', evidence: /recibos|institucionales|perfiles|series/i },
  { name: 'catalog', path: '/catalog', evidence: /catalogo|servicios|categorias/i },
  { name: 'backups', path: '/backups', evidence: /respaldos|backup|estado/i },
  { name: 'fiscal-settings', path: '/settings/fiscal', evidence: /configuraci|fiscal|hospital|cai/i },
  { name: 'users', path: '/admin/users', evidence: /usuarios|roles|permisos/i },
  { name: 'help-about', path: '/about', evidence: /acerca|sistema|hospital|version/i },
  { name: 'not-found', path: '/ruta-v1-2-inexistente', evidence: /404|no encontrada|volver/i },
];

const mobileScreens = [
  { name: 'mobile-dashboard', path: '/dashboard', width: 375, height: 667, evidence: /inicio|facturaci|cobros|dashboard/i },
  { name: 'mobile-billing', path: '/billing/new', width: 375, height: 667, evidence: /nueva factura|nombre del paciente|servicios/i },
  { name: 'mobile-reports', path: '/reports', width: 375, height: 667, evidence: /reportes|diario|rango|servicios|caja/i },
];

function redact(text) {
  return (text ?? '').replaceAll(loginPassword, '[redacted]').replace(/\s+/g, ' ').trim();
}

async function waitSettled(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 3500 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function bodyText(page) {
  return redact(await page.locator('body').innerText().catch(() => ''));
}

async function inspectPage(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };

    const unnamedControls = Array.from(document.querySelectorAll('button, a, input, select, textarea'))
      .filter((element) => {
        if (!visible(element) || element.closest('[aria-hidden="true"]')) return false;
        if (element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.getAttribute('title')) return false;
        if (element.textContent?.trim()) return false;
        const id = element.getAttribute('id');
        if (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) return false;
        return true;
      })
      .slice(0, 20)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute('type'),
        id: element.getAttribute('id'),
        className: element.getAttribute('class'),
      }));

    return {
      title: document.title,
      path: window.location.pathname + window.location.search,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      h1Count: document.querySelectorAll('h1').length,
      headings: Array.from(document.querySelectorAll('h1,h2,h3'))
        .map((heading) => heading.textContent?.trim())
        .filter(Boolean)
        .slice(0, 16),
      visibleButtons: Array.from(document.querySelectorAll('button')).filter(visible).length,
      unnamedControls,
    };
  });
}

async function login(page) {
  await page.goto(`${baseUrl}/login`);
  await waitSettled(page);

  if (await page.getByRole('link', { name: /inicio|nueva factura|caja/i }).first().isVisible().catch(() => false)) {
    return;
  }

  const loginInput = page.locator('#login-input');
  if (!(await loginInput.isVisible({ timeout: 10_000 }).catch(() => false))) {
    throw new Error('Login input was not visible.');
  }

  await loginInput.fill(loginUser);
  await page.locator('#password-input').fill(loginPassword);
  await page.getByRole('button', { name: /iniciar|entrar/i }).click();
  await page.waitForURL(/dashboard|billing|cashbox|catalog|invoices|reports|backups|settings|admin|about|help/, { timeout: 30_000 }).catch(() => {});
  await waitSettled(page);

  const text = await bodyText(page);
  if (/usuario o correo|contrase|iniciar sesi/i.test(text)) {
    throw new Error(`Login did not complete. Visible text: ${text.slice(0, 240)}`);
  }
}

async function capture(page, screen, captures, findings) {
  await page.setViewportSize({ width: screen.width ?? 1440, height: screen.height ?? 960 });
  await page.goto(`${baseUrl}${screen.path}`);
  await waitSettled(page);
  await page.waitForFunction(
    ({ source, flags }) => new RegExp(source, flags).test(document.body?.innerText ?? ''),
    { source: screen.evidence.source, flags: screen.evidence.flags },
    { timeout: 12_000 },
  ).catch(() => {});

  const text = await bodyText(page);
  const file = path.join(outputDir, `${screen.name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const inspection = await inspectPage(page);

  if (!screen.evidence.test(text)) {
    findings.push({ screen: screen.name, level: 'warn', message: 'Expected evidence text was not visible at capture time.' });
  }

  if (inspection.overflowX > 4) {
    findings.push({ screen: screen.name, level: 'warn', message: `Horizontal overflow: ${inspection.overflowX}px.` });
  }

  if (inspection.unnamedControls.length > 0) {
    findings.push({ screen: screen.name, level: 'warn', message: `Unnamed visible controls: ${inspection.unnamedControls.length}.` });
  }

  captures.push({
    name: screen.name,
    route: inspection.path,
    viewport: { width: screen.width ?? 1440, height: screen.height ?? 960 },
    screenshot: file,
    snippet: text.slice(0, 320),
    inspection,
  });

  console.log(`captured ${screen.name}`);
}

async function maybeCaptureMutableScreens(page, captures, findings) {
  if (!allowMutations) {
    const skipped = [
      'billing-cart',
      'payment-modal',
      'invoice-confirmation',
      'receipt-preview',
      'access-denied',
    ];
    for (const name of skipped) {
      findings.push({
        screen: name,
        level: 'info',
        message: 'Skipped in before capture because it requires mutation or a role-specific session. Set V1_2_ALLOW_MUTATIONS=1 for an authorized disposable target.',
      });
    }
    return;
  }

  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto(`${baseUrl}/billing/new`);
  await waitSettled(page);
  await page.getByLabel(/nombre del paciente/i).fill('Paciente Captura V1.2').catch(() => {});

  const addButton = page.getByRole('button', { name: /agregar|a.adir/i }).first();
  if (await addButton.isVisible().catch(() => false)) {
    await addButton.click();
    await waitSettled(page);
    await page.screenshot({ path: path.join(outputDir, 'billing-cart.png'), fullPage: false });
    captures.push({ name: 'billing-cart', route: '/billing/new', screenshot: path.join(outputDir, 'billing-cart.png') });
  }

  const emitButton = page.getByRole('button', { name: /emitir|cobrar/i }).first();
  if (await emitButton.isVisible().catch(() => false)) {
    await emitButton.click();
    await waitSettled(page);
    await page.screenshot({ path: path.join(outputDir, 'payment-modal.png'), fullPage: false });
    captures.push({ name: 'payment-modal', route: '/billing/new', screenshot: path.join(outputDir, 'payment-modal.png') });
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  const captures = [];
  const findings = [];
  const consoleEntries = [];

  page.on('console', (message) => {
    if (!['error', 'warning', 'warn'].includes(message.type())) return;
    consoleEntries.push({ level: message.type(), text: redact(message.text()), url: page.url() });
  });

  try {
    await capture(page, desktopScreens[0], captures, findings);
    await login(page);

    for (const screen of desktopScreens.slice(1)) {
      await capture(page, screen, captures, findings);
    }

    await maybeCaptureMutableScreens(page, captures, findings);

    for (const screen of mobileScreens) {
      await capture(page, screen, captures, findings);
    }
  } finally {
    await browser.close();
  }

  const report = {
    capturedAt: new Date().toISOString(),
    baseUrl,
    loginUser,
    allowMutations,
    captures,
    findings,
    consoleEntries,
  };

  await writeFile(reportPath, JSON.stringify(report, null, 2));
  await writeFile(
    summaryPath,
    [
      '# V1.2 Before Screenshots',
      '',
      `Fecha: ${report.capturedAt}`,
      `Base URL: ${baseUrl}`,
      `Usuario QA: ${loginUser}`,
      `Mutaciones permitidas: ${allowMutations ? 'SI' : 'NO'}`,
      '',
      '## Capturas',
      '',
      ...captures.map((capture) => `- ${capture.name}: ${path.relative(process.cwd(), capture.screenshot)}`),
      '',
      '## Hallazgos',
      '',
      ...(findings.length === 0 ? ['- Ninguno.'] : findings.map((finding) => `- ${finding.level.toUpperCase()} ${finding.screen}: ${finding.message}`)),
      '',
    ].join('\n'),
  );

  console.log(`wrote ${reportPath}`);
  console.log(`wrote ${summaryPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
