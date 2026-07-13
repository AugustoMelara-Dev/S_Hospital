import { expect, test, type Page, type Route } from '@playwright/test';

const invoiceUser = {
  id: 71,
  name: 'Cajera Facturacion',
  email: 'facturacion@hospital.local',
  username: 'facturacion.caja',
  active: true,
  roles: ['cashier'],
  permissions: [
    'catalog.view',
    'cash.view',
    'invoices.create',
    'payments.create',
    'receipts.view',
    'patients.mark_dialysis_prescription',
  ],
  must_change_password: false,
};

const category = { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 };
const area = { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true };

const glucoseService = {
  id: 11,
  category_id: category.id,
  area_id: area.id,
  name: 'Glucosa basal',
  slug: 'glucosa-basal',
  aliases: null,
  scan_code: 'GLU-001',
  barcode: null,
  qr_code: null,
  description: null,
  internal_code: null,
  price: '15.00',
  taxable: true,
  active: true,
  visible_in_billing: true,
  is_billable: true,
  special_rule_code: null,
  category,
  area,
};

const openCashSession = {
  id: 7,
  user_id: invoiceUser.id,
  user: { id: invoiceUser.id, name: invoiceUser.name, username: invoiceUser.username },
  opening_amount: '500.00',
  closing_amount: null,
  expected_amount: '500.00',
  expected_cash_amount: '500.00',
  difference_amount: null,
  status: 'open',
  opening_notes: null,
  closing_notes: null,
  opened_at: '2026-07-02T08:00:00-06:00',
  closed_at: null,
  payments_count: 0,
  payments_total: '0.00',
  pending_invoice_count: 0,
  pending_amount: '0.00',
  payments_by_method: { cash: '0.00', transfer: '0.00', card: '0.00', other: '0.00' },
};

test.describe('New invoice - critical mocked e2e', () => {
  test('emits an invoice from an open cash session and registers payment payload', async ({ page }) => {
    let invoicePayload: unknown = null;
    let paymentPayload: unknown = null;
    let receiptPdfRequests = 0;

    await installNewInvoiceMocks(page, {
      onCreateInvoice: (payload) => {
        invoicePayload = payload;
      },
      onRegisterPayment: (payload) => {
        paymentPayload = payload;
      },
      onReceiptPdf: () => {
        receiptPdfRequests += 1;
      },
    });

    await page.goto('/billing/new');

    await expect(page.getByRole('heading', { level: 1, name: /nueva factura/i })).toBeVisible();
    await expect(page.getByText(/caja #7.*abierta/i)).toBeVisible();
    await expect(page.getByLabel(/nombre del paciente/i)).toBeEditable();
    await expect(page.getByRole('button', { name: /continuar a servicios/i })).toBeVisible();
    await page.getByRole('button', { name: /continuar a servicios/i }).click();
    await expect(page.getByRole('alert')).toContainText(/ingrese el nombre del paciente para continuar/i);

    await page.getByLabel(/nombre del paciente/i).fill('Maria Lopez');
    await page.getByRole('button', { name: /continuar a servicios/i }).click();
    await page.getByLabel(/buscar por nombre/i).fill('glucosa');
    await page.getByRole('button', { name: /agregar glucosa basal/i }).click();
    await page.getByRole('button', { name: /continuar a cuenta/i }).click();

    await expect(page.getByRole('list', { name: /servicios agregados/i })).toContainText('Glucosa basal');
    await expect(page.getByRole('button', { name: /^emitir y cobrar$/i })).toBeEnabled();

    await page.getByRole('button', { name: /^emitir y cobrar$/i }).click();
    const confirmDialog = page.getByRole('dialog', { name: /confirmar emisi/i });
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog).toContainText('Maria Lopez');
    await expect(confirmDialog).toContainText('#7');
    await confirmDialog.getByRole('button', { name: /emitir y abrir cobro/i }).click();

    await expect.poll(() => invoicePayload).toEqual({
      patient_name: 'Maria Lopez',
      dialysis_prescription: false,
      items: [{ service_id: glucoseService.id, quantity: '1' }],
    });

    const paymentDialog = page.getByRole('dialog', { name: /registrar pago/i });
    await expect(paymentDialog).toBeVisible();
    await expect(paymentDialog).toContainText('000-001-01-00000077');
    await expect(paymentDialog).toContainText('Maria Lopez');

    const paymentAmountInput = page.getByLabel(/monto recibido/i);
    await expect(paymentAmountInput).toHaveValue('17.25');
    await page.getByRole('button', { name: /confirmar cobro de .* e imprimir/i }).click();

    await expect.poll(() => paymentPayload).toEqual({
      cash_session_id: openCashSession.id,
      method: 'cash',
      amount: '17.25',
      reference: null,
    });
    await expect.poll(() => receiptPdfRequests).toBe(1);
    await expect(page.getByRole('dialog', { name: /factura pagada/i })).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: /REC-A-00000077/i })).toBeVisible();
  });

  test('keeps a completed payment recoverable when receipt issuance fails', async ({ page }) => {
    let paymentRequests = 0;
    let receiptPdfRequests = 0;

    await installNewInvoiceMocks(page, {
      receiptOutcome: 'recovery_required',
      onRegisterPayment: () => {
        paymentRequests += 1;
      },
      onReceiptPdf: () => {
        receiptPdfRequests += 1;
      },
    });

    await page.goto('/billing/new');
    await page.getByLabel(/nombre del paciente/i).fill('Maria Lopez');
    await page.getByRole('button', { name: /continuar a servicios/i }).click();
    await page.getByLabel(/buscar por nombre/i).fill('glucosa');
    await page.getByRole('button', { name: /agregar glucosa basal/i }).click();
    await page.getByRole('button', { name: /continuar a cuenta/i }).click();
    await page.getByRole('button', { name: /^emitir y cobrar$/i }).click();
    await page.getByRole('dialog', { name: /confirmar emisi/i })
      .getByRole('button', { name: /emitir y abrir cobro/i })
      .click();
    await page.getByRole('dialog', { name: /registrar pago/i })
      .getByRole('button', { name: /confirmar cobro de .* e imprimir/i })
      .click();

    await expect(page.getByRole('dialog', { name: /factura pagada/i })).toBeVisible();
    await expect(page.getByText(/revise la factura en historial/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /resolver recibo en historial/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /imprimir recibo institucional/i })).toHaveCount(0);
    await expect.poll(() => paymentRequests).toBe(1);
    await expect.poll(() => receiptPdfRequests).toBe(0);
  });
});

async function installNewInvoiceMocks(
  page: Page,
  options: {
    onCreateInvoice?: (payload: unknown) => void;
    onRegisterPayment?: (payload: unknown) => void;
    onReceiptPdf?: () => void;
    receiptOutcome?: 'issued' | 'recovery_required';
  } = {},
) {
  await page.addInitScript(() => {
    window.open = () => null;
  });
  await installCommonMocks(page);
  await page.route(/\/api\/settings\/operational(?:[/?]|$)/, (route) => json(route, {
    data: {
      scanner_enabled: true,
      partial_payments_enabled: false,
      default_tax_rate: '15.00',
      receipt_paper_size: 'half_letter',
    },
  }));
  await page.route(/\/api\/categories(?:[/?]|$)/, (route) => json(route, { data: [category] }));
  await page.route(/\/api\/areas(?:[/?]|$)/, (route) => json(route, { data: [area] }));
  await page.route(/\/api\/service-areas(?:[/?]|$)/, (route) => json(route, { data: [area] }));
  await page.route(/\/api\/services(?:[/?]|$)/, (route) => {
    const url = new URL(route.request().url());
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    const code = url.searchParams.get('code');
    const services = search || code ? [glucoseService] : [glucoseService];
    return json(route, {
      data: services,
      meta: { current_page: 1, from: 1, last_page: 1, path: '/api/services', per_page: 24, to: 1, total: 1 },
    });
  });
  await page.route(/\/api\/cash-sessions\/current(?:[/?]|$)/, (route) => json(route, { data: openCashSession }));
  await page.route(/\/api\/invoices(?:\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      const payload = await route.request().postDataJSON();
      options.onCreateInvoice?.(payload);
      return json(route, { data: issuedInvoice(payload.patient_name) }, 201);
    }

    return json(route, { data: [], meta: { current_page: 1, per_page: 10, total: 0 } });
  });
  await page.route(/\/api\/invoices\/77\/payments(?:[/?]|$)/, async (route) => {
    const payload = await route.request().postDataJSON();
    const receiptIssued = options.receiptOutcome !== 'recovery_required';
    options.onRegisterPayment?.(payload);
    return json(route, {
      data: {
        payment: {
          id: 90,
          invoice_id: 77,
          cash_session_id: openCashSession.id,
          user_id: invoiceUser.id,
          method: payload.method,
          amount: payload.amount,
          reference: payload.reference,
          status: 'posted',
          paid_at: '2026-07-02T08:15:00-06:00',
        },
        invoice: { ...issuedInvoice('Maria Lopez'), paid_amount: '17.25', balance_due: '0.00', status: 'paid' },
        institutional_receipt: receiptIssued ? {
          id: 77,
          invoice_id: 77,
          payment_id: 90,
          cash_session_id: openCashSession.id,
          series_id: 1,
          receipt_number: 77,
          receipt_number_full: 'REC-A-00000077',
          status: 'issued',
          amount: '17.25',
          amount_cents: 1725,
          issued_at: '2026-07-02T08:15:00-06:00',
          issued_by: invoiceUser.id,
          payer_name: 'Maria Lopez',
          concept: 'Pago de factura 000-001-01-00000077',
          amount_words: 'DIECISIETE LEMPIRAS CON 25/100',
          template_code: 'institutional_classic',
          print_profile_code: 'media_carta_horizontal',
          copy_mode: 'original_only',
          reprint_count: 0,
          voided_by: null,
          voided_at: null,
          void_reason: null,
        } : null,
        institutional_receipt_error: receiptIssued ? null : 'No hay una serie activa para recibos institucionales.',
        receipt_outcome: receiptIssued ? 'issued' : 'recovery_required',
      },
    }, 201);
  });
  await page.route(/\/api\/institutional-receipts\/77\/print-events(?:[/?]|$)/, (route) => json(route, {
    data: {
      id: 77,
      institutional_receipt_id: 77,
      reason: null,
      created_at: '2026-07-02T08:15:02-06:00',
    },
  }, 201));
  await page.route(/\/api\/institutional-receipts\/77\/pdf(?:[/?]|$)/, (route) => {
    options.onReceiptPdf?.();
    return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-receipt' });
  });
}

function issuedInvoice(patientName: string) {
  return {
    id: 77,
    invoice_number: '000-001-01-00000077',
    patient_name: patientName,
    subtotal: '15.00',
    tax_amount: '2.25',
    discount_amount: '0.00',
    total: '17.25',
    paid_amount: '0.00',
    balance_due: '17.25',
    status: 'issued',
    issued_at: '2026-07-02T08:12:00-06:00',
    items: [{
      id: 1,
      service_id: glucoseService.id,
      service_name: glucoseService.name,
      category_id: category.id,
      category_name: category.name,
      area_id: area.id,
      area_name: area.name,
      quantity: '1.00',
      unit_price: '15.00',
      tax_rate: '15.00',
      tax_amount: '2.25',
      line_subtotal: '15.00',
      line_total: '17.25',
      special_rule_code: null,
      special_rule_applied: false,
      notes: null,
    }],
    issuer: { id: invoiceUser.id, name: invoiceUser.name, username: invoiceUser.username },
    cash_session: openCashSession,
  };
}

async function installCommonMocks(page: Page) {
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/auth/session', (route) => json(route, { data: invoiceUser }));
  await page.route('**/api/auth/me', (route) => json(route, { data: invoiceUser }));
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
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
