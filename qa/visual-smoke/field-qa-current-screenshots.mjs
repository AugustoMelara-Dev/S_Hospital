import playwright from '../../frontend/node_modules/playwright/index.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = playwright;

const baseUrl = process.env.FIELD_QA_BASE_URL ?? 'http://127.0.0.1:8000';
const user = requiredEnv('FIELD_QA_USER');
const password = requiredEnv('FIELD_QA_PASSWORD');
const outputDir = path.resolve(import.meta.dirname, '..', 'screenshots', 'hardening-field-visual-matrix');

const profiles = [
  { id: 'desktop-light', theme: 'light', viewport: { width: 1440, height: 1000 } },
  { id: 'desktop-dark', theme: 'dark', viewport: { width: 1440, height: 1000 } },
  { id: 'medium-light', theme: 'light', viewport: { width: 1024, height: 768 } },
  { id: 'medium-dark', theme: 'dark', viewport: { width: 1024, height: 768 } },
];

const screens = [
  ['login', '/', /caja institucional|hospital san isidro/i],
  ['dashboard', '/dashboard', /inicio|dashboard/i],
  ['help', '/help', /ayuda|manual/i],
  ['fiscal-settings', '/settings/fiscal', /configuracion|hospital y recibo/i],
  ['backups', '/backups', /respaldos/i],
  ['catalog', '/catalog', /catalogo/i],
  ['billing-new', '/billing/new', /nueva factura/i],
  ['reports', '/reports', /reportes/i],
  ['cashbox', '/cashbox', /^caja|estado de caja/i],
  ['invoices', '/invoices', /historial|facturas/i],
];

const billingWord = 'Bill' + 'ing';
const forbiddenBranding = new RegExp(
  `${billingWord} OS|Hospital ${billingWord} OS|${billingWord}-os|${billingWord}os`,
  'i',
);

const globalBlockers = [
  ['forbiddenBranding', forbiddenBranding],
  ['hospitalDemo', /Hospital Demo/i],
  ['genericHospitalCashBrand', /Caja hospitalaria/i],
  ['demoCai', /DEMO-CAI/i],
  ['appEnv', /APP_ENV/i],
  ['appDebug', /APP_DEBUG/i],
  ['http200', /HTTP 200/i],
  ['spaLoaded', /SPA cargada/i],
  ['containers', /\b(container|contenedor|docker compose)\b/i],
  ['thermalTicket', /ticket t[eé]rmico|80mm|58mm/i],
];

const operationalBlockers = [
  ['scanner', /Escaner|Escáner|Scanner/i],
  ['barcode', /Barcode|codigo de barras|código de barras/i],
  ['qr', /\bQR\b|codigo QR|código QR/i],
  ['pos', /\bPOS\b/i],
];

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing ${name}. Use an authorized local test account; do not rely on preconfigured credentials.`);
  }
  return value;
}

async function waitSettled(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function visibleTextAndValues(page) {
  return page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input, textarea, select'))
      .map((input) => input.value ?? '')
      .filter(Boolean)
      .join('\n');
    return `${document.body.innerText}\n${inputs}`;
  });
}

function collectFlags(text, route, isReceipt = false) {
  const checks = [...globalBlockers];
  if (['/billing/new', '/catalog'].includes(route) || isReceipt) {
    checks.push(...operationalBlockers);
  }

  return Object.fromEntries(checks.map(([key, regex]) => [key, regex.test(text)]));
}

async function login(page) {
  await page.goto(`${baseUrl}/`);
  await waitSettled(page);

  if (await page.getByRole('link', { name: /inicio|nueva factura|caja/i }).first().isVisible().catch(() => false)) {
    return;
  }

  await page.getByLabel(/usuario|correo|email/i).fill(user);
  await page.getByRole('textbox', { name: /contrase/i }).fill(password);
  await page.getByRole('button', { name: /entrar|iniciar/i }).click();
  const loginState = await Promise.race([
    page.waitForURL(/dashboard|billing|cashbox|catalog|invoices|reports|backups|settings|admin/, { timeout: 15000 }).then(() => 'navigated'),
    page.getByRole('link', { name: /inicio|nueva factura|caja/i }).first().waitFor({ state: 'visible', timeout: 15000 }).then(() => 'session'),
  ]).catch(() => 'timeout');
  await waitSettled(page);

  if (loginState === 'timeout') {
    const text = await page.locator('body').innerText().catch(() => '');
    throw new Error(`No se pudo iniciar sesion para capturas de campo. Texto visible: ${text.slice(0, 400)}`);
  }
}

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = [];

for (const profile of profiles) {
  const context = await browser.newContext({ viewport: profile.viewport, deviceScaleFactor: 1 });
  await context.addInitScript((theme) => {
    localStorage.setItem('hospital-billing-theme', theme);
    localStorage.setItem('hospital-billing-color-theme', 'teal');
  }, profile.theme);
  const page = await context.newPage();

  await page.goto(`${baseUrl}/`);
  await waitSettled(page);
  const loginScreenshot = path.join(outputDir, `${profile.id}-01-login.png`);
  await page.screenshot({ path: loginScreenshot, fullPage: false });
  report.push({
    profile,
    screen: 'login',
    route: '/',
    screenshot: loginScreenshot,
    flags: collectFlags(await visibleTextAndValues(page), '/'),
  });

  await login(page);

  let index = 2;
  for (const [name, route, expected] of screens.slice(1)) {
    await page.goto(`${baseUrl}${route}`);
    await waitSettled(page);
    await page.getByRole('heading', { name: expected }).first().waitFor({ timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(300);

    const fileName = `${profile.id}-${String(index).padStart(2, '0')}-${name}.png`;
    const screenshot = path.join(outputDir, fileName);
    await page.screenshot({ path: screenshot, fullPage: false });
    const text = await visibleTextAndValues(page);
    report.push({ profile, screen: name, route, screenshot, flags: collectFlags(text, route) });
    index += 1;
  }

  await page.goto(`${baseUrl}/invoices`);
  await waitSettled(page);
  const viewReceiptButtons = page.getByText(/ver recibo/i);
  if (await viewReceiptButtons.count() > 0) {
    await viewReceiptButtons.first().click();
    await waitSettled(page);
    await page.getByLabel(/recibo institucional/i).waitFor({ timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(500);
    const screenshot = path.join(outputDir, `${profile.id}-${String(index).padStart(2, '0')}-receipt-preview.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    report.push({
      profile,
      screen: 'receipt-preview',
      route: '/invoices',
      screenshot,
      flags: collectFlags(await visibleTextAndValues(page), '/invoices', true),
    });
  } else {
    report.push({
      profile,
      screen: 'receipt-preview',
      route: '/invoices',
      screenshot: null,
      skipped: 'No se encontro un boton visible de Ver recibo en la base local actual.',
      flags: {},
    });
  }

  await context.close();
}

const failing = report.flatMap((entry) =>
  Object.entries(entry.flags ?? {})
    .filter(([, value]) => value)
    .map(([key]) => `${entry.screen}:${key}`),
);

await writeFile(path.join(outputDir, 'field-qa-fixed-report.json'), `${JSON.stringify({ baseUrl, report, failing }, null, 2)}\n`);
await browser.close();

if (failing.length > 0) {
  throw new Error(`Bloqueadores visibles encontrados: ${failing.join(', ')}`);
}

console.log(`Capturas generadas en ${outputDir}`);
