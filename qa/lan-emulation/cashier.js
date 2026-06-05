// =============================================================================
// LAN emulation cashier - Playwright script.
//
// Cada contenedor "cashierN" corre este script para validar que la
// sesion, el WebSocket y la concurrencia fiscal funcionan como si
// fuera una PC fisica distinta. Genera un JSON con resultados en
// /work/results/cashier<N>.json que el orquestador agrega.
//
// Variables de entorno:
//   BASE_URL           - https://IP  (LAN validation server)
//   CASHIER_USER       - usuario temporal de validacion
//   CASHIER_PASSWORD   - contrasena
//   CASHIER_INDEX      - 1..5 (numero de cashier logico)
//   SCENARIO           - login_only | invoice | concurrent
//   LAN_EMULATION_RUN_ID - identificador unico de esta corrida
//   HOSPITAL_LOADTEST_TARGET_ENV     - validation | disposable | training
//   HOSPITAL_CONFIRM_LOADTEST_TARGET - debe coincidir exactamente con BASE_URL
// =============================================================================

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RESULTS_DIR = '/work/results';
const SHOTS_DIR = '/work/shots';
const BLOCKED_PASSWORDS = new Set(['Cambio1234', 'password', 'admin', '123456']);

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function readResults(idx) {
  return ensureDir(RESULTS_DIR).then(() =>
    path.join(RESULTS_DIR, `cashier${idx}.json`),
  );
}

async function main() {
  const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
  const user = process.env.CASHIER_USER || '';
  const pass = process.env.CASHIER_PASSWORD || '';
  const idx = parseInt(process.env.CASHIER_INDEX || '0', 10);
  const scenario = process.env.SCENARIO || 'login_only';
  const runId = process.env.LAN_EMULATION_RUN_ID || '';
  const targetEnv = process.env.HOSPITAL_LOADTEST_TARGET_ENV || '';
  const confirmedTarget = (process.env.HOSPITAL_CONFIRM_LOADTEST_TARGET || '').replace(/\/$/, '');

  if (!['validation', 'disposable', 'training'].includes(targetEnv)) {
    throw new Error(
      'Set HOSPITAL_LOADTEST_TARGET_ENV to validation, disposable or training. ' +
      'LAN emulation must not run against the real production database.',
    );
  }
  if (confirmedTarget !== baseUrl) {
    throw new Error('HOSPITAL_CONFIRM_LOADTEST_TARGET must exactly match BASE_URL.');
  }
  if (!baseUrl || !baseUrl.startsWith('https://')) {
    throw new Error('BASE_URL is required and must use HTTPS.');
  }
  if (!user) {
    throw new Error('CASHIER_USER is required and must identify a temporary validation account.');
  }
  if (!Number.isInteger(idx) || idx < 1 || idx > 5) {
    throw new Error('CASHIER_INDEX must be an integer between 1 and 5.');
  }
  if (!runId || !/^[A-Za-z0-9_.-]+$/.test(runId)) {
    throw new Error('LAN_EMULATION_RUN_ID is required and may contain only letters, numbers, dot, dash or underscore.');
  }
  if (!pass) {
    throw new Error('CASHIER_PASSWORD is required and must come from a temporary validation account.');
  }
  if (BLOCKED_PASSWORDS.has(pass)) {
    throw new Error('CASHIER_PASSWORD looks like a demo/default password; use a disposable validation account.');
  }

  await ensureDir(RESULTS_DIR);
  await ensureDir(SHOTS_DIR);

  const result = {
    cashier: idx,
    base_url: baseUrl,
    target_env: targetEnv,
    scenario,
    run_id: runId,
    started_at: new Date().toISOString(),
    steps: [],
    ok: false,
  };

  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--ignore-certificate-errors',
    ],
  });

  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();
  const consoleErrors = [];
  let websocketObserved = false;
  const websocketUrls = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('websocket', (ws) => {
    websocketObserved = true;
    websocketUrls.push(ws.url().replace(/\?.*/, '?redacted'));
  });

  try {
    // ---- 1. /up ----
    const t0 = Date.now();
    const up = await page.goto(`${baseUrl}/up`, { waitUntil: 'domcontentloaded' });
    result.steps.push({ step: '/up', status: up?.status() ?? 0, ms: Date.now() - t0 });
    if (!up || !up.ok()) {
      throw new Error(`/up failed with status ${up?.status() ?? 0}`);
    }

    // ---- 2. /login ----
    const t1 = Date.now();
    await page.goto(`${baseUrl}/login`, { waitUntil: 'networkidle' });
    const loginStatus = page.url().endsWith('/login') || page.url().includes('/login') ? 200 : 0;
    result.steps.push({ step: '/login', status: loginStatus, ms: Date.now() - t1 });

    // ---- 3. Login ----
    const t2 = Date.now();
    await page.fill('input[name="login"]', user);
    await page.fill('input[name="password"]', pass);
    await Promise.all([
      page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15000 }),
      page.click('button[type="submit"]'),
    ]);
    const dashUrl = page.url();
    result.steps.push({ step: 'login', status: dashUrl.includes('/dashboard') ? 200 : 0, ms: Date.now() - t2 });
    if (!dashUrl.includes('/dashboard')) {
      throw new Error(`login did not reach dashboard; current URL is ${dashUrl}`);
    }
    await page.screenshot({ path: path.join(SHOTS_DIR, `cashier${idx}-dashboard.png`) });

    // ---- 4. Verify WebSocket connectivity ----
    const t3 = Date.now();
    await page.waitForTimeout(3000);
    const appEchoState = await page.evaluate(async () => {
      try {
        // eslint-disable-next-line no-undef
        const PusherCtor = window.Pusher;
        if (!PusherCtor) return { connected: false, reason: 'no-pusher' };
        // pusher-js keeps an internal counter; the cleanest way is
        // to check the Echo instance we created in /src/lib/realtime.
        // eslint-disable-next-line no-undef
        const echo = window.Echo;
        if (!echo) return { connected: false, reason: 'no-echo' };
        const conn = echo.connector?.pusher?.connection;
        return {
          connected: conn?.state === 'connected',
          state: conn?.state,
        };
      } catch (e) {
        return { connected: false, reason: String(e) };
      }
    });
    result.steps.push({
      step: 'websocket',
      observed: websocketObserved,
      connected: websocketObserved || appEchoState.connected,
      app_state: appEchoState.state,
      reason: appEchoState.reason,
      urls_observed: websocketUrls.length,
      ms: Date.now() - t3,
    });

    // ---- 5. Scenario-specific ----
    if (scenario === 'invoice' || scenario === 'concurrent') {
      const t4 = Date.now();
      await page.goto(`${baseUrl}/billing/new`, { waitUntil: 'networkidle' });
      const hasPatientInput = await page.$('input[name="patient_name"]');
      result.steps.push({ step: '/billing/new', landed_form: !!hasPatientInput, ms: Date.now() - t4 });
      if (!hasPatientInput) {
        throw new Error('invoice scenario did not reach the new-invoice form; confirm the validation cashier has an open cash session.');
      }
      await page.screenshot({ path: path.join(SHOTS_DIR, `cashier${idx}-pos.png`) });
    }

    if (scenario === 'concurrent') {
      // The orchestrator invokes us in parallel; we just record that
      // the cashier reached the POS. The orchestrator collects the
      // timestamps. Fiscal-number races are covered by qa/loadtest/fiscal-race.js.
      result.steps.push({ step: 'concurrent_pos_reached', ok: true });
    }

    result.ok = true;
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    result.stack = err instanceof Error ? err.stack : undefined;
  } finally {
    result.console_errors = consoleErrors;
    result.finished_at = new Date().toISOString();
    await browser.close().catch(() => undefined);
    await fs.promises.writeFile(await readResults(idx), JSON.stringify(result, null, 2));
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result));
  }

  process.exit(result.ok ? 0 : 1);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(2);
});
