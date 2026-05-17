#!/usr/bin/env node

const baseUrl = (process.env.HOSPITAL_CONCURRENCY_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');
const login = process.env.HOSPITAL_CONCURRENCY_LOGIN ?? 'cajero.demo';
const password = process.env.HOSPITAL_CONCURRENCY_PASSWORD ?? 'Password123!';

if (process.env.HOSPITAL_VALIDATE_REAL_MYSQL !== '1') {
  console.error('Abort: set HOSPITAL_VALIDATE_REAL_MYSQL=1 to run real HTTP concurrency validation.');
  process.exit(1);
}

class Session {
  cookies = new Map();

  async request(path, options = {}) {
    const headers = new Headers(options.headers ?? {});
    headers.set('Accept', 'application/json');
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (this.cookies.size > 0) {
      headers.set('Cookie', [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; '));
    }

    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });

    for (const cookie of response.headers.getSetCookie?.() ?? []) {
      const [pair] = cookie.split(';');
      const index = pair.indexOf('=');
      if (index > 0) {
        this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
      }
    }

    const text = await response.text();
    const body = text ? JSON.parse(text) : null;

    return { status: response.status, body };
  }

  async login() {
    await this.request('/sanctum/csrf-cookie');
    const result = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login, password }),
    });
    assertStatus(result, [200], 'login');
  }
}

function assertStatus(result, expected, label) {
  if (!expected.includes(result.status)) {
    throw new Error(`${label} returned HTTP ${result.status}: ${JSON.stringify(result.body)}`);
  }
}

async function main() {
  const session = new Session();
  await session.login();

  const services = await session.request('/api/services?search=Eritropoyetina&active=1&per_page=10');
  assertStatus(services, [200], 'services lookup');
  const service = services.body?.data?.[0];
  if (!service?.id) {
    throw new Error('Eritropoyetina service was not found. Seed the validation database first.');
  }

  const openPayload = { opening_amount: '500.00', notes: 'real concurrency validation' };
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
    session.request('/api/invoices', { method: 'POST', body: JSON.stringify(invoicePayload('Concurrente Uno')) }),
    session.request('/api/invoices', { method: 'POST', body: JSON.stringify(invoicePayload('Concurrente Dos')) }),
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

  console.log(JSON.stringify({
    status: 'VALIDATED',
    baseUrl,
    checks: {
      double_cash_open: openStatuses,
      concurrent_invoice_numbers: invoiceNumbers,
      double_payment: paymentStatuses,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
