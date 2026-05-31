import { chromium } from '../../frontend/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('qa/financial-data-audit/screenshots');
await mkdir(outDir, { recursive: true });

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

const baseUrl = process.env.FINANCIAL_AUDIT_BASE_URL ?? 'http://localhost:5173';
const auditUser = requiredEnv('FINANCIAL_AUDIT_USER');
const auditPassword = requiredEnv('FINANCIAL_AUDIT_PASSWORD');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});

const notes = [];

async function shot(name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  notes.push({ name, file });
}

async function tryNavigate(label, name) {
  const pattern = new RegExp(label, 'i');
  const target = page
    .getByRole('link', { name: pattern })
    .or(page.getByRole('button', { name: pattern }))
    .first();

  try {
    await target.click({ timeout: 5000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await shot(name);
  } catch (error) {
    notes.push({
      name,
      missing: label,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function assertLoggedIn() {
  try {
    await page.getByRole('link', { name: /inicio|caja|nueva factura/i }).first().waitFor({ timeout: 10000 });
  } catch (error) {
    await shot('01-login-failed');
    notes.push({
      name: 'login',
      error: 'Login did not reach the authenticated application shell. Check FINANCIAL_AUDIT_USER and FINANCIAL_AUDIT_PASSWORD.',
    });
    await writeFile(
      path.resolve('qa/financial-data-audit/capture-current-ui.json'),
      `${JSON.stringify(notes, null, 2)}\n`,
    );
    throw new Error('Login did not reach the authenticated application shell.');
  }
}

await page.goto(baseUrl, {
  waitUntil: 'networkidle',
  timeout: 30000,
});
await shot('00-login');

await page.locator('input').first().fill(auditUser);
await page.locator('input[type="password"]').first().fill(auditPassword);
await page.getByRole('button', { name: /entrar|ingresar|iniciar/i }).click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(3000);
await assertLoggedIn();
await shot('01-dashboard');

await tryNavigate('caja', '02-caja');
await tryNavigate('nueva factura', '03-nueva-factura');
await tryNavigate('historial', '04-historial');
await tryNavigate('reportes', '05-reportes');
await tryNavigate('respaldos|backups', '06-respaldos');
await tryNavigate('catalogo|catálogo', '07-catalogo');
await tryNavigate('configuracion|configuración', '08-configuracion');
await tryNavigate('ayuda', '09-ayuda');

await browser.close();
await writeFile(
  path.resolve('qa/financial-data-audit/capture-current-ui.json'),
  `${JSON.stringify(notes, null, 2)}\n`,
);
