// =============================================================================
// Fiscal-number race test (HTTP-level).
//
// Hits /api/invoices from N parallel goroutines to verify the backend
// never returns a duplicate invoice_number when the fiscal sequence is
// under contention. Pair this with the LAN emulation cashier5 in
// docker-compose.lan-emulation.yml for a complete picture.
//
// Usage:
//   HOSPITAL_LOADTEST_TARGET_ENV=validation \
//   HOSPITAL_CONFIRM_LOADTEST_TARGET=https://192.168.1.10 \
//   BASE_URL=https://192.168.1.10 RACE_PARALLEL=8 \
//   RACE_TOTAL=80 node qa/loadtest/fiscal-race.js
// =============================================================================

const https = require('https');
const http = require('http');
const { performance } = require('perf_hooks');

const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
const user = process.env.CASHIER_USER || '';
const pass = process.env.CASHIER_PASSWORD || '';
const targetEnv = process.env.HOSPITAL_LOADTEST_TARGET_ENV || '';
const confirmedTarget = (process.env.HOSPITAL_CONFIRM_LOADTEST_TARGET || '').replace(/\/$/, '');
const parallel = parseInt(process.env.RACE_PARALLEL || '8', 10);
const total = parseInt(process.env.RACE_TOTAL || '80', 10);

const insecureSkipTLS = true;
const agent = new https.Agent({ rejectUnauthorized: !insecureSkipTLS });
const BLOCKED_PASSWORDS = new Set(['Cambio1234', 'password', 'admin', '123456']);

function assertSafeTarget() {
  if (!['validation', 'disposable', 'training'].includes(targetEnv)) {
    throw new Error(
      'Set HOSPITAL_LOADTEST_TARGET_ENV to validation, disposable or training. ' +
      'This script creates invoices and must not run against the real production database.',
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
  if (!pass) {
    throw new Error('CASHIER_PASSWORD is required and must come from a temporary validation account.');
  }
  if (BLOCKED_PASSWORDS.has(pass)) {
    throw new Error('CASHIER_PASSWORD looks like a demo/default password; use a disposable validation account.');
  }
}

function jar() {
  const store = {};
  return {
    get(header) {
      return (header || '').split(/,\s*/).map((c) => {
        const [k, ...rest] = c.split(';')[0].split('=');
        return rest.length ? [k.trim(), rest.join('=').trim()] : null;
      }).filter(Boolean).reduce((acc, [k, v]) => ((acc[k] = v), acc), store)[header.split('=')[0]];
    },
    extract(setCookie) {
      if (!setCookie) return;
      for (const raw of setCookie) {
        const [pair] = raw.split(';');
        const [k, v] = pair.split('=');
        store[k.trim()] = (v || '').trim();
      }
    },
    cookieHeader() {
      return Object.entries(store).map(([k, v]) => `${k}=${v}`).join('; ');
    },
  };
}

function request(method, path, { body, cookies } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        agent: url.protocol === 'https:' ? agent : undefined,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(cookies ? { Cookie: cookies.cookieHeader() } : {}),
        },
      },
      (res) => {
        if (res.headers['set-cookie'] && cookies) cookies.extract(res.headers['set-cookie']);
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf-8');
          let json = null;
          try { json = text ? JSON.parse(text) : null; } catch (_) { json = null; }
          resolve({ status: res.statusCode, body: json, text });
        });
      },
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login() {
  const cookies = jar();
  await request('GET', '/sanctum/csrf-cookie', { cookies });
  const res = await request('POST', '/api/auth/login', {
    cookies,
    body: { login: user, password: pass },
  });
  if (res.status !== 200) {
    throw new Error('login failed: ' + res.status + ' ' + res.text);
  }
  return cookies;
}

async function getServiceId(cookies) {
  const res = await request('GET', '/api/services?per_page=1', { cookies });
  if (res.status !== 200 || !res.body?.data?.[0]?.id) return null;
  return res.body.data[0].id;
}

async function openCash(cookies) {
  const cur = await request('GET', '/api/cash-sessions/current', { cookies });
  if (cur.status === 200 && cur.body?.data?.id) return true;
  const opened = await request('POST', '/api/cash-sessions/open', {
    cookies,
    body: { opening_amount: '100.00', notes: 'fiscal race' },
  });
  return opened.status === 201;
}

async function issue(cookies, svc) {
  return request('POST', '/api/invoices', {
    cookies,
    body: {
      patient_name: 'Race ' + Math.random().toString(36).slice(2, 8),
      items: [{ service_id: svc, quantity: '1.00' }],
    },
  });
}

async function main() {
  assertSafeTarget();
  const cookies = await login();
  const svc = await getServiceId(cookies);
  if (!svc) throw new Error('no service available');
  if (!(await openCash(cookies))) {
    throw new Error('could not open or reuse a cash session for the validation cashier');
  }

  const numbers = new Set();
  const duplicates = [];
  const errors = [];
  const latencies = [];
  let inflight = 0;
  let dispatched = 0;

  await new Promise((resolve) => {
    const launch = () => {
      while (inflight < parallel && dispatched < total) {
        const idx = dispatched++;
        inflight += 1;
        const t0 = performance.now();
        issue(cookies, svc)
          .then((res) => {
            latencies.push(performance.now() - t0);
            if (res.status !== 201) {
              errors.push({ idx, status: res.status, text: res.text?.slice(0, 200) });
            } else {
              const n = res.body?.data?.invoice_number;
              if (n) {
                if (numbers.has(n)) duplicates.push(n);
                numbers.add(n);
              }
            }
          })
          .catch((err) => errors.push({ idx, error: String(err) }))
          .finally(() => {
            inflight -= 1;
            if (dispatched >= total && inflight === 0) resolve();
            else launch();
          });
      }
    };
    launch();
  });

  const sorted = [...latencies].sort((a, b) => a - b);
  const p = (q) => sorted.length ? sorted[Math.floor((sorted.length - 1) * q)] : null;

  const report = {
    base_url: baseUrl,
    target_env: targetEnv,
    parallel,
    total,
    issued: numbers.size,
    duplicates,
    errors_count: errors.length,
    errors_sample: errors.slice(0, 5),
    latency_ms: { p50: p(0.5), p95: p(0.95), p99: p(0.99), max: sorted[sorted.length - 1] ?? null },
  };

  console.log(JSON.stringify(report, null, 2));

  if (duplicates.length > 0) {
    console.error('FAIL: ' + duplicates.length + ' duplicate fiscal numbers');
    process.exit(1);
  }
  if (errors.length > total * 0.05) {
    console.error('FAIL: more than 5% of requests failed');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
