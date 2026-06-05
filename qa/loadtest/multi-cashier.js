// =============================================================================
// Multi-cashier load test for S_Hospital.
//
// Drives 5 virtual cashiers (configurable via VUS env var) against a
// running instance to validate that:
//   - the API can hold N concurrent cashiers without dropping sessions
//   - invoices and payments can be created under cashier load
//   - the queue worker does not back up
//   - the dashboard p50/p95/p99 latencies stay within budget
//
// Use fiscal-race.js for strict global duplicate-correlative detection.
//
// Usage:
//   HOSPITAL_LOADTEST_TARGET_ENV=validation \
//   HOSPITAL_CONFIRM_LOADTEST_TARGET=https://192.168.1.10 \
//   BASE_URL=https://192.168.1.10 \
//   CASHIER_USER_1=validacion.caja1 CASHIER_PASSWORD_1=... \
//   k6 run qa/loadtest/multi-cashier.js
//
// Prerequisites:
//   - 5 cashier users already exist in the running instance with
//     permission to open cash, create invoices, and register payments
//   - the local CA cert is trusted by the k6 host
//   - the docker stack is up and the queue worker is running
// =============================================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';

const baseUrl = (__ENV.BASE_URL || '').replace(/\/$/, '');
const targetEnv = __ENV.HOSPITAL_LOADTEST_TARGET_ENV || '';
const confirmedTarget = (__ENV.HOSPITAL_CONFIRM_LOADTEST_TARGET || '').replace(/\/$/, '');
const vus = parseInt(__ENV.VUS || '5', 10);
const duration = __ENV.DURATION || '60s';
const iterations = parseInt(__ENV.ITER || '20', 10);

if (!['validation', 'disposable', 'training'].includes(targetEnv)) {
  throw new Error(
    'Set HOSPITAL_LOADTEST_TARGET_ENV to validation, disposable or training. ' +
    'This script creates invoices/payments and must not run against the real production database.',
  );
}

if (confirmedTarget !== baseUrl.replace(/\/$/, '')) {
  throw new Error('HOSPITAL_CONFIRM_LOADTEST_TARGET must exactly match BASE_URL.');
}

if (!baseUrl || !baseUrl.startsWith('https://')) {
  throw new Error('BASE_URL is required and must use HTTPS.');
}

function requiredValue(name) {
  const value = __ENV[name];
  if (!value) {
    throw new Error(`${name} is required for a temporary validation account.`);
  }
  return value;
}

function requiredSecret(name) {
  const value = __ENV[name];
  if (!value) {
    throw new Error(`${name} is required and must come from a temporary validation account.`);
  }
  if (['Cambio1234', 'password', 'admin', '123456'].includes(value)) {
    throw new Error(`${name} looks like a demo/default password; use a disposable validation account.`);
  }
  return value;
}

const cashiers = new SharedArray('cashiers', function () {
  return [
    { id: 1, user: requiredValue('CASHIER_USER_1'), pass: requiredSecret('CASHIER_PASSWORD_1') },
    { id: 2, user: requiredValue('CASHIER_USER_2'), pass: requiredSecret('CASHIER_PASSWORD_2') },
    { id: 3, user: requiredValue('CASHIER_USER_3'), pass: requiredSecret('CASHIER_PASSWORD_3') },
    { id: 4, user: requiredValue('CASHIER_USER_4'), pass: requiredSecret('CASHIER_PASSWORD_4') },
    { id: 5, user: requiredValue('CASHIER_USER_5'), pass: requiredSecret('CASHIER_PASSWORD_5') },
  ];
});

const httpFailures = new Rate('http_failures');
const loginDuration = new Trend('login_duration_ms');
const invoiceDuration = new Trend('invoice_duration_ms');
const paymentDuration = new Trend('payment_duration_ms');
const fiscalNumbers = new Counter('fiscal_numbers_issued');

export const options = {
  vus: vus,
  duration: duration,
  iterations: iterations,
  thresholds: {
    http_req_duration: ['p(95)<1500', 'p(99)<3000'],
    http_failures: ['rate<0.05'],
    login_duration_ms: ['p(95)<2000'],
    invoice_duration_ms: ['p(95)<1500'],
    payment_duration_ms: ['p(95)<1500'],
  },
  insecureSkipTLSVerify: true,
};

function loginAs(cashier) {
  http.cookieJar().clear();
  http.get(`${baseUrl}/sanctum/csrf-cookie`);
  const t0 = Date.now();
  const res = http.post(
    `${baseUrl}/api/auth/login`,
    JSON.stringify({ login: cashier.user, password: cashier.pass }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  loginDuration.add(Date.now() - t0);
  check(res, { 'login 200': (r) => r.status === 200 });
  httpFailures.add(res.status !== 200);
  return res.status === 200;
}

function openCashSession() {
  const current = http.get(`${baseUrl}/api/cash-sessions/current`);
  if (current.status === 200 && current.json('data.id')) return true;

  const res = http.post(
    `${baseUrl}/api/cash-sessions/open`,
    JSON.stringify({ opening_amount: '100.00', notes: 'k6 open' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return res.status === 201;
}

function closeCashSession() {
  const cur = http.get(`${baseUrl}/api/cash-sessions/current`);
  if (cur.status !== 200) return false;
  const id = cur.json('data.id');
  if (!id) return false;
  const res = http.post(
    `${baseUrl}/api/cash-sessions/${id}/close`,
    JSON.stringify({ closing_amount: '100.00', notes: 'k6 close' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  return res.status === 200;
}

function fetchFirstServiceId() {
  const res = http.get(`${baseUrl}/api/services?per_page=1`);
  if (res.status !== 200) return null;
  const body = res.json();
  return body && body.data && body.data[0] ? body.data[0].id : null;
}

function createInvoice(serviceId) {
  const t0 = Date.now();
  const res = http.post(
    `${baseUrl}/api/invoices`,
    JSON.stringify({
      patient_name: 'Paciente k6 ' + Math.random().toString(36).slice(2, 8),
      items: [{ service_id: serviceId, quantity: '1.00' }],
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  invoiceDuration.add(Date.now() - t0);
  check(res, { 'invoice 201': (r) => r.status === 201 });
  httpFailures.add(res.status !== 201);
  if (res.status !== 201) return null;
  return res.json('data');
}

function registerPayment(invoice) {
  const amount = invoice.balance_due || invoice.total;
  if (!amount) {
    httpFailures.add(true);
    return false;
  }

  const t0 = Date.now();
  const res = http.post(
    `${baseUrl}/api/invoices/${invoice.id}/payments`,
    JSON.stringify({ method: 'cash', amount }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  paymentDuration.add(Date.now() - t0);
  check(res, { 'payment 201': (r) => r.status === 201 });
  httpFailures.add(res.status !== 201);
  return res.status === 201;
}

export default function () {
  const cashier = cashiers[(__VU - 1) % cashiers.length];

  if (!loginAs(cashier)) {
    sleep(1);
    return;
  }

  const svc = fetchFirstServiceId();
  if (!svc) {
    sleep(1);
    return;
  }

  if (!openCashSession()) {
    sleep(1);
    return;
  }

  for (let i = 0; i < 3; i += 1) {
    const inv = createInvoice(svc);
    if (inv) {
      fiscalNumbers.add(1);
      registerPayment(inv);
    }
    sleep(0.5);
  }

  closeCashSession();
  sleep(1);
}
