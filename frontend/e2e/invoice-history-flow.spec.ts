import { expect, test, type Page, type Route } from '@playwright/test';

const invoiceUser = {
  id: 81,
  name: 'Historial Admin',
  email: 'historial@hospital.local',
  username: 'historial.admin',
  active: true,
  roles: ['admin'],
  permissions: ['invoices.view', 'invoices.void', 'receipts.view', 'receipts.reprint', 'receipts.reprint_any'],
  must_change_password: false,
};

const baseInvoice = {
  id: 1,
  invoice_number: 'A-0000',
  patient_name: 'Paciente',
  subtotal: '100.00',
  tax_amount: '15.00',
  discount_amount: '0.00',
  total: '115.00',
  paid_amount: '0.00',
  balance_due: '115.00',
  status: 'issued',
  payment_status: 'pending',
  issued_at: '2026-07-02T09:30:00-06:00',
  void_reason: null,
  voided_at: null,
  reversed_at: null,
  user_id: invoiceUser.id,
  cash_register_session_id: 77,
  issuer: { id: invoiceUser.id, name: invoiceUser.name, username: invoiceUser.username },
  voided_by: null,
  items: [],
  payments: [],
  institutional_receipt: null,
};

const issuedInvoice = invoiceFixture({
  id: 501,
  invoice_number: 'A-0001',
  patient_name: 'Maria Lopez',
  status: 'issued',
  total: '250.00',
  balance_due: '250.00',
});

const paidInvoice = invoiceFixture({
  id: 502,
  invoice_number: 'A-0002',
  patient_name: 'Carlos Rivera',
  status: 'paid',
  total: '180.00',
  paid_amount: '180.00',
  balance_due: '0.00',
  institutional_receipt: {
    id: 700,
    receipt_number_full: 'REC-00000070',
    status: 'issued',
    issued_at: '2026-07-02T09:45:00-06:00',
    reprint_count: 1,
    has_print_events: true,
    print_events_count: 1,
  },
});

test.describe('Invoice history - critical mocked e2e', () => {
  test('uses row action menu and requires a reason before voiding an invoice', async ({ page }) => {
    let voidPayload: Record<string, unknown> | null = null;
    await installInvoiceHistoryMocks(page, {
      onVoid: (payload) => {
        voidPayload = payload;
      },
    });

    await page.goto('/invoices');

    await expect(page.getByRole('heading', { level: 1, name: /historial de facturas/i })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /2 registros en total/i })).toBeVisible();
    await expect(page.getByRole('row', { name: /A-0001.*Maria Lopez/i })).toBeVisible();
    await expect(page.getByRole('row', { name: /A-0002.*Carlos Rivera/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^anular factura$/i })).toHaveCount(0);

    await page.getByLabel(/paciente/i).fill('Maria');
    await page.getByRole('button', { name: /buscar|aplicar filtros/i }).click();
    await expect(page.getByRole('row', { name: /A-0001.*Maria Lopez/i })).toBeVisible();
    await expect(page.getByRole('row', { name: /Carlos Rivera/i })).toHaveCount(0);

    await page.getByRole('button', { name: /acciones de la factura A-0001/i }).click();
    await expect(page.getByRole('menuitem', { name: /ver recibo/i })).toBeVisible();
    await page.getByRole('menuitem', { name: /anular factura/i }).click();

    const dialog = page.getByRole('alertdialog', { name: /anular factura A-0001/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/paciente.*maria lopez/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /anular factura/i })).toBeDisabled();
    await expect.poll(() => voidPayload).toBeNull();

    await dialog.getByLabel(/motivo de anulaci.n/i).fill('Error');
    await expect(dialog.getByRole('button', { name: /anular factura/i })).toBeEnabled();
    await dialog.getByRole('button', { name: /anular factura/i }).click();

    await expect.poll(() => voidPayload).not.toBeNull();
    expect(voidPayload).toMatchObject({ reason: 'Error' });
    await expect(page.getByRole('alertdialog', { name: /anular factura A-0001/i })).toHaveCount(0);
  });
});

async function installInvoiceHistoryMocks(
  page: Page,
  options: { onVoid?: (payload: Record<string, unknown>) => void } = {},
) {
  let invoices = [issuedInvoice, paidInvoice];

  await installCommonMocks(page, invoiceUser);
  await page.route(/\/api\/invoices(?:\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    const patient = url.searchParams.get('patient')?.toLowerCase() ?? '';
    const filtered = patient
      ? invoices.filter((invoice) => invoice.patient_name.toLowerCase().includes(patient))
      : invoices;

    return json(route, {
      data: filtered,
      meta: {
        current_page: 1,
        from: filtered.length ? 1 : null,
        last_page: 1,
        path: '/api/invoices',
        per_page: 10,
        to: filtered.length,
        total: filtered.length,
      },
    });
  });
  await page.route(/\/api\/invoices\/\d+\/void(?:[/?]|$)/, (route) => {
    const payload = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
    options.onVoid?.(payload);
    const voided = { ...issuedInvoice, status: 'void', void_reason: String(payload.reason), voided_at: '2026-07-02T10:15:00-06:00' };
    invoices = [voided, paidInvoice];

    return json(route, { data: voided });
  });
  await page.route(/\/api\/invoices\/\d+\/receipt(?:[/?]|$)/, (route) => json(route, { data: receiptFixture() }));
  await page.route(/\/api\/invoices\/\d+(?:\?.*)?$/, (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/').at(-1));
    return json(route, { data: invoices.find((invoice) => invoice.id === id) ?? issuedInvoice });
  });
  await page.route(/\/api\/institutional-receipts\/\d+\/pdf(?:[/?]|$)/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/pdf',
    body: '%PDF-1.4 mocked',
  }));
}

function invoiceFixture(overrides: Partial<typeof baseInvoice> = {}) {
  return {
    ...baseInvoice,
    ...overrides,
  };
}

function receiptFixture() {
  return {
    invoice_number: issuedInvoice.invoice_number,
    patient_name: issuedInvoice.patient_name,
    issued_at: issuedInvoice.issued_at,
    subtotal: issuedInvoice.subtotal,
    tax_amount: issuedInvoice.tax_amount,
    total: issuedInvoice.total,
    paid_amount: issuedInvoice.paid_amount,
    balance_due: issuedInvoice.balance_due,
    width: 'half_letter',
    items: [],
    payments: [],
    hospital: {
      name: 'Hospital San Isidro',
      rtn: '08011999000001',
      address: 'Tocoa, Colon',
    },
  };
}

async function installCommonMocks(page: Page, sessionUser: typeof invoiceUser) {
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/auth/session', (route) => json(route, { data: sessionUser }));
  await page.route('**/api/settings/branding', (route) => json(route, {
    data: {
      hospital_name: 'Hospital San Isidro',
      primary_color: 'indigo',
      slogan: 'Sistema LAN',
      government_line: null,
      secretariat_line: null,
      receipt_location: 'Tocoa',
    },
  }));
  await page.route('**/api/settings/logo', (route) => route.fulfill({ status: 404, body: '' }));
  await page.route('**/api/system/health', (route) => json(route, { ok: true }));
  await page.route('**/api/system/echo-config', (route) => json(route, {
    data: {
      enabled: false,
      broadcaster: 'log',
      key: null,
      ws_host: null,
      ws_port: null,
      force_tls: false,
    },
  }));
  await page.route('**/api/system/status-summary', (route) => json(route, {
    data: {
      app: { env: 'local', debug: false },
      database: { connected: true },
      queue: { failed_jobs_count: 0 },
      backups: { last_success_at: null },
    },
  }));
  await page.route(/\/api\/cash-sessions\/current(?:[/?]|$)/, (route) => json(route, { data: null }));
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
