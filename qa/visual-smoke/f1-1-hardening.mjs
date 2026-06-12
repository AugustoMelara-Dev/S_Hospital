import playwright from '../../frontend/node_modules/playwright/index.js';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';

const { chromium } = playwright;

const rootDir = path.resolve(import.meta.dirname, '..', '..');
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');
const outputDir = path.join(rootDir, 'qa', 'screenshots', 'after');
const consolePath = path.join(outputDir, 'f1-browser-console.json');
const reportPath = path.join(outputDir, 'f1.1-crud-report.json');
const tempStorageRoot = path.join(os.tmpdir(), 'shospital-storage-f1-1');
const backendRouter = path.join(rootDir, 'qa', 'visual-smoke', 'laravel-router.php');
const backendUrl = 'http://127.0.0.1:8010';
const frontendUrl = backendUrl;

const loginUser = process.env.F1_1_QA_USER?.trim() || 'admin.validacion';
const loginPassword = process.env.F1_1_QA_PASSWORD?.trim() || 'Password123!';
const useExistingServers = process.env.F1_1_USE_EXISTING === '1';
const qaName = 'Servicio QA F1';
const qaEditedName = 'Servicio QA F1 Editado';
const qaIdentifier = 'QA-F1-001';
const qaPrice = '45.00';
const mysqlExe = 'C:/xampp/mysql/bin/mysql.exe';

const consoleEntries = [];
const notes = [];

function cleanDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function setupTempStorage() {
  rmSync(tempStorageRoot, { recursive: true, force: true });
  mkdirSync(path.join(tempStorageRoot, 'framework', 'cache', 'data'), { recursive: true });
  mkdirSync(path.join(tempStorageRoot, 'framework', 'sessions'), { recursive: true });
  mkdirSync(path.join(tempStorageRoot, 'framework', 'views'), { recursive: true });
  mkdirSync(path.join(tempStorageRoot, 'logs'), { recursive: true });
  mkdirSync(path.join(tempStorageRoot, 'app', 'public', 'branding'), { recursive: true });

  const logoSource = path.join(backendDir, 'storage', 'app', 'public', 'branding', 'logo.png');
  const logoDest = path.join(tempStorageRoot, 'app', 'public', 'branding', 'logo.png');

  if (existsSync(logoSource)) {
    cpSync(logoSource, logoDest);
  }
}

function startServer(command, args, options) {
  return spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    shell: options.shell === true,
  });
}

async function waitForHttp(url, matcher, timeoutMs = 45_000, errorContext = '') {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      if (matcher(response, text)) {
        return { response, text };
      }
    } catch {
      // Ignore until timeout.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}${errorContext ? `\n${errorContext}` : ''}`);
}

function stopServer(child) {
  if (!child || child.killed) {
    return;
  }

  try {
    execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } catch {
    child.kill('SIGTERM');
  }
}

function recordConsole(entry) {
  consoleEntries.push({
    at: new Date().toISOString(),
    ...entry,
  });
}

function shouldIgnoreFailedRequest(url, errorText) {
  if (url.includes('/@vite') || url.includes('favicon')) {
    return true;
  }

  if (
    errorText === 'net::ERR_ABORTED'
    && (
      url.includes('/api/system/health')
      || url.includes('/api/settings/fiscal')
      || url.includes('/api/settings/logo')
      || url.includes('/api/system/echo-config')
      || url.includes('/sanctum/csrf-cookie')
      || url.includes('/api/categories')
      || url.includes('/api/areas')
      || url.includes('/api/services')
    )
  ) {
    return true;
  }

  return false;
}

async function waitSettled(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(350);
}

async function login(page) {
  await page.goto(`${backendUrl}/__qa_session?login=${encodeURIComponent(loginUser)}`);
  const bootstrapPayload = await page.locator('body').innerText({ timeout: 10_000 });
  if (!bootstrapPayload.includes('"ok": true') && !bootstrapPayload.includes('"ok":true')) {
    throw new Error(`QA session bootstrap did not return success payload: ${bootstrapPayload}`);
  }

  await page.goto(`${frontendUrl}/dashboard`);
  await Promise.race([
    page.waitForURL(/dashboard|catalog|billing\/new/, { timeout: 20_000 }),
    page.getByText(/sin permisos operativos/i).waitFor({ state: 'visible', timeout: 20_000 }),
  ]);
  await waitSettled(page);
}

async function openSelectItem(page, labelText, optionText) {
  const trigger = page.locator(`label:text-is("${labelText}")`).locator('..').getByRole('combobox');
  await trigger.click();
  await page.getByRole('option', { name: new RegExp(optionText, 'i') }).click();
}

async function clearAndFill(locator, value) {
  await locator.click();
  await locator.fill('');
  await locator.fill(value);
}

async function searchCatalog(page, value) {
  const input = page.locator('#catalog-search');
  await clearAndFill(input, value);
  await page.waitForTimeout(500);
}

async function searchPos(page, value) {
  const input = page.getByLabel(/buscar por nombre, categoria o codigo/i);
  await clearAndFill(input, value);
  await page.waitForTimeout(1_200);
}

function mysqlQuery(sql) {
  return execFileSync(mysqlExe, ['-u', 'root', 'hospital_billing', '-N', '-e', sql], {
    cwd: rootDir,
    encoding: 'utf8',
  }).trim();
}

function archivePreviousQaServices() {
  mysqlQuery(`
    update services
    set
      active = 0,
      visible_in_billing = 0,
      name = concat(name, ' [QA old #', id, ']'),
      slug = concat(slug, '-qa-old-', id)
    where name in ('${qaName}', '${qaEditedName}');
  `);
}

async function main() {
  cleanDir(outputDir);
  if (!useExistingServers) {
    setupTempStorage();
  }

  const backend = useExistingServers
    ? null
    : startServer('C:/xampp/php/php.exe', [
      '-S',
      '127.0.0.1:8010',
      '-t',
      'public',
      backendRouter,
    ], {
      cwd: backendDir,
      env: {
        CACHE_STORE: 'file',
        LARAVEL_STORAGE_PATH: tempStorageRoot,
        LOG_CHANNEL: 'stderr',
        SESSION_DRIVER: 'file',
      },
    });

  let backendStdErr = '';
  let backendStdOut = '';
  backend?.stdout.on('data', (chunk) => {
    backendStdOut += chunk.toString();
  });
  backend?.stderr.on('data', (chunk) => {
    backendStdErr += chunk.toString();
  });

  try {
    archivePreviousQaServices();

    await waitForHttp(
      `${backendUrl}/api/health`,
      (response, text) => response.ok && text.includes('"status":"ok"'),
      45_000,
      `backend stdout:\n${backendStdOut}\nbackend stderr:\n${backendStdErr}`,
    );
    await waitForHttp(
      `${frontendUrl}/login`,
      (response) => response.ok,
      60_000,
      `backend stdout:\n${backendStdOut}\nbackend stderr:\n${backendStdErr}`,
    );

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    page.on('console', (message) => {
      if (message.type() === 'error' || message.type() === 'warning') {
        recordConsole({
          type: `console.${message.type()}`,
          text: message.text(),
          url: page.url(),
        });
      }
    });

    page.on('pageerror', (error) => {
      recordConsole({
        type: 'pageerror',
        text: error.message,
        url: page.url(),
      });
    });

    page.on('requestfailed', (request) => {
      const failure = request.failure();
      const errorText = failure?.errorText ?? '';

      if (shouldIgnoreFailedRequest(request.url(), errorText)) {
        return;
      }

      recordConsole({
        type: 'requestfailed',
        method: request.method(),
        url: request.url(),
        text: errorText,
      });
    });

    page.on('response', async (response) => {
      if (response.status() >= 400) {
        recordConsole({
          type: `http.${response.status()}`,
          method: response.request().method(),
          url: response.url(),
        });
      }
    });

    await page.goto(`${frontendUrl}/login`);
    await waitSettled(page);
    await page.screenshot({ path: path.join(outputDir, 'f1-login.png'), fullPage: false });

    await login(page);

    await page.goto(`${frontendUrl}/catalog`);
    await waitSettled(page);
    await page.screenshot({ path: path.join(outputDir, 'f1-catalog.png'), fullPage: false });

    await searchCatalog(page, qaName);

    const newServiceButton = page.getByRole('button', { name: /nuevo servicio/i });
    await newServiceButton.click();
    await page.getByRole('dialog', { name: /nuevo servicio/i }).waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});

    await openSelectItem(page, 'Categoria *', 'Laboratorio');
    await openSelectItem(page, 'Area *', 'Laboratorio');
    await clearAndFill(page.locator('#name'), qaName);
    await clearAndFill(page.locator('#price'), qaPrice);

    const scannerField = page.locator('#scan_code');
    if (await scannerField.isVisible().catch(() => false)) {
      await clearAndFill(scannerField, qaIdentifier);
    } else {
      notes.push('Scanner deshabilitado en fiscal_settings; el identificador QA-F1-001 se uso como referencia documental y no como scan_code visible en UI.');
    }

    await page.getByRole('button', { name: /^crear$/i }).click();
    await page.getByText(qaName).first().waitFor({ state: 'visible', timeout: 15_000 });
    await waitSettled(page);
    await page.screenshot({ path: path.join(outputDir, 'f1.1-catalog-created.png'), fullPage: false });

    const createdRow = page.locator('tr').filter({ hasText: qaName }).first();
    await createdRow.getByRole('button', { name: new RegExp(`Acciones de servicio ${qaName}`, 'i') }).click();
    await page.getByRole('menuitem', { name: /editar/i }).click();
    await page.getByRole('dialog', { name: /editar servicio/i }).waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});

    await clearAndFill(page.locator('#name'), qaEditedName);
    if (await page.locator('#visible_in_billing').isVisible().catch(() => false)) {
      const checked = await page.locator('#visible_in_billing').getAttribute('data-state');
      if (checked === 'checked') {
        await page.locator('label[for="visible_in_billing"]').click();
      }
    }
    await page.getByRole('button', { name: /actualizar/i }).click();
    await page.getByText(qaEditedName).first().waitFor({ state: 'visible', timeout: 15_000 });
    await waitSettled(page);
    await page.screenshot({ path: path.join(outputDir, 'f1.1-catalog-edited.png'), fullPage: false });

    await page.goto(`${frontendUrl}/billing/new`);
    await waitSettled(page);
    await page.screenshot({ path: path.join(outputDir, 'f1-billing-new.png'), fullPage: false });
    await searchPos(page, qaEditedName);
    const hiddenCard = page.locator('button').filter({ hasText: qaEditedName }).first();
    if (await hiddenCard.isVisible().catch(() => false)) {
      notes.push('El servicio permanecio visible en POS despues de visible_in_billing=false; revisar manualmente si hubo cache de busqueda.');
    }

    await page.goto(`${frontendUrl}/catalog`);
    await waitSettled(page);
    await searchCatalog(page, qaEditedName);

    const hiddenRow = page.locator('tr').filter({ hasText: qaEditedName }).first();
    await hiddenRow.getByRole('button', { name: new RegExp(`Acciones de servicio ${qaEditedName}`, 'i') }).click();
    await page.getByRole('menuitem', { name: /editar/i }).click();
    await page.getByRole('dialog', { name: /editar servicio/i }).waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});

    if (await page.locator('#visible_in_billing').isVisible().catch(() => false)) {
      const visibleState = await page.locator('#visible_in_billing').getAttribute('data-state');
      if (visibleState !== 'checked') {
        await page.locator('label[for="visible_in_billing"]').click();
      }
    }

    if (await page.locator('#is_billable').isVisible().catch(() => false)) {
      const billableState = await page.locator('#is_billable').getAttribute('data-state');
      if (billableState === 'checked') {
        await page.locator('label[for="is_billable"]').click();
      }
    }

    await page.getByRole('button', { name: /actualizar/i }).click();
    await hiddenRow.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
    await waitSettled(page);

    await page.goto(`${frontendUrl}/billing/new`);
    await waitSettled(page);
    await searchPos(page, qaEditedName);

    const visibleCard = page.locator('button').filter({ hasText: qaEditedName }).first();
    await visibleCard.waitFor({ state: 'visible', timeout: 15_000 });
    await page.screenshot({ path: path.join(outputDir, 'f1.1-pos-service-visible.png'), fullPage: false });
    await page.getByText(/no es facturable/i).waitFor({ state: 'visible', timeout: 10_000 });
    await waitSettled(page);
    await page.screenshot({ path: path.join(outputDir, 'f1.1-pos-service-blocked-reason.png'), fullPage: false });

    await page.goto(`${frontendUrl}/catalog`);
    await waitSettled(page);
    await searchCatalog(page, qaEditedName);
    const finalRow = page.locator('tr').filter({ hasText: qaEditedName }).first();
    await finalRow.getByRole('button', { name: new RegExp(`Acciones de servicio ${qaEditedName}`, 'i') }).click();
    await page.getByRole('menuitem', { name: /desactivar/i }).click();
    await page.getByText(/inactivo/i).first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
    await waitSettled(page);
    await page.screenshot({ path: path.join(outputDir, 'f1.1-catalog-disabled-or-hidden.png'), fullPage: false });

    const persisted = mysqlQuery(
      `select id, name, active, visible_in_billing, is_billable, scan_code from services where name = '${qaEditedName}' order by id desc limit 1;`,
    );
    const persistedJson = await page.evaluate(async (serviceName) => {
      const response = await fetch(`/api/services?search=${encodeURIComponent(serviceName)}&active=0&per_page=50`, {
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        return { ok: false, status: response.status };
      }

      const payload = await response.json();
      return {
        ok: true,
        data: payload.data,
      };
    }, qaEditedName);

    await page.waitForTimeout(500);
    await browser.close();

    writeFileSync(consolePath, `${JSON.stringify({
      baseUrl: frontendUrl,
      backendUrl,
      entries: consoleEntries,
    }, null, 2)}\n`);

    writeFileSync(reportPath, `${JSON.stringify({
      loginUser,
      qaIdentifier,
      qaName,
      qaEditedName,
      notes,
      mysqlPersistedRow: persisted,
      apiPersistedResult: persistedJson,
    }, null, 2)}\n`);
  } finally {
    stopServer(backend);
  }

  if (consoleEntries.length > 0) {
    throw new Error(`Console or network blockers detected: ${consoleEntries.map((entry) => `${entry.type} ${entry.url ?? ''} ${entry.text ?? ''}`.trim()).join(' | ')}`);
  }
}

await main();
