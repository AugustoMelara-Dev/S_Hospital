#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const baseUrl = (process.env.HOSPITAL_CONCURRENCY_BASE_URL ?? '').replace(/\/$/, '');
const targetEnv = process.env.HOSPITAL_CONCURRENCY_TARGET_ENV ?? process.env.TARGET_ENV ?? process.env.APP_ENV ?? '';
const evidencePathInput = process.env.HOSPITAL_CONCURRENCY_EVIDENCE_PATH ?? '';
const loadRequests = positiveInt(process.env.HOSPITAL_LOAD_REQUESTS, 180);
const loadConcurrency = positiveInt(process.env.HOSPITAL_LOAD_CONCURRENCY, 20);
const runId = `concurrency-load-${new Date().toISOString().replace(/[^0-9A-Za-z]/g, '').slice(0, 14)}`;

const loadEndpoints = [
  '/api/auth/me',
  '/api/reports/dashboard',
  '/api/reports/today',
  '/api/cash-sessions/current',
  '/api/services?search=Glucosa',
  '/api/invoices?per_page=10',
];

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Abort: set ${name} to an authorized disposable validation account.`);
    process.exit(1);
  }
  return value;
}

if (process.env.HOSPITAL_VALIDATE_REAL_MYSQL !== '1') {
  console.error('Abort: set HOSPITAL_VALIDATE_REAL_MYSQL=1 to run real HTTP concurrency/load validation.');
  process.exit(1);
}

if (!baseUrl) {
  console.error('Abort: set HOSPITAL_CONCURRENCY_BASE_URL to an explicit disposable validation server URL.');
  process.exit(1);
}

let baseUri;
try {
  baseUri = new URL(baseUrl);
} catch {
  console.error('Abort: HOSPITAL_CONCURRENCY_BASE_URL must be an absolute http(s) URL for a disposable validation server.');
  process.exit(1);
}

if (!['http:', 'https:'].includes(baseUri.protocol)) {
  console.error('Abort: HOSPITAL_CONCURRENCY_BASE_URL must start with http:// or https://.');
  process.exit(1);
}

if (baseUri.username || baseUri.password) {
  console.error('Abort: do not put credentials inside HOSPITAL_CONCURRENCY_BASE_URL.');
  process.exit(1);
}

if (process.env.HOSPITAL_CONFIRM_CONCURRENCY_TARGET !== baseUrl) {
  console.error(`Abort: set HOSPITAL_CONFIRM_CONCURRENCY_TARGET=${baseUrl} to confirm the disposable concurrency target.`);
  process.exit(1);
}

if (/(production|prod|staging|preprod)/i.test(targetEnv)) {
  console.error(`Abort: refusing concurrency/load validation against non-disposable target environment: ${targetEnv}.`);
  process.exit(1);
}

if (!/(test|local|validation|disposable)/i.test(`${baseUrl} ${targetEnv}`)) {
  console.error('Abort: target URL or HOSPITAL_CONCURRENCY_TARGET_ENV must contain test, local, validation, or disposable.');
  process.exit(1);
}

const evidencePath = validateEvidencePath(evidencePathInput);
const mutationLogin = requiredEnv('HOSPITAL_CONCURRENCY_LOGIN');
const mutationPassword = requiredEnv('HOSPITAL_CONCURRENCY_PASSWORD');
const loadLogin = process.env.HOSPITAL_LOAD_LOGIN?.trim() || mutationLogin;
const loadPassword = process.env.HOSPITAL_LOAD_PASSWORD?.trim() || mutationPassword;

class Session {
  cookies = new Map();

  constructor(login, password) {
    this.loginName = login;
    this.password = password;
  }

  async request(path, options = {}) {
    const headers = new Headers(options.headers ?? {});
    headers.set('Accept', 'application/json');
    headers.set('Origin', baseUrl);
    headers.set('Referer', `${baseUrl}/login`);

    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    if (options.method && !['GET', 'HEAD'].includes(options.method.toUpperCase())) {
      if (!headers.has('Idempotency-Key')) {
        headers.set('Idempotency-Key', `concurrency-${runId}-${randomUUID()}`);
      }

      const xsrfToken = this.cookies.get('XSRF-TOKEN');
      if (xsrfToken && !headers.has('X-XSRF-TOKEN')) {
        headers.set('X-XSRF-TOKEN', decodeURIComponent(xsrfToken));
      }
    }

    if (this.cookies.size > 0) {
      headers.set('Cookie', [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; '));
    }

    const started = performance.now();
    const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
    const elapsedMs = Math.round(performance.now() - started);

    for (const cookie of response.headers.getSetCookie?.() ?? []) {
      const [pair] = cookie.split(';');
      const index = pair.indexOf('=');
      if (index > 0) {
        this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
      }
    }

    const contentType = response.headers.get('content-type') ?? '';
    const text = await response.text();
    const body = text && contentType.includes('application/json') ? JSON.parse(text) : text;

    return { status: response.status, body, contentType, elapsedMs, path };
  }

  async login() {
    await this.request('/sanctum/csrf-cookie');
    const result = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login: this.loginName, password: this.password }),
    });
    assertStatus(result, [200], `login ${this.loginName}`);
  }
}

function assertStatus(result, expected, label) {
  if (!expected.includes(result.status)) {
    throw new Error(`${label} returned HTTP ${result.status}: ${safeJson(result.body)}`);
  }
}

function protectText(value) {
  let protectedValue = String(value ?? '');
  const replacements = [
    [process.cwd(), '%PROJECT_ROOT%'],
    [process.cwd().replace(/\\/g, '/'), '%PROJECT_ROOT%'],
    [process.env.USERPROFILE, '%USERPROFILE%'],
    [process.env.HOME, '%USERPROFILE%'],
  ].filter(([from]) => from);

  for (const [from, to] of replacements) {
    protectedValue = protectedValue.split(from).join(to);
  }

  return protectedValue
    .replace(/(APP_KEY|DB_PASSWORD|PASSWORD|TOKEN|SECRET|MAIL_PASSWORD)\s*[:=]\s*[^,\s\]\)]+/gi, '$1=[redacted]')
    .replace(/[A-Z]:\\[^\s`"']+/gi, '[ruta-local]');
}

function safeJson(value) {
  const text = JSON.stringify(value ?? null);

  return protectText(text.length > 800 ? `${text.slice(0, 800)}...` : text);
}

function validateEvidencePath(value) {
  const rawPath = value.trim();
  if (!rawPath) {
    return '';
  }

  if (!/\.md$/i.test(rawPath)) {
    console.error('Abort: HOSPITAL_CONCURRENCY_EVIDENCE_PATH must be a Markdown file under qa/.');
    process.exit(1);
  }

  const projectRoot = process.cwd();
  const qaRoot = resolve(projectRoot, 'qa');
  const resolvedPath = resolve(projectRoot, rawPath);
  const relativeToQa = relative(qaRoot, resolvedPath);

  if (relativeToQa === '' || relativeToQa.startsWith('..') || isAbsolute(relativeToQa)) {
    console.error('Abort: HOSPITAL_CONCURRENCY_EVIDENCE_PATH must stay inside the qa/ evidence folder.');
    process.exit(1);
  }

  return resolvedPath;
}

async function runLoad(loadSession, startedSignal) {
  const results = [];
  let next = 0;
  let started = 0;

  async function worker(workerId) {
    while (next < loadRequests) {
      const index = next;
      next += 1;
      started += 1;

      if (started === Math.min(loadConcurrency, loadRequests)) {
        startedSignal.resolve();
      }

      const endpoint = loadEndpoints[index % loadEndpoints.length];
      try {
        results.push(await loadSession.request(endpoint));
      } catch (error) {
        results.push({
          status: 0,
          path: endpoint,
          elapsedMs: 0,
          contentType: '',
          body: `worker ${workerId}: ${error.message}`,
        });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(loadConcurrency, loadRequests) }, (_, index) => worker(index + 1)));

  return summarizeLoad(results);
}

function summarizeLoad(results) {
  const latencies = results.map((result) => result.elapsedMs).filter((value) => value > 0).sort((a, b) => a - b);
  const statusCounts = {};
  const htmlResponses = results.filter((result) => /text\/html/i.test(result.contentType)).length;
  const failures = results.filter((result) => result.status < 200 || result.status >= 400 || /text\/html/i.test(result.contentType));

  for (const result of results) {
    statusCounts[result.status] = (statusCounts[result.status] ?? 0) + 1;
  }

  return {
    total: results.length,
    concurrency: loadConcurrency,
    endpoints: loadEndpoints,
    status_counts: statusCounts,
    failures: failures.length,
    html_responses: htmlResponses,
    min_ms: percentile(latencies, 0),
    p50_ms: percentile(latencies, 50),
    p95_ms: percentile(latencies, 95),
    max_ms: percentile(latencies, 100),
    sample_failures: failures.slice(0, 5).map((result) => ({
      path: result.path,
      status: result.status,
      content_type: result.contentType,
      body: typeof result.body === 'string' ? protectText(result.body.slice(0, 200)) : result.body,
    })),
  };
}

function percentile(values, percentileValue) {
  if (values.length === 0) {
    return 0;
  }

  const index = Math.min(values.length - 1, Math.max(0, Math.ceil((percentileValue / 100) * values.length) - 1));

  return values[index];
}

async function runCriticalMutations(session) {
  const services = await session.request('/api/services?search=Eritropoyetina&active=1&per_page=10');
  assertStatus(services, [200], 'services lookup');
  const service = services.body?.data?.[0];
  if (!service?.id) {
    throw new Error('Eritropoyetina service was not found. Seed the validation database first.');
  }

  const openPayload = { opening_amount: '500.00', notes: `real concurrency/load validation ${runId}` };
  const openResults = await Promise.all([
    session.request('/api/cash-sessions/open', { method: 'POST', body: JSON.stringify(openPayload) }),
    session.request('/api/cash-sessions/open', { method: 'POST', body: JSON.stringify(openPayload) }),
  ]);
  const openStatuses = openResults.map((result) => result.status).sort();
  if (openStatuses[0] !== 201 || ![409, 422].includes(openStatuses[1])) {
    throw new Error(`double cash open expected one success and one validation failure, got ${openStatuses.join(', ')}`);
  }
  const cashSession = openResults.find((result) => result.status === 201)?.body?.data;

  const invoicePayload = (patientName) => ({
    patient_name: patientName,
    items: [{ service_id: service.id, quantity: '1.00', dialysis_prescription: false }],
  });
  const invoiceResults = await Promise.all([
    session.request('/api/invoices', { method: 'POST', body: JSON.stringify(invoicePayload(`Carga Concurrente Uno ${runId}`)) }),
    session.request('/api/invoices', { method: 'POST', body: JSON.stringify(invoicePayload(`Carga Concurrente Dos ${runId}`)) }),
  ]);
  invoiceResults.forEach((result, index) => assertStatus(result, [201], `concurrent invoice ${index + 1}`));
  const invoiceNumbers = invoiceResults.map((result) => result.body.data.invoice_number);
  if (new Set(invoiceNumbers).size !== 2) {
    throw new Error(`concurrent invoices duplicated invoice number: ${invoiceNumbers.join(', ')}`);
  }

  const paymentInvoice = invoiceResults[0].body.data;
  const paymentPayload = {
    cash_session_id: cashSession.id,
    method: 'cash',
    amount: paymentInvoice.total,
  };
  const paymentResults = await Promise.all([
    session.request(`/api/invoices/${paymentInvoice.id}/payments`, { method: 'POST', body: JSON.stringify(paymentPayload) }),
    session.request(`/api/invoices/${paymentInvoice.id}/payments`, { method: 'POST', body: JSON.stringify(paymentPayload) }),
  ]);
  const paymentStatuses = paymentResults.map((result) => result.status).sort();
  if (paymentStatuses[0] !== 201 || ![409, 422].includes(paymentStatuses[1])) {
    throw new Error(`double payment expected one success and one validation failure, got ${paymentStatuses.join(', ')}`);
  }

  return {
    double_cash_open: openStatuses,
    concurrent_invoice_numbers: invoiceNumbers,
    double_payment: paymentStatuses,
  };
}

async function main() {
  console.error(protectText(`Running mutating concurrency/load validation against ${baseUrl} with RUN_ID=${runId}. Use only on disposable data.`));
  const mutationSession = new Session(mutationLogin, mutationPassword);
  const loadSession = new Session(loadLogin, loadPassword);

  await Promise.all([mutationSession.login(), loadSession.login()]);

  const startedSignal = Promise.withResolvers();
  const loadPromise = runLoad(loadSession, startedSignal);
  await startedSignal.promise;
  await sleep(100);
  const mutationChecks = await runCriticalMutations(mutationSession);
  const loadSummary = await loadPromise;

  if (loadSummary.failures > 0) {
    throw new Error(`load phase had ${loadSummary.failures} failures: ${safeJson(loadSummary.sample_failures)}`);
  }

  const result = {
    status: 'VALIDATED',
    baseUrl,
    target_env: targetEnv,
    run_id: runId,
    executed_at: new Date().toISOString(),
    load_user: loadLogin,
    mutation_user: mutationLogin,
    cleanup: 'NOT_PERFORMED_AUDIT_RECORDS_REQUIRE_DISPOSABLE_DB_SNAPSHOT',
    load: loadSummary,
    checks: mutationChecks,
  };

  if (evidencePath) {
    await writeEvidence(evidencePath, result);
  }

  console.log(JSON.stringify(result, null, 2));
}

async function writeEvidence(path, result) {
  await mkdir(dirname(path), { recursive: true });
  const content = `# Final concurrency under load proof

## Environment

- Date/time: ${result.executed_at}
- Responsible person: Automated validation script
- Server LAN URL: ${result.baseUrl}
- Target environment: ${result.target_env}
- Run ID: ${result.run_id}
- Load user: ${result.load_user}
- Mutation user: ${result.mutation_user}
- Load requests/concurrency: ${result.load.total} / ${result.load.concurrency}
- Final conclusion: Critical cash, invoice, and payment concurrency checks completed while authenticated API load was running against the same Laravel/MariaDB stack.

## Required checks

- [x] Authenticated load had zero failures. Result/evidence: ${result.load.total} requests, ${result.load.failures} failures, p95 ${result.load.p95_ms} ms.
- [x] Double cash-session open leaves one truth under load. Result/evidence: HTTP ${result.checks.double_cash_open.join(' / ')}.
- [x] Concurrent invoice emission keeps unique numbers under load. Result/evidence: ${result.checks.concurrent_invoice_numbers.join(', ')}.
- [x] Double payment leaves one posted payment under load. Result/evidence: HTTP ${result.checks.double_payment.join(' / ')}.

## Evidence

\`\`\`json
${JSON.stringify(result, null, 2)}
\`\`\`
`;

  await writeFile(path, content, 'utf8');
}

main().catch((error) => {
  console.error(protectText(error.message));
  process.exit(1);
});
