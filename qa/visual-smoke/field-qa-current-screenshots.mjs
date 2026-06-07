import playwright from '../../frontend/node_modules/playwright/index.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = playwright;

const baseUrl = process.env.FIELD_QA_BASE_URL ?? 'http://127.0.0.1:8000';
const user = requiredEnv('FIELD_QA_USER');
const password = requiredEnv('FIELD_QA_PASSWORD');
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const outputDir = path.resolve(import.meta.dirname, '..', 'screenshots', 'field-qa-2026-05-29-fixed');
const themes = ['light', 'dark'];

const screens = [
  ['login', '/', /sistema de caja hospitalaria|caja hospitalaria/i],
  ['dashboard', '/dashboard', /inicio|dashboard/i],
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
  ['demoCai', /DEMO-CAI/i],
  ['appEnv', /APP_ENV/i],
  ['appDebug', /APP_DEBUG/i],
  ['http200', /HTTP 200/i],
  ['spaLoaded', /SPA cargada/i],
  ['containers', /\b(container|contenedor|docker compose)\b/i],
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

function evidencePath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

async function applyTheme(page, theme) {
  await page.evaluate((themeName) => {
    localStorage.setItem('hospital-billing-theme', themeName);
    localStorage.setItem('hospital-billing-color-theme', 'teal');
  }, theme);
}

async function gotoThemed(page, route, theme) {
  await page.goto(`${baseUrl}${route}`);
  await waitSettled(page);
  await applyTheme(page, theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitSettled(page);
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

async function login(page, theme = 'light') {
  await gotoThemed(page, '/', theme);

  if (await page.getByRole('link', { name: /inicio|nueva factura|caja/i }).first().isVisible().catch(() => false)) {
    return;
  }

  await page.getByLabel(/usuario|correo|email/i).fill(user);
  await page.getByRole('textbox', { name: /contrase/i }).fill(password);
  await page.getByRole('button', { name: /entrar|iniciar/i }).click();
  await page.waitForURL(/dashboard|billing|cashbox|catalog|invoices|reports|backups|settings|admin/, { timeout: 15000 });
  await waitSettled(page);
}

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const report = [];

let index = 1;
for (const theme of themes) {
  await gotoThemed(page, '/', theme);
  const fileName = `${String(index).padStart(2, '0')}-login-${theme}.png`;
  const screenshot = path.join(outputDir, fileName);
  await page.screenshot({ path: screenshot, fullPage: false });
  report.push({
    screen: 'login',
    route: '/',
    theme,
    screenshot: evidencePath(screenshot),
    flags: collectFlags(await visibleTextAndValues(page), '/'),
  });
  index += 1;
}

await login(page, 'light');

for (const theme of themes) {
  for (const [name, route, expected] of screens.slice(1)) {
    await gotoThemed(page, route, theme);
    await page.getByRole('heading', { name: expected }).first().waitFor({ timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(300);

    const fileName = `${String(index).padStart(2, '0')}-${name}-${theme}.png`;
    const screenshot = path.join(outputDir, fileName);
    await page.screenshot({ path: screenshot, fullPage: false });
    const text = await visibleTextAndValues(page);
    report.push({ screen: name, route, theme, screenshot: evidencePath(screenshot), flags: collectFlags(text, route) });
    index += 1;
  }
}

for (const theme of themes) {
  await gotoThemed(page, '/invoices', theme);
  const viewReceipt = page.getByRole('button', { name: /ver recibo/i }).first();
  if (await viewReceipt.isVisible().catch(() => false)) {
    await viewReceipt.click();
    await waitSettled(page);
    await page.waitForTimeout(500);
    const screenshot = path.join(outputDir, `${String(index).padStart(2, '0')}-receipt-preview-${theme}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    report.push({
      screen: 'receipt-preview',
      route: '/invoices',
      theme,
      screenshot: evidencePath(screenshot),
      flags: collectFlags(await visibleTextAndValues(page), '/invoices', true),
    });
  } else {
    report.push({
      screen: 'receipt-preview',
      route: '/invoices',
      theme,
      screenshot: null,
      skipped: 'No se encontro un boton visible de Ver recibo en la base local actual.',
      flags: {},
    });
  }
  await waitSettled(page);
  index += 1;
}

const failing = report.flatMap((entry) =>
  Object.entries(entry.flags ?? {})
    .filter(([, value]) => value)
    .map(([key]) => `${entry.screen}:${entry.theme}:${key}`),
);

await writeFile(path.join(outputDir, 'field-qa-fixed-report.json'), `${JSON.stringify({ baseUrl, report, failing }, null, 2)}\n`);
await browser.close();

if (failing.length > 0) {
  throw new Error(`Bloqueadores visibles encontrados: ${failing.join(', ')}`);
}

console.log(`Capturas generadas en ${outputDir}`);
