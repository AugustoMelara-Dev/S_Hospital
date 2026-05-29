import playwright from '../../frontend/node_modules/playwright/index.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = playwright;

const baseUrl = process.env.FIELD_QA_BASE_URL ?? 'http://127.0.0.1:8000';
const user = process.env.FIELD_QA_USER ?? 'admin.demo';
const password = process.env.FIELD_QA_PASSWORD ?? 'Password123!';
const outputDir = path.resolve(import.meta.dirname, '..', 'screenshots', 'field-qa-2026-05-29-fixed');

const screens = [
  ['login', '/', /caja institucional|hospital san isidro/i],
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

  await page.evaluate(() => {
    localStorage.setItem('hospital-billing-theme', 'light');
    localStorage.setItem('hospital-billing-color-theme', 'teal');
  });
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

await page.goto(`${baseUrl}/`);
await waitSettled(page);
await page.screenshot({ path: path.join(outputDir, '01-login.png'), fullPage: false });
report.push({
  screen: 'login',
  route: '/',
  screenshot: path.join(outputDir, '01-login.png'),
  flags: collectFlags(await visibleTextAndValues(page), '/'),
});

await login(page);

let index = 2;
for (const [name, route, expected] of screens.slice(1)) {
  await page.goto(`${baseUrl}${route}`);
  await waitSettled(page);
  await page.getByRole('heading', { name: expected }).first().waitFor({ timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(300);

  const fileName = `${String(index).padStart(2, '0')}-${name}.png`;
  const screenshot = path.join(outputDir, fileName);
  await page.screenshot({ path: screenshot, fullPage: false });
  const text = await visibleTextAndValues(page);
  report.push({ screen: name, route, screenshot, flags: collectFlags(text, route) });
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
  const screenshot = path.join(outputDir, `${String(index).padStart(2, '0')}-receipt-preview.png`);
  await page.screenshot({ path: screenshot, fullPage: false });
  report.push({
    screen: 'receipt-preview',
    route: '/invoices',
    screenshot,
    flags: collectFlags(await visibleTextAndValues(page), '/invoices', true),
  });
} else {
  report.push({
    screen: 'receipt-preview',
    route: '/invoices',
    screenshot: null,
    skipped: 'No se encontro un boton visible de Ver recibo en la base local actual.',
    flags: {},
  });
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
