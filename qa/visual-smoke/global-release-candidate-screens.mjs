import playwright from '../../frontend/node_modules/playwright/index.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = playwright;

const baseUrl = process.env.GLOBAL_RC_VISUAL_BASE_URL?.trim() || 'http://127.0.0.1:5177';
const loginUser = process.env.GLOBAL_RC_VISUAL_USER?.trim() || 'admin.validacion';
const loginPassword = process.env.GLOBAL_RC_VISUAL_PASSWORD?.trim() || 'Password123!';
const outputDir = path.resolve(import.meta.dirname, '..', 'screenshots', 'global-release-candidate-2026-06-15');
const reportPath = path.join(outputDir, 'global-release-candidate-screens-report.json');
const summaryPath = path.join(outputDir, 'GLOBAL_RELEASE_CANDIDATE_VISUAL_EVIDENCE.md');

const authenticatedScreens = [
  { name: 'dashboard', path: '/dashboard', evidence: /inicio|facturacion|cobros/i },
  { name: 'new-invoice-pos', path: '/billing/new', evidence: /nueva factura|nombre del paciente|servicios/i },
  { name: 'cashbox', path: '/cashbox', evidence: /caja|monto contado|monto inicial|caja lista/i },
  { name: 'invoice-history', path: '/invoices', evidence: /historial|facturas|paciente/i },
  { name: 'reports', path: '/reports', evidence: /reportes|diario|rango|total cobrado/i },
  { name: 'settings-fiscal', path: '/settings/fiscal', evidence: /configuracion|hospital y recibo|cai|rtn/i },
  { name: 'settings-institutional-receipts', path: '/settings/institutional-receipts', evidence: /recibos institucionales|series|perfiles|asignaciones/i },
  { name: 'backups', path: '/backups', evidence: /respaldos|backup|estado operativo|protegido/i },
  { name: 'users-roles', path: '/admin/users', evidence: /usuarios|rol|crear usuario|permisos/i },
  { name: 'help-manuals', path: '/help', evidence: /ayuda|manual|cajero|administrador/i },
  { name: 'about', path: '/about', evidence: /acerca|sistema de caja|hospital|version/i },
  { name: 'server-status', path: '/about', evidence: /hora del servidor|base actualizada|base de datos|estado/i },
];

const responsiveScreens = [
  { name: 'mobile-new-invoice-pos', path: '/billing/new', width: 390, height: 844, evidence: /nueva factura|nombre del paciente/i, authenticated: true },
  { name: 'tablet-dashboard', path: '/dashboard', width: 820, height: 1180, evidence: /inicio|facturacion|cobros/i, authenticated: true },
];

function sanitize(text) {
  return text.replaceAll(loginPassword, '[redacted]').replace(/\s+/g, ' ').trim();
}

async function waitSettled(page) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1000);
}

async function bodyText(page) {
  return sanitize(await page.locator('body').innerText().catch(() => ''));
}

async function waitNotLoading(page) {
  await page.waitForFunction(
    () => {
      const text = document.body?.innerText ?? '';
      return !/cargando/i.test(text);
    },
    undefined,
    { timeout: 15000 },
  ).catch(() => {});
}

async function capture(page, screen, captures, findings) {
  let text = '';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await waitSettled(page);
    await waitNotLoading(page);
    await waitForEvidence(page, screen.evidence);
    text = await bodyText(page);

    if (text.length > 0 && screen.evidence.test(text)) {
      break;
    }

    if (screen.path) {
      await page.goto(`${baseUrl}${screen.path}`);
    } else {
      await page.reload();
    }
  }

  const screenshotPath = path.join(outputDir, `${screen.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  const inspection = await inspectPage(page);

  if (!screen.evidence.test(text)) {
    findings.push({ level: 'error', screen: screen.name, message: 'Expected settled screen evidence was not visible.' });
  }

  if (/cargando/i.test(text)) {
    findings.push({ level: 'error', screen: screen.name, message: 'Screen still showed a loading state at capture time.' });
  }

  if (/unauthenticated|sesion vencida|vuelva a iniciar sesion/i.test(text) && screen.authenticated !== false) {
    findings.push({ level: 'error', screen: screen.name, message: 'Authenticated screen showed a raw auth/session problem.' });
  }

  if (inspection.overflowX > 4) {
    findings.push({ level: 'warn', screen: screen.name, message: `Horizontal overflow detected: ${inspection.overflowX}px.` });
  }

  if (inspection.unnamedControls.length > 0) {
    findings.push({
      level: 'warn',
      screen: screen.name,
      message: `Visible controls without accessible names: ${inspection.unnamedControls.length}.`,
      controls: inspection.unnamedControls,
    });
  }

  captures.push({
    name: screen.name,
    route: new URL(page.url()).pathname,
    viewport: await page.viewportSize(),
    screenshot: screenshotPath,
    snippet: text.slice(0, 350),
    inspection,
  });

  console.log(`captured ${screen.name}`);
}

async function waitForEvidence(page, evidence) {
  await page.waitForFunction(
    ({ source, flags }) => {
      const pattern = new RegExp(source, flags);
      return pattern.test(document.body?.innerText ?? '');
    },
    { source: evidence.source, flags: evidence.flags },
    { timeout: 20000 },
  ).catch(() => {});
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
      .slice(0, 10)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        type: element.getAttribute('type'),
        id: element.getAttribute('id'),
        className: element.getAttribute('class'),
      }));

    return {
      title: document.title,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      headings: Array.from(document.querySelectorAll('h1,h2,h3'))
        .map((heading) => heading.textContent?.trim())
        .filter(Boolean)
        .slice(0, 12),
      buttonCount: Array.from(document.querySelectorAll('button')).filter(visible).length,
      linkCount: Array.from(document.querySelectorAll('a')).filter(visible).length,
      mainTextLength: document.querySelector('main')?.textContent?.trim().length ?? 0,
      unnamedControls,
    };
  });
}

async function login(page) {
  await page.goto(`${baseUrl}/login`);
  await waitSettled(page);
  await waitNotLoading(page);

  const text = await bodyText(page);
  if (!/iniciar sesi|usuario|contrase/i.test(text)) {
    return;
  }

  const loginInput = page.locator('#login-input');
  if (!await loginInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    return;
  }

  await loginInput.fill(loginUser);
  await page.locator('#password-input').fill(loginPassword);
  await page.getByRole('button', { name: /iniciar sesi|entrar/i }).click();
  await page.waitForURL(/dashboard|billing|cashbox|catalog|invoices|reports|backups|settings|admin|help|about/, { timeout: 30000 }).catch(() => {});
  await waitSettled(page);
  await waitNotLoading(page);

  const afterLogin = await bodyText(page);
  if (/iniciar sesi|usuario o correo|contrase/i.test(afterLogin)) {
    throw new Error('UI login did not complete.');
  }
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
  const captures = [];
  const consoleEntries = [];
  const findings = [];
  let activeScreen = 'bootstrap';

  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    ignoreHTTPSErrors: true,
  });
  const page = await context.newPage();

  page.on('console', (message) => {
    if (!['error', 'warning', 'warn'].includes(message.type())) return;
    const text = sanitize(message.text());
    if (text.includes('/@vite') || text.includes('favicon') || text.includes('React DevTools')) return;
    if (text.includes('net::ERR_INSUFFICIENT_RESOURCES')) return;
    consoleEntries.push({ screen: activeScreen, level: message.type(), text, url: page.url() });
  });
  page.on('pageerror', (error) => {
    consoleEntries.push({ screen: activeScreen, level: 'pageerror', text: sanitize(error.message), url: page.url() });
  });
  page.on('response', (response) => {
    if (response.status() >= 500 || response.status() === 429) {
      consoleEntries.push({
        screen: activeScreen,
        level: 'http',
        text: `${response.status()} ${response.request().method()} ${response.url()}`,
        url: page.url(),
      });
    }
  });

  try {
    activeScreen = 'login';
    await page.goto(`${baseUrl}/login`);
    await capture(page, { name: 'login', path: '/login', evidence: /iniciar sesi|usuario|contrase/i, authenticated: false }, captures, findings);

    await login(page);

    for (const screen of authenticatedScreens) {
      activeScreen = screen.name;
      await page.setViewportSize({ width: 1440, height: 960 });
      await page.goto(`${baseUrl}${screen.path}`);
      await capture(page, { ...screen, authenticated: true }, captures, findings);
    }

    for (const screen of responsiveScreens) {
      activeScreen = screen.name;
      await page.setViewportSize({ width: screen.width, height: screen.height });
      if (screen.authenticated === false) {
        await page.context().clearCookies();
      } else {
        await login(page);
      }
      await page.goto(`${baseUrl}${screen.path}`);
      await capture(page, screen, captures, findings);
    }
  } finally {
    await browser.close();
  }

  const blockingFindings = findings.filter((finding) => finding.level === 'error');
  const report = {
    baseUrl,
    loginUser,
    generatedAt: new Date().toISOString(),
    mutationMode: 'read-only-navigation',
    captures,
    consoleEntries,
    findings,
    summary: {
      captureCount: captures.length,
      consoleIssueCount: consoleEntries.length,
      warningCount: findings.filter((finding) => finding.level === 'warn').length,
      blockingFindingCount: blockingFindings.length,
    },
  };

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeSummary(report);

  if (consoleEntries.length > 0 || blockingFindings.length > 0) {
    throw new Error(`Visual RC evidence found blockers: ${JSON.stringify({ consoleEntries, blockingFindings }, null, 2)}`);
  }
}

async function writeSummary(report) {
  const lines = [
    '# Evidencia visual release candidate - 2026-06-15',
    '',
    '- Rama: hardening/global-release-candidate-2026-06-15',
    `- URL auditada: ${report.baseUrl}`,
    `- Usuario QA: ${report.loginUser}`,
    '- Modo: navegacion read-only; no emite facturas, pagos, respaldos ni cambios de configuracion.',
    `- Generado: ${report.generatedAt}`,
    `- Capturas: ${report.summary.captureCount}`,
    `- Incidencias de consola HTTP/pageerror: ${report.summary.consoleIssueCount}`,
    `- Bloqueantes visuales: ${report.summary.blockingFindingCount}`,
    `- Advertencias visuales: ${report.summary.warningCount}`,
    '',
    '## Pantallas capturadas',
    '',
    '| Pantalla | Ruta | Viewport | Evidencia |',
    '| --- | --- | --- | --- |',
    ...report.captures.map((capture) => {
      const viewport = capture.viewport ? `${capture.viewport.width}x${capture.viewport.height}` : 'n/a';
      const fileName = path.basename(capture.screenshot);
      return `| ${capture.name} | ${capture.route} | ${viewport} | ${fileName} |`;
    }),
    '',
    '## Resultado',
    '',
    report.summary.blockingFindingCount === 0 && report.summary.consoleIssueCount === 0
      ? 'No se capturaron pantallas en loading ni errores HTTP 5xx/429/pageerror. Las pantallas principales quedaron en estado cargado o estado vacio operativo.'
      : 'La evidencia contiene bloqueantes; revisar el JSON antes de aceptar RC.',
    '',
    '## Pendientes fuera de esta evidencia',
    '',
    '- Validacion fisica de impresora real del hospital.',
    '- Validacion LAN/concurrencia real con hardware disponible.',
  ];

  await writeFile(summaryPath, `${lines.join('\n')}\n`);
}

await main();
