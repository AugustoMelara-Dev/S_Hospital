import playwright from '../../frontend/node_modules/playwright/index.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const { chromium } = playwright;

const baseUrl = process.env.F4_VISUAL_BASE_URL?.trim() || 'http://127.0.0.1:5173';
const loginUser = process.env.F4_VISUAL_USER?.trim() || 'admin.validacion';
const loginPassword = process.env.F4_VISUAL_PASSWORD?.trim() || 'Password123!';
const outputDir = path.resolve(import.meta.dirname, '..', 'screenshots', 'after');
const patientName = `Paciente Smoke F4 ${Date.now()}`;

const forbiddenBranding = [
  /Billing\s+OS/i,
  /Expediente360/i,
  /AsisteHN/i,
  /Workspace/i,
  /SaaS/i,
  /Command\s+Center/i,
];

function sanitizeLogText(text) {
  return text
    .replaceAll(loginPassword, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
}

async function waitSettled(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);
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
    throw new Error(`${context}: captured login instead of authenticated screen (${page.url()})`);
  }
}

async function assertNoForbiddenBranding(page, context) {
  const text = await bodyText(page);
  const found = forbiddenBranding.find((pattern) => pattern.test(text));
  if (found) {
    throw new Error(`${context}: forbidden legacy branding detected (${String(found)})`);
  }
}

async function capture(page, name) {
  await assertNoLogin(page, name);
  await assertNoForbiddenBranding(page, name);
  const screenshotPath = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  return {
    name,
    route: new URL(page.url()).pathname,
    screenshot: screenshotPath,
    snippet: (await bodyText(page)).slice(0, 240),
  };
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
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), undefined, { timeout: 30000 });
  await waitSettled(page);
  await page.waitForFunction(
    () => !/iniciar sesi|usuario o correo|contrase/i.test(document.body?.innerText ?? ''),
    undefined,
    { timeout: 30000 },
  ).catch(() => {});
  await assertNoLogin(page, 'login');
}

async function ensureCashSession(page, report) {
  await page.goto(`${baseUrl}/cashbox`);
  await waitSettled(page);
  if (await looksLikeLogin(page)) {
    await login(page);
    await page.goto(`${baseUrl}/cashbox`);
    await waitSettled(page);
  }
  await page.getByRole('heading', { name: /^caja$/i }).first().waitFor({ timeout: 30000 });

  const alreadyOpen = await page.getByText(/caja lista para facturar|monto contado/i).first().isVisible().catch(() => false);
  if (alreadyOpen) {
    report.push(await capture(page, 'f4-cashbox-open'));
    return;
  }

  const openButton = page.getByRole('button', { name: /abrir caja/i }).first();
  if (!await openButton.isVisible().catch(() => false)) {
    throw new Error(`cashbox: no open session and no visible open button. Body: ${(await bodyText(page)).slice(0, 500)}`);
  }

  const openingAmount = page.getByLabel(/monto inicial/i).first();
  await openingAmount.fill('500.00');
  await openButton.click();
  await page.getByText(/caja abierta|caja lista para facturar|nueva factura/i).first().waitFor({ timeout: 15000 });
  await waitSettled(page);
  report.push(await capture(page, 'f4-cashbox-after-open'));
}

async function addFirstAvailableService(page) {
  const search = page.getByLabel(/buscar por nombre, categor/i).first();
  const candidates = ['glucosa', 'hemograma', 'consulta'];

  for (const term of candidates) {
    await search.fill(term);
    const serviceButton = await findPositivePriceServiceButton(page);
    if (serviceButton) {
      await serviceButton.click();
      return term;
    }
  }

  await page.getByRole('radio', { name: /^todos$/i }).click();
  const firstVisibleService = await findPositivePriceServiceButton(page);
  if (firstVisibleService) {
    const label = await firstVisibleService.getAttribute('aria-label');
    await firstVisibleService.click();
    return label ?? 'primer servicio visible';
  }

  throw new Error(`new-invoice: no billable service found for smoke. Body: ${(await bodyText(page)).slice(0, 500)}`);
}

async function findPositivePriceServiceButton(page) {
  const buttons = page.locator('button[aria-label^="Agregar "]');
  if (!await buttons.first().waitFor({ timeout: 6000 }).then(() => true).catch(() => false)) {
    return null;
  }

  const count = await buttons.count();
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    const label = await button.getAttribute('aria-label');
    if (label && !/L\.\s*0\.00\b/.test(label)) {
      return button;
    }
  }

  return null;
}

async function createAndPayInvoice(page, report) {
  await page.goto(`${baseUrl}/billing/new`);
  await waitSettled(page);
  if (await looksLikeLogin(page)) {
    await login(page);
    await page.goto(`${baseUrl}/billing/new`);
    await waitSettled(page);
  }
  await page.getByRole('heading', { name: /nueva factura/i }).waitFor({ timeout: 30000 });

  if (await page.getByText(/debe abrir la caja antes/i).first().isVisible().catch(() => false)) {
    await ensureCashSession(page, report);
    await page.goto(`${baseUrl}/billing/new`);
    await waitSettled(page);
  }

  await page.getByLabel(/nombre del paciente/i).fill(patientName);
  const serviceTerm = await addFirstAvailableService(page);
  report.push(await capture(page, 'f4-new-invoice-service-selected'));
  await page.getByRole('button', { name: /emitir y cobrar/i }).click();
  const confirmPaymentButton = page.getByRole('button', { name: /emitir y abrir cobro/i });
  await confirmPaymentButton.waitFor({ timeout: 15000 });
  await confirmPaymentButton.click();

  const paymentOpened = await page
    .getByRole('heading', { name: /registrar pago/i })
    .waitFor({ timeout: 30000 })
    .then(() => true)
    .catch(() => false);

  if (!paymentOpened) {
    report.push(await capture(page, 'f4-new-invoice-payment-missing'));
    throw new Error(`new-invoice: invoice did not open payment modal. Body: ${(await bodyText(page)).slice(0, 500)}`);
  }

  const previewCheckbox = page.getByLabel(/ver preview antes de imprimir/i);
  if (!await previewCheckbox.isChecked().catch(() => false)) {
    await previewCheckbox.check();
  }

  const amount = page.getByLabel(/monto recibido/i);
  const max = await amount.getAttribute('max');
  if (!max || Number(max) <= 0) {
    throw new Error(`payment: invalid pending balance max=${max}`);
  }

  await amount.fill(max);
  await page.getByRole('button', { name: /confirmar cobro/i }).click();
  const receiptVisible = await page.getByLabel(/recibo institucional/i)
    .waitFor({ timeout: 30000 })
    .then(() => true)
    .catch(() => false);
  if (!receiptVisible) {
    report.push(await capture(page, 'f4-payment-receipt-missing'));
    throw new Error(`payment: receipt preview did not open. Body: ${(await bodyText(page)).slice(0, 700)}`);
  }
  report.push(await capture(page, 'f4-new-invoice-paid-receipt'));
  const closeButton = page.getByRole('button', { name: /cerrar modal|cerrar$/i }).first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
    await waitSettled(page);
  }

  return { patientName, serviceTerm };
}

async function verifyHistoryAndReprint(page, report) {
  await page.goto(`${baseUrl}/invoices?patient=${encodeURIComponent(patientName)}`);
  await waitSettled(page);
  await page.getByRole('heading', { name: /historial de facturas/i }).waitFor({ timeout: 15000 });
  await page.getByText(patientName).first().waitFor({ timeout: 20000 });
  report.push(await capture(page, 'f4-invoice-history'));

  const reprintButton = page.getByRole('button', { name: /reimprimir/i }).first();
  await reprintButton.click();
  await page.getByRole('button', { name: /registrar reimpresi/i }).click();
  await page.getByLabel(/recibo institucional/i).waitFor({ timeout: 15000 });
  report.push(await capture(page, 'f4-history-reprint-receipt'));
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
    text.includes('Download the React DevTools')
  ) {
    return;
  }

  consoleEntries.push({ level: message.type(), text, url: page.url() });
});
page.on('pageerror', (error) => {
  consoleEntries.push({ level: 'pageerror', text: sanitizeLogText(error.message), url: page.url() });
});
page.on('requestfailed', (request) => {
  const failure = request.failure();
  const errorText = failure?.errorText ?? '';
  const url = request.url();

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
  if (response.status() === 429) {
    consoleEntries.push({
      level: 'http',
      text: sanitizeLogText(`${response.request().method()} ${response.url()} 429 Too Many Requests`),
      url: page.url(),
    });
  }
});

const report = [];
try {
  await login(page);
  await ensureCashSession(page, report);
  const invoice = await createAndPayInvoice(page, report);
  await verifyHistoryAndReprint(page, report);
  await writeFile(
    path.join(outputDir, 'f4-billing-cashbox-flow-report.json'),
    `${JSON.stringify({ baseUrl, loginUser, invoice, report, consoleEntries }, null, 2)}\n`,
  );
} finally {
  await browser.close();
}

if (consoleEntries.length > 0) {
  console.error(JSON.stringify(consoleEntries, null, 2));
  process.exitCode = 1;
}
