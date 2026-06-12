import playwright from '../../frontend/node_modules/playwright/index.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = playwright;

const baseUrl = process.env.F3_VISUAL_BASE_URL?.trim() || 'http://127.0.0.1:5173';
const loginUser = process.env.F3_VISUAL_USER?.trim() || 'admin.validacion';
const loginPassword = process.env.F3_VISUAL_PASSWORD?.trim() || 'Password123!';
const routeDelayMs = Number.parseInt(process.env.F3_VISUAL_ROUTE_DELAY_MS?.trim() || '8000', 10);
const outputDir = path.resolve(import.meta.dirname, '..', 'screenshots', 'after');

const forbiddenBranding = [
  /Billing\s+OS/i,
  /Expediente360/i,
  /AsisteHN/i,
  /Workspace/i,
  /SaaS/i,
  /Command\s+Center/i,
];

const screens = [
  { name: 'f3-dashboard', route: '/dashboard', navLabel: 'Inicio', heading: /inicio/i, evidence: /Abrir caja|Nueva factura/i },
  { name: 'f3-catalog', route: '/catalog', navLabel: 'Catalogo', heading: /cat[aá]logo de servicios/i, evidence: /servicio|categoria/i },
  { name: 'f3-new-invoice', route: '/billing/new', navLabel: 'Nueva factura', heading: /nueva factura/i, evidence: /paciente|servicio/i },
  { name: 'f3-cashbox', route: '/cashbox', navLabel: 'Caja', heading: /^caja$/i, evidence: /Sin caja abierta|Caja lista|Abrir caja/i },
  { name: 'f3-backups', route: '/backups', navLabel: 'Respaldos', heading: /respaldos/i, evidence: /Worker activo|Worker inactivo|Estado operativo/i },
  { name: 'f3-settings-fiscal', route: '/settings/fiscal', navLabel: 'Configuracion', heading: /configuraci.n/i, evidence: /Hospital|RTN|CAI|Secuencia/i },
];

function sanitizeLogText(text) {
  return text
    .replace(/Password123!/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
}

async function waitSettled(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(600);
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

async function assertNoLogin(page, context) {
  if (new URL(page.url()).pathname === '/login' || await looksLikeLogin(page)) {
    throw new Error(`${context}: captured login instead of authenticated shell (${page.url()})`);
  }
}

async function assertNoForbiddenBranding(page, context) {
  const text = await bodyText(page);
  const found = forbiddenBranding.find((pattern) => pattern.test(text));
  if (found) {
    throw new Error(`${context}: forbidden legacy branding detected (${String(found)})`);
  }
}

async function assertShellNavigation(page, context) {
  const navigation = page.getByRole('navigation', { name: /navegaci[oó]n principal/i }).first();
  await navigation.waitFor({ timeout: 15000 });

  const expectedLabels = [
    'Inicio',
    'Nueva factura',
    'Caja',
    'Catalogo',
    'Historial',
    'Reportes',
    'Respaldos',
    'Configuracion',
    'Usuarios',
    'Ayuda',
    'Acerca de',
  ];

  for (const label of expectedLabels) {
    if (await navigation.getByRole('link', { name: new RegExp(`^${label}$`, 'i') }).count() === 0) {
      throw new Error(`${context}: missing navigation label ${label}`);
    }
  }
}

async function login(page) {
  await page.goto(`${baseUrl}/login`);
  await waitSettled(page);

  if (!await looksLikeLogin(page)) {
    await assertNoLogin(page, 'login precheck');
    return;
  }

  await page.getByLabel(/usuario o correo/i).fill(loginUser);
  await page.locator('#password-input').fill(loginPassword);
  await page.getByRole('button', { name: /iniciar sesi/i }).click();
  await page.waitForURL(/dashboard|cashbox|backups|settings|billing|catalog/, { timeout: 15000 });
  await waitSettled(page);
  await assertNoLogin(page, 'login');
}

async function navigateWithinShell(page, screen) {
  const expectedPath = new URL(screen.route, baseUrl).pathname;
  const actualPath = new URL(page.url()).pathname;
  if (actualPath === expectedPath) {
    return;
  }

  await page.getByRole('link', { name: new RegExp(`^${screen.navLabel}$`, 'i') }).first().click();
  await page.waitForURL((url) => url.pathname === expectedPath, { timeout: 15000 });
}

async function capture(page, screen) {
  await navigateWithinShell(page, screen);
  await waitSettled(page);
  await assertNoLogin(page, screen.name);
  await assertNoForbiddenBranding(page, screen.name);
  await assertShellNavigation(page, screen.name);

  const expectedPath = new URL(screen.route, baseUrl).pathname;
  const actualPath = new URL(page.url()).pathname;
  if (actualPath !== expectedPath) {
    throw new Error(`${screen.name}: expected ${expectedPath}, got ${actualPath}`);
  }

  await page.getByRole('heading', { name: screen.heading }).first().waitFor({ timeout: 15000 });
  const evidenceLocator = page.getByText(screen.evidence).first();
  await evidenceLocator.waitFor({ timeout: 20000 });
  const screenshotPath = path.join(outputDir, `${screen.name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await page.waitForTimeout(routeDelayMs);

  return {
    name: screen.name,
    route: screen.route,
    navLabel: screen.navLabel,
    screenshot: screenshotPath,
    evidenceText: sanitizeLogText(await evidenceLocator.innerText()),
    shellTitle: await page.locator('header.print-hidden').first().innerText().then(sanitizeLogText),
  };
}

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  ignoreHTTPSErrors: true,
});
await context.addInitScript(() => {
  localStorage.setItem('hospital-billing-theme', 'light');
});
const page = await context.newPage();

const consoleEntries = [];
page.on('console', (message) => {
  if (!['error', 'warning', 'warn'].includes(message.type())) {
    return;
  }

  const text = sanitizeLogText(message.text());
  if (
    text.includes('/@vite') ||
    text.includes('favicon') ||
    text.includes('Download the React DevTools') ||
    text.includes('[posMath] computeSimpleEstimate is deprecated')
  ) {
    return;
  }

  consoleEntries.push({
    level: message.type(),
    text,
    url: page.url(),
  });
});
page.on('pageerror', (error) => {
  consoleEntries.push({
    level: 'pageerror',
    text: sanitizeLogText(error.message),
    url: page.url(),
  });
});
page.on('requestfailed', (request) => {
  const failure = request.failure();
  const url = request.url();
  const errorText = failure?.errorText ?? '';

  if (
    url.includes('/@vite') ||
    url.includes('favicon') ||
    (request.method() === 'GET' && errorText === 'net::ERR_ABORTED')
  ) {
    return;
  }

  consoleEntries.push({
    level: 'requestfailed',
    text: sanitizeLogText(`${request.method()} ${url} ${errorText}`),
    url: page.url(),
  });
});
page.on('response', (response) => {
  if (response.status() !== 429) {
    return;
  }

  consoleEntries.push({
    level: 'http',
    text: sanitizeLogText(`${response.request().method()} ${response.url()} 429 Too Many Requests`),
    url: page.url(),
  });
});

try {
  await page.goto(`${baseUrl}/login`);
  await waitSettled(page);
  if (!await looksLikeLogin(page)) {
    throw new Error('login: expected unauthenticated login form before shell capture');
  }
  await assertNoForbiddenBranding(page, 'login');
  const loginScreenshot = path.join(outputDir, 'f3-login.png');
  await page.screenshot({ path: loginScreenshot, fullPage: false });

  await login(page);

  const report = [];
  for (const screen of screens) {
    report.push(await capture(page, screen));
  }

  await navigateWithinShell(page, screens[0]);
  await waitSettled(page);
  await assertNoLogin(page, 'f3-dashboard-light');
  await assertNoForbiddenBranding(page, 'f3-dashboard-light');
  const lightTheme = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  const lightScreenshot = path.join(outputDir, 'f3-dashboard-light.png');
  await page.screenshot({ path: lightScreenshot, fullPage: false });

  await page.getByRole('button', { name: /cambiar a oscuro/i }).click();
  await page.waitForTimeout(500);
  await assertNoLogin(page, 'f3-dashboard-dark');
  await assertNoForbiddenBranding(page, 'f3-dashboard-dark');
  const darkTheme = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  const darkScreenshot = path.join(outputDir, 'f3-dashboard-dark.png');
  await page.screenshot({ path: darkScreenshot, fullPage: false });

  await writeFile(
    path.join(outputDir, 'f3-shell-navigation-report.json'),
    `${JSON.stringify({
      baseUrl,
      loginUser,
      loginScreenshot,
      report,
      theme: {
        lightScreenshot,
        lightHasDarkClass: lightTheme,
        darkScreenshot,
        darkHasDarkClass: darkTheme,
      },
      consoleEntries,
    }, null, 2)}\n`,
  );
} finally {
  await browser.close();
}

if (consoleEntries.length > 0) {
  console.error(JSON.stringify(consoleEntries, null, 2));
  process.exitCode = 1;
}
