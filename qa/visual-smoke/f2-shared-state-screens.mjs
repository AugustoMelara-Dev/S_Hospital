import playwright from '../../frontend/node_modules/playwright/index.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = playwright;

const baseUrl = process.env.F2_VISUAL_BASE_URL?.trim() || 'http://127.0.0.1:5173';
const loginUser = process.env.F2_VISUAL_USER?.trim() || 'admin.validacion';
const loginPassword = process.env.F2_VISUAL_PASSWORD?.trim() || 'Password123!';
const outputDir = path.resolve(import.meta.dirname, '..', 'screenshots', 'after');

const screens = [
  {
    name: 'f2-dashboard',
    route: '/dashboard',
    heading: /inicio/i,
  },
  {
    name: 'f2-cashbox',
    route: '/cashbox',
    heading: /^caja$/i,
  },
  {
    name: 'f2-backups',
    route: '/backups',
    heading: /respaldos/i,
  },
  {
    name: 'f2-settings-fiscal',
    route: '/settings/fiscal',
    heading: /configuracion/i,
  },
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

async function login(page) {
  await page.goto(`${baseUrl}/login`);
  await waitSettled(page);

  if (await page.getByRole('heading', { name: /inicio/i }).isVisible().catch(() => false)) {
    return;
  }

  await page.getByLabel(/usuario o correo/i).fill(loginUser);
  await page.locator('#password-input').fill(loginPassword);
  await page.getByRole('button', { name: /iniciar sesi(?:ó|o)n/i }).click();
  await page.waitForURL(/dashboard|cashbox|backups|settings/, { timeout: 15000 });
  await waitSettled(page);
}

async function extractState(page, route) {
  const bodyText = sanitizeLogText(await page.locator('body').innerText().catch(() => ''));

  if (route === '/dashboard') {
    return {
      cashSnippet: bodyText.match(/CAJA\s+(?:Atencion|Abierta|Listo)?\s*(?:Caja #\d+|Cerrada)/i)?.[0] ?? null,
      nextActionSnippet: bodyText.match(/Abrir caja|Nueva factura/i)?.[0] ?? null,
    };
  }

  if (route === '/cashbox') {
    return {
      sessionSnippet: bodyText.match(/Caja lista para facturar|Caja en modo consulta|Abra caja antes de facturar|Sin caja abierta/i)?.[0] ?? null,
    };
  }

  if (route === '/backups') {
    return {
      operationalSnippet: bodyText.match(/Estado operativo\s+(?:Todo bien|Requiere revision|Error)/i)?.[0] ?? null,
      workerSnippet: bodyText.match(/Worker activo|Worker inactivo/i)?.[0] ?? null,
    };
  }

  return {
    settingsSnippet: bodyText.match(/Hospital|RTN|CAI|Secuencia|recibo/i)?.[0] ?? null,
  };
}

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  ignoreHTTPSErrors: true,
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
    text.includes('Download the React DevTools')
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

try {
  await login(page);

  const report = [];
  for (const screen of screens) {
    await page.goto(`${baseUrl}${screen.route}`);
    await waitSettled(page);
    await page.getByRole('heading', { name: screen.heading }).first().waitFor({ timeout: 15000 }).catch(() => {});

    const screenshotPath = path.join(outputDir, `${screen.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    report.push({
      ...screen,
      screenshot: screenshotPath,
      state: await extractState(page, screen.route),
    });
  }

  await writeFile(path.join(outputDir, 'f2-browser-console.json'), `${JSON.stringify(consoleEntries, null, 2)}\n`);
  await writeFile(
    path.join(outputDir, 'f2-shared-state-report.json'),
    `${JSON.stringify({ baseUrl, loginUser, report, consoleEntries }, null, 2)}\n`,
  );
} finally {
  await browser.close();
}

if (consoleEntries.length > 0) {
  console.error(JSON.stringify(consoleEntries, null, 2));
  process.exitCode = 1;
}
