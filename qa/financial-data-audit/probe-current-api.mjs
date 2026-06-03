import { chromium } from '../../frontend/node_modules/@playwright/test/index.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('qa/financial-data-audit');
await mkdir(outDir, { recursive: true });

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value;
}

const baseUrl = process.env.FINANCIAL_AUDIT_BASE_URL ?? 'http://localhost:5173';
const apiBaseUrl = process.env.FINANCIAL_AUDIT_API_BASE_URL ?? 'http://localhost:8000';
const auditUser = requiredEnv('FINANCIAL_AUDIT_USER');
const auditPassword = requiredEnv('FINANCIAL_AUDIT_PASSWORD');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const failedResponses = [];
page.on('response', (response) => {
  if (response.status() >= 400) {
    failedResponses.push({
      url: response.url(),
      status: response.status(),
      statusText: response.statusText(),
    });
  }
});

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.locator('input').first().fill(auditUser);
await page.locator('input[type="password"]').first().fill(auditPassword);
await page.getByRole('button', { name: /entrar|ingresar|iniciar/i }).click();
await page.waitForLoadState('networkidle');
await page.waitForTimeout(2000);
await page.getByRole('link', { name: /inicio|caja|nueva factura/i }).first().waitFor({ timeout: 10000 });

const endpoints = [
  `${apiBaseUrl}/api/auth/me`,
  `${apiBaseUrl}/api/cash-sessions/current`,
  `${apiBaseUrl}/api/services?per_page=5`,
  `${apiBaseUrl}/api/reports/daily?date=2026-05-31`,
  `${apiBaseUrl}/api/reports/income?date_from=2026-05-01&date_to=2026-05-31`,
  `${apiBaseUrl}/api/reports/dashboard`,
];

const results = {};
for (const endpoint of endpoints) {
  results[endpoint] = await page.evaluate(async (url) => {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    const text = await response.text();
    let body = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Keep original text for HTML errors.
    }
    return { status: response.status, body };
  }, endpoint);
}

await browser.close();

await writeFile(
  path.join(outDir, 'probe-current-api.json'),
  `${JSON.stringify({ failedResponses, results }, null, 2)}\n`,
);
