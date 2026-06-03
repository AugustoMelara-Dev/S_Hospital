import playwright from '../../frontend/node_modules/playwright/index.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = playwright;

const baseUrl = process.env.UX_AUDIT_BASE_URL ?? 'http://127.0.0.1:8000';
const user = requiredEnv('UX_AUDIT_USER');
const password = requiredEnv('UX_AUDIT_PASSWORD');
const outputDir = path.resolve(import.meta.dirname, '..', 'screenshots', 'ux-cleanup-2026-05-21');

const modules = [
  ['dashboard', '/dashboard', /inicio/i],
  ['billing-new', '/billing/new', /nueva factura/i],
  ['cashbox', '/cashbox', /^caja$/i],
  ['catalog', '/catalog', /cat.logo/i],
  ['invoices', '/invoices', /historial/i],
  ['reports', '/reports', /reportes/i],
  ['backups', '/backups', /respaldos/i],
  ['settings-fiscal', '/settings/fiscal', /configuraci.n fiscal/i],
  ['users', '/admin/users', /usuarios/i],
  ['help', '/help', /ayuda/i],
];

const technicalTerms = [
  /Sistema de Caja Hospitalaria/i,
  /S_Hospital/i,
  /PRODUCTION_READY/i,
  /PRODUCTION_CANDIDATE/i,
  /APP_ENV/i,
  /queue:work/i,
  /mysqldump/i,
  /Laravel/i,
  /React/i,
  /debug/i,
  /worker/i,
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

async function login(page) {
  await page.goto(`${baseUrl}/login`);
  await waitSettled(page);

  if (await page.getByRole('link', { name: /inicio/i }).isVisible().catch(() => false)) {
    return;
  }

  await page.evaluate(() => {
    localStorage.setItem('hospital-billing-theme', 'light');
    localStorage.setItem('hospital-billing-color-theme', 'teal');
  });
  await page.getByLabel(/usuario o (correo|email)/i).fill(user);
  await page.getByLabel(/contrase.a/i).fill(password);
  await page.getByRole('button', { name: /entrar/i }).click();
  await page.waitForURL(/dashboard|billing|cashbox|catalog|invoices|reports|backups|settings|admin/, { timeout: 15000 });
  await waitSettled(page);
}

function countMatches(text, regexes) {
  return regexes.filter((regex) => regex.test(text)).map((regex) => String(regex));
}

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const report = [];

await login(page);

for (const [name, route, expected] of modules) {
  await page.goto(`${baseUrl}${route}`);
  await waitSettled(page);
  await page.getByRole('heading', { name: expected }).first().waitFor({ timeout: 12000 }).catch(() => {});

  const bodyText = await page.locator('body').innerText().catch(() => '');
  const logoutCount = await page.getByRole('menuitem', { name: /cerrar sesi.n/i }).count().catch(() => 0);
  const visibleLogoutButtons = await page.getByRole('button', { name: /cerrar sesi.n/i }).count().catch(() => 0);
  const technicalMatches = countMatches(bodyText, technicalTerms);

  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: false });

  report.push({
    module: name,
    route,
    screenshot: path.join(outputDir, `${name}.png`),
    logoutMenuItems: logoutCount,
    visibleLogoutButtons,
    technicalMatches,
  });
}

await writeFile(path.join(outputDir, 'ux-cleanup-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await browser.close();

console.log(`Screenshots saved to ${outputDir}`);
