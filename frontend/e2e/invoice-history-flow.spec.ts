import { expect, test, type Page, type Route } from '@playwright/test';

const invoiceUser = {
  id: 81,
  name: 'Historial Admin',
  email: 'historial@hospital.local',
  username: 'historial.admin',
  active: true,
  roles: ['admin'],
  permissions: ['invoices.view', 'invoices.void', 'invoices.operate_any', 'receipts.view', 'receipts.reprint', 'receipts.reprint_any'],
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
  cash_register_session_id: null,
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
  test('keeps AG Grid, column menu, DatePicker and Drawer keyboard behavior real', async ({ page }) => {
    await installInvoiceHistoryMocks(page);
    await page.goto('/invoices');

    const columnsButton = page.getByRole('button', { name: /configurar columnas de facturas/i });
    await columnsButton.click();
    const statusColumnItem = page.getByRole('menuitem', { name: /^estado$/i });
    await expect(statusColumnItem).toBeVisible();
    await statusColumnItem.click();
    await expect(page.getByRole('columnheader', { name: /^estado$/i })).toHaveCount(0);

    await page.getByRole('button', { name: /filtros avanzados/i }).click();
    await page.getByLabel(/^desde$/i).click();
    const firstOfJuly = page.locator('[title="2026-07-01"]');
    await expect(firstOfJuly).toBeVisible();
    await firstOfJuly.click();
    await expect(page.getByLabel(/^desde$/i)).toHaveValue('01/07/2026');

    const detailTrigger = page.getByRole('button', { name: /ver detalle de la factura A-0001/i });
    await detailTrigger.click();
    const drawer = page.getByRole('dialog', { name: /factura A-0001/i });
    await expect(drawer).toBeVisible();

    const voidTrigger = drawer.getByRole('button', { name: /anular factura/i });
    await voidTrigger.click();
    const voidDialog = page.getByRole('dialog', { name: /anular factura A-0001/i });
    await expect(voidDialog).toBeVisible();
    await voidDialog.getByRole('button', { name: /^cancelar$/i }).click();
    await expect(drawer).toBeVisible();
    await expect(voidTrigger).toBeFocused();

    await drawer.getByRole('button', { name: /cerrar panel/i }).press('Escape');
    await expect(drawer).toHaveCount(0);
    await expect(detailTrigger).toBeFocused();
  });

  test('uses row action menu and requires a reason before voiding an invoice', async ({ page }) => {
    let voidPayload: Record<string, unknown> | null = null;
    await installInvoiceHistoryMocks(page, {
      onVoid: (payload) => {
        voidPayload = payload;
      },
    });

    await page.goto('/invoices');

    await expect(page.getByRole('heading', { level: 1, name: /historial de facturas/i })).toBeVisible();
    await expect(page.getByText(/2 registros en total/i)).toBeVisible();
    await expect(page.getByRole('row', { name: /A-0001.*Maria Lopez/i })).toBeVisible();
    await expect(page.getByRole('row', { name: /A-0002.*Carlos Rivera/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^anular factura$/i })).toHaveCount(0);

    await page.getByLabel(/paciente/i).fill('Maria');
    await page.getByRole('button', { name: /buscar|aplicar filtros/i }).click();
    await expect(page.getByRole('row', { name: /A-0001.*Maria Lopez/i })).toBeVisible();
    await expect(page.getByRole('row', { name: /Carlos Rivera/i })).toHaveCount(0);

    await page.getByRole('button', { name: /acciones de la factura A-0001/i }).click();
    await expect(page.getByRole('menuitem', { name: /ver recibo|reimprimir/i })).toHaveCount(0);
    const voidItem = page.getByRole('menuitem', { name: /anular factura/i });
    await expect(voidItem).toBeVisible();
    await voidItem.click({ force: true });

    const dialog = page.getByRole('dialog', { name: /anular factura A-0001/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/paciente.*maria lopez/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /anular factura/i })).toBeDisabled();
    await expect.poll(() => voidPayload).toBeNull();

    await dialog.getByLabel(/motivo de anulaci.n/i).fill('Error');
    await expect(dialog.getByRole('button', { name: /anular factura/i })).toBeEnabled();
    await dialog.getByRole('button', { name: /anular factura/i }).click();

    await expect.poll(() => voidPayload).not.toBeNull();
    expect(voidPayload).toMatchObject({ reason: 'Error' });
    await expect(page.getByRole('dialog', { name: /anular factura A-0001/i })).toHaveCount(0);
  });

  test('reprints an institutional receipt from history without legacy receipt fallback', async ({ page }) => {
    let institutionalPrintEventPayload: Record<string, unknown> | null = null;
    let institutionalPrintEventIdempotencyKey: string | null = null;
    let institutionalPdfRequests = 0;
    let legacyReceiptRequests = 0;
    let legacyReprintRequests = 0;

    await installInvoiceHistoryMocks(page, {
      onInstitutionalPrintEvent: (payload, idempotencyKey) => {
        institutionalPrintEventPayload = payload;
        institutionalPrintEventIdempotencyKey = idempotencyKey;
      },
      onInstitutionalPdf: () => {
        institutionalPdfRequests += 1;
      },
      onLegacyReceipt: () => {
        legacyReceiptRequests += 1;
      },
      onLegacyReprint: () => {
        legacyReprintRequests += 1;
      },
    });

    await page.goto('/invoices');

    await expect(page.getByRole('row', { name: /A-0002.*Carlos Rivera/i })).toBeVisible();
    await page.getByRole('button', { name: /acciones de la factura A-0002/i }).click();
    await page.getByRole('menuitem', { name: /reimprimir pdf/i }).click();

    const reprintDialog = page.getByRole('dialog', { name: /reimprimir A-0002/i });
    await expect(reprintDialog).toBeVisible();
    await reprintDialog.getByRole('textbox', { name: /^motivo \*$/i }).fill('Reimpresión solicitada desde historial.');
    await reprintDialog.getByRole('button', { name: /^reimprimir$/i }).click();

    await expect.poll(() => institutionalPrintEventPayload).toMatchObject({
      reason: 'Reimpresión solicitada desde historial.',
    });
    expect(institutionalPrintEventIdempotencyKey).toMatch(/\S/);
    await expect.poll(() => institutionalPdfRequests).toBe(1);
    expect(legacyReceiptRequests).toBe(0);
    expect(legacyReprintRequests).toBe(0);
  });
});

async function installInvoiceHistoryMocks(
  page: Page,
  options: {
    onInstitutionalPrintEvent?: (payload: Record<string, unknown>, idempotencyKey: string | null) => void;
    onInstitutionalPdf?: () => void;
    onLegacyReceipt?: () => void;
    onLegacyReprint?: () => void;
    onVoid?: (payload: Record<string, unknown>) => void;
  } = {},
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
  await page.route(/\/api\/invoices\/\d+\/reprint(?:[/?]|$)/, (route) => {
    options.onLegacyReprint?.();

    return json(route, { data: { receipt: receiptFixture() } });
  });
  await page.route(/\/api\/invoices\/\d+\/receipt(?:[/?]|$)/, (route) => {
    options.onLegacyReceipt?.();

    return json(route, { data: receiptFixture() });
  });
  await page.route(/\/api\/invoices\/\d+(?:\?.*)?$/, (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/').at(-1));
    return json(route, { data: invoices.find((invoice) => invoice.id === id) ?? issuedInvoice });
  });
  await page.route(/\/api\/institutional-receipts\/\d+\/print-events(?:[/?]|$)/, (route) => {
    const payload = route.request().postData()
      ? JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>
      : {};

    options.onInstitutionalPrintEvent?.(payload, route.request().headers()['idempotency-key'] ?? null);

    return json(route, { data: { receipt: paidInvoice.institutional_receipt } });
  });
  await page.route(/\/api\/institutional-receipts\/\d+\/pdf(?:[/?]|$)/, (route) => {
    options.onInstitutionalPdf?.();

    return route.fulfill({
      status: 200,
      contentType: 'application/pdf',
      body: '%PDF-1.4 mocked',
    });
  });
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
  await page.route('**/api/auth/me', (route) => json(route, { data: sessionUser }));
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
