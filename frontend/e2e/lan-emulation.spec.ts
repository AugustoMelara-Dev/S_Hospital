// =============================================================================
// LAN emulation end-to-end test.
//
// Validates the cashier script and orchestrator wiring that backs
// docker-compose.lan-emulation.yml. We use a stub cashier (no
// browser automation) because the e2e runs against a mocked
// environment. The production script in qa/lan-emulation/cashier.js
// is the canonical one and runs inside the docker-compose.lan-emulation
// containers against a real stack.
//
// Run with:
//   npm run e2e -- e2e/lan-emulation.spec.ts
// =============================================================================

import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const WORK = path.join(ROOT, 'frontend', 'test-results', 'lan-emulation');
const RESULTS_DIR = path.join(WORK, 'results');
const SHOTS_DIR = path.join(WORK, 'shots');
const STUB_PATH = path.join(ROOT, 'frontend', 'e2e', 'fixtures', 'lan-emulation-cashier-stub.js');
const ORCHESTRATOR_PATH = path.join(ROOT, 'qa', 'lan-emulation', 'orchestrator.js');

test.beforeAll(async () => {
  await rm(WORK, { recursive: true, force: true });
  await mkdir(RESULTS_DIR, { recursive: true });
  await mkdir(SHOTS_DIR, { recursive: true });
});

test('stub cashier writes a JSON report with the expected shape', async () => {
  // Run the stub. STUB_REACHABLE=false makes the stub return an
  // error path but still emit a JSON file (cashier1.json) so the
  // contract is exercised.
  const result = spawnSync('node', [STUB_PATH.replace(/\.js$/, '.cjs')], {
    env: {
      ...process.env,
      BASE_URL: 'https://127.0.0.1:9',
      CASHIER_USER: 'cajero1',
      CASHIER_INDEX: '1',
      STUB_REACHABLE: 'false',
      RESULTS_DIR,
    },
    encoding: 'utf-8',
    timeout: 30_000,
  });

  // Stub exits 1 when unreachable, but stdout must contain a
  // parseable JSON document. PowerShell piping can strip the
  // final newline; split the stdout by '}\n' or by lines.
  const trimmed = (result.stdout || '').trim();
  expect(trimmed.length).toBeGreaterThan(0);

  const report = JSON.parse(trimmed);
  expect(report.cashier).toBe(1);
  expect(report.user).toBe('cajero1');
  expect(report.base_url).toBe('https://127.0.0.1:9');
  expect(Array.isArray(report.steps)).toBe(true);
  expect(report.started_at).toBeTruthy();
  expect(report.finished_at).toBeTruthy();
  expect(Array.isArray(report.console_errors)).toBe(true);
  expect(report.ok).toBe(false);

  // The stub writes cashier1.json under RESULTS_DIR; that is the
  // contract the orchestrator depends on.
  const file = await readFile(path.join(RESULTS_DIR, 'cashier1.json'), 'utf-8');
  expect(() => JSON.parse(file)).not.toThrow();
});

test('orchestrator aggregates per-cashier reports and detects failures', async () => {
  // Reset and seed two reports: one OK, one failed. The orchestrator
  // expects reports to live under RESULTS_DIR, which the stub
  // writes to.
  await rm(RESULTS_DIR, { recursive: true, force: true });
  await mkdir(RESULTS_DIR, { recursive: true });

  const runId = 'e2e-fail-' + Date.now();
  const startedAt = new Date().toISOString();
  const finishedAt = new Date(Date.now() + 5000).toISOString();
  const okReport = {
    cashier: 1,
    user: 'cajero1',
    base_url: 'https://127.0.0.1:8443',
    scenario: 'login_only',
    run_id: runId,
    started_at: startedAt,
    finished_at: finishedAt,
    ok: true,
    steps: [
      { step: '/up', status: 200, ms: 50 },
      { step: 'login', status: 200, ms: 200 },
      { step: 'websocket', connected: true, ms: 300 },
    ],
    console_errors: [],
  };
  const failReport = {
    ...okReport,
    cashier: 2,
    user: 'cajero2',
    ok: false,
    steps: [{ step: '/up', status: 0, ms: 5000 }],
    console_errors: ['ERR_CONNECTION_REFUSED'],
  };

  await writeFile(path.join(RESULTS_DIR, 'cashier1.json'), JSON.stringify(okReport, null, 2));
  await writeFile(path.join(RESULTS_DIR, 'cashier2.json'), JSON.stringify(failReport, null, 2));

  const result = spawnSync('node', [ORCHESTRATOR_PATH], {
    env: {
      ...process.env,
      BASE_URL: 'https://127.0.0.1:8443',
      SCENARIO: 'login_only',
      LAN_EMULATION_RESULTS_DIR: RESULTS_DIR,
      LAN_EMULATION_RUN_ID: runId,
      EXPECTED_CASHIERS: '2',
    },
    encoding: 'utf-8',
    timeout: 15_000,
  });

  expect(result.status).toBe(1);

  const reportPath = path.join(RESULTS_DIR, 'lan-emulation-report.json');
  const files = await readdir(RESULTS_DIR);
  expect(files).toContain('lan-emulation-report.json');

  const aggregate = JSON.parse(await readFile(reportPath, 'utf-8'));
  expect(aggregate.cashiers_total).toBe(2);
  expect(aggregate.cashiers_ok).toBe(1);
  expect(aggregate.all_websocket_connected).toBe(false);
  expect(aggregate.sla_total_ms).toBe(60_000);
  expect(aggregate.per_cashier).toHaveLength(2);
  expect(aggregate.per_cashier.find((c: { cashier: number }) => c.cashier === 2).ok).toBe(false);
});

test('orchestrator exits 0 when all cashiers connect and stay within SLA', async () => {
  // Reset and seed three all-OK reports.
  await rm(RESULTS_DIR, { recursive: true, force: true });
  await mkdir(RESULTS_DIR, { recursive: true });

  const runId = 'e2e-ok-' + Date.now();
  const startedAt = new Date().toISOString();
  const finishedAt = new Date(Date.now() + 30_000).toISOString();
  for (let i = 1; i <= 3; i += 1) {
    const report = {
      cashier: i,
      user: `cajero${i}`,
      base_url: 'https://127.0.0.1:8443',
      scenario: 'login_only',
      run_id: runId,
      started_at: startedAt,
      finished_at: finishedAt,
      ok: true,
      steps: [
        { step: '/up', status: 200, ms: 50 },
        { step: 'login', status: 200, ms: 200 },
        { step: 'websocket', connected: true, ms: 300 },
      ],
      console_errors: [],
    };
    await writeFile(path.join(RESULTS_DIR, `cashier${i}.json`), JSON.stringify(report, null, 2));
  }

  const result = spawnSync('node', [ORCHESTRATOR_PATH], {
    env: {
      ...process.env,
      BASE_URL: 'https://127.0.0.1:8443',
      SCENARIO: 'login_only',
      LAN_EMULATION_RESULTS_DIR: RESULTS_DIR,
      LAN_EMULATION_RUN_ID: runId,
      EXPECTED_CASHIERS: '3',
    },
    encoding: 'utf-8',
    timeout: 15_000,
  });

  expect(result.status).toBe(0);
  const aggregate = JSON.parse(await readFile(path.join(RESULTS_DIR, 'lan-emulation-report.json'), 'utf-8'));
  expect(aggregate.cashiers_total).toBe(3);
  expect(aggregate.cashiers_ok).toBe(3);
  expect(aggregate.all_websocket_connected).toBe(true);
  expect(aggregate.all_within_sla).toBe(true);
});

test('docker-compose.lan-emulation.yml exists and declares 5 cashiers', async () => {
  const composePath = path.join(ROOT, 'docker-compose.lan-emulation.yml');
  const content = (await readFile(composePath, 'utf-8'));

  for (const service of ['cashier1', 'cashier2', 'cashier3', 'cashier4', 'cashier5']) {
    expect(content, `lan-emulation must define ${service}`).toContain(`${service}:`);
  }
  expect(content).toContain('orchestrator:');
  expect(content).toContain('playwright:');
  expect(content).toContain('hospital_default');
});
