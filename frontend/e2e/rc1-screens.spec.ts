import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const SCREEN_DIR = path.resolve(
  process.env.E2E_CAPTURE_SCREENS_DIR ?? path.join(process.cwd(), 'test-results', 'rc1-screens'),
);
const PREFIX = 'rc-e2e-2026-06-09';
const CAPTURE_PATH = (name: string) => path.join(SCREEN_DIR, `${PREFIX}-${name}.png`);

const cashierUser = {
  id: 2,
  name: 'Cajero Validacion',
  email: 'cajero.validacion@hospital-san-isidro.local',
  username: 'cajero.validacion',
  active: true,
  roles: ['cajero'],
  permissions: [
    'catalog.view',
    'cash.view',
    'cash.open',
    'cash.close',
    'invoices.view',
    'invoices.create',
    'payments.create',
    'payments.view',
    'receipts.view',
    'receipts.reprint',
  ],
  must_change_password: false,
};

const adminUser = {
  id: 1,
  name: 'Administrador Validacion',
  email: 'admin.validacion@hospital-san-isidro.local',
  username: 'admin.validacion',
  active: true,
  roles: ['admin'],
  permissions: [
    'settings.fiscal.view',
    'settings.fiscal.update',
    'catalog.view',
    'catalog.manage',
    'cash.view',
    'cash.open',
    'cash.close',
    'cash.close_any',
    'invoices.view',
    'invoices.create',
    'invoices.void',
    'payments.create',
    'payments.view',
    'receipts.view',
    'receipts.reprint',
    'receipts.reprint_any',
    'reports.view',
    'reports.managerial.view',
    'reports.cash_session.view',
    'reports.export',
    'backups.view',
    'backups.create',
    'backups.download',
  ],
  must_change_password: false,
};

const services = [
  {
    id: 10,
    category_id: 1,
    name: 'Eritropoyetina',
    slug: 'eritropoyetina',
    price: '25.00',
    taxable: false,
    active: true,
    special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
    category: { id: 1, name: 'Medicamentos', slug: 'medicamentos', active: true, sort_order: 1 },
  },
  {
    id: 11,
    category_id: 2,
    name: 'Glucosa',
    slug: 'glucosa',
    price: '15.00',
    taxable: true,
    active: true,
    special_rule_code: null,
    category: { id: 2, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 2 },
  },
];

const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const operationalDate = `${year}-${month}-${day}`;
const operationalIssuedAt = `${operationalDate}T08:00:00-06:00`;
const operationalPaidAt = `${operationalDate}T08:03:00-06:00`;

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function captureScreen(page: Page, name: string) {
  await mkdir(SCREEN_DIR, { recursive: true });
  await page.screenshot({ path: CAPTURE_PATH(name), fullPage: true });
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((t) => {
    localStorage.setItem('hospital-billing-theme', t);
    document.documentElement.classList.toggle('dark', t === 'dark');
  }, theme);
}

function receiptFor(invoice: Record<string, unknown>, width: string) {
  return {
    width,
    hospital: { name: 'Hospital San Isidro', rtn: '08011999123456' },
    fiscal: {
      cai: 'VALIDACION-CAI',
      authorized_range: '000-001-01-00000001 a 000-001-01-99999999',
      valid_until: '2027-06-09',
    },
    invoice: {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      issued_at: invoice.issued_at,
      cashier: 'Cajero Validacion',
      patient_name: invoice.patient_name,
      subtotal: invoice.subtotal,
      tax_amount: invoice.tax_amount,
      discount_amount: invoice.discount_amount,
      total: invoice.total,
      paid_amount: invoice.paid_amount,
      balance_due: invoice.balance_due,
      status: invoice.status,
    },
    items: invoice.items,
    payments: [{
      id: 50,
      method: 'cash',
      amount: invoice.total,
      reference: null,
      paid_at: operationalPaidAt,
      cashier: 'Cajero Validacion',
    }],
  };
}

async function installApiMocks(page: Page) {
  let currentUser = cashierUser;
  let currentCashSession: Record<string, unknown> | null = null;
  let isLogged = false;
  let invoiceCounter = 1;
  const invoices: Record<number, Record<string, unknown>> = {};
  const backupLogs: Record<string, unknown>[] = [];

  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204 }));
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/health', (route) => json(route, { status: 'ok' }));
  await page.route('**/api/system/client-errors', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/system/echo-config', (route) => json(route, {
    data: { enabled: false, driver: 'log' },
  }));

  await page.route('**/api/public/branding', (route) => json(route, {
    data: { hospital_name: 'Hospital San Isidro', logo_url: null },
  }));

  await page.route('**/api/settings/fiscal', (route) => json(route, {
    data: {
      primary_color: 'indigo',
      name: 'Hospital San Isidro',
      hospital_name: 'Hospital San Isidro',
      rtn: '08011999123456',
      address: 'Tocoa, Colon',
      phone: '2222-2222',
      email: 'contacto@hospital-san-isidro.local',
      scanner_enabled: false,
      partial_payments_enabled: false,
      receipt_paper_size: 'half_letter',
      receipt_header: 'HOSPITAL SAN ISIDRO',
      receipt_footer: 'Gracias por su pago',
      paper_size: 'half_letter',
      printer_profile: 'thermal_80mm',
      logo_url: null,
    },
  }));
  await page.route('**/api/settings/operational', (route) => json(route, {
    data: {
      scanner_enabled: false,
      partial_payments_enabled: false,
      receipt_paper_size: 'half_letter',
      default_payment_method: 'cash',
      require_cash_session: true,
    },
  }));
  await page.route('**/api/fiscal-sequences**', (route) => json(route, {
    data: [
      {
        id: 1,
        document_type: 'invoice',
        prefix: '000-001-01',
        min_number: 1,
        max_number: 99999999,
        current_number: 1,
        cai: 'VALIDACION-CAI',
        valid_until: '2027-06-09',
        active: true,
      },
    ],
  }));

  await page.route('**/api/settings/branding', (route) => json(route, {
    data: {
      hospital_name: 'Hospital San Isidro',
      primary_color: 'indigo',
      slogan: 'Sistema de Caja Hospitalaria',
      government_line: 'Gobierno de Honduras',
      secretariat_line: 'Secretaría de Salud Pública',
      receipt_location: 'Tocoa, Colon',
    },
  }));

  await page.route('**/api/settings/logo', (route) => json(route, { logo_url: null }));

  await page.route('**/api/auth/login', async (route) => {
    let payload: { login?: string } = {};
    try {
      payload = route.request().postDataJSON() as { login?: string };
    } catch {
      payload = {};
    }
    currentUser = payload.login === 'admin.validacion' ? adminUser : cashierUser;
    isLogged = true;
    return json(route, { data: currentUser });
  });

  await page.route('**/api/auth/session', (route) => {
    if (isLogged) return json(route, { data: currentUser });
    return route.fulfill({ status: 401, body: JSON.stringify({ message: 'Unauthenticated.' }) });
  });
  await page.route('**/api/auth/me', (route) => {
    if (isLogged) return json(route, { data: currentUser });
    return route.fulfill({ status: 401, body: JSON.stringify({ message: 'Unauthenticated.' }) });
  });
  await page.route('**/api/auth/logout', (route) => {
    currentUser = cashierUser;
    isLogged = false;
    return json(route, { ok: true });
  });

  await page.route(/\/api\/categories(\?.*)?$/, (route) => json(route, {
    data: [
      { id: 1, name: 'Medicamentos', slug: 'medicamentos', active: true, sort_order: 1 },
      { id: 2, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 2 },
    ],
  }));
  await page.route(/\/api\/areas(\?.*)?$/, (route) => json(route, { data: [] }));
  await page.route(/\/api\/service-areas(\?.*)?$/, (route) => json(route, { data: [] }));
  await page.route(/\/api\/services(\?.*)?$/, (route) => json(route, {
    data: services,
    meta: { total: services.length },
  }));

  await page.route('**/api/cash-sessions/current', (route) => json(route, { data: currentCashSession }));
  await page.route('**/api/cash-sessions/open', (route) => {
    if (!currentUser) return json(route, { message: 'Unauthenticated.' }, 401);
    currentCashSession = {
      id: 7,
      user_id: currentUser.id,
      opening_amount: '500.00',
      closing_amount: null,
      expected_amount: null,
      difference_amount: null,
      status: 'open',
      opening_notes: null,
      closing_notes: null,
      opened_at: `${operationalDate}T08:00:00-06:00`,
      closed_at: null,
    };
    return json(route, { data: currentCashSession }, 201);
  });
  await page.route('**/api/cash-sessions/*/close', (route) => {
    if (currentCashSession) {
      currentCashSession = {
        ...currentCashSession,
        closing_amount: '525.00',
        expected_amount: '525.00',
        difference_amount: '0.00',
        status: 'closed',
        closing_notes: 'Cierre de prueba RC1',
        closed_at: `${operationalDate}T17:00:00-06:00`,
      };
    }
    return json(route, { data: currentCashSession }, 200);
  });

  await page.route(/\/api\/invoices(\/\d+)?(\?.*)?$/, async (route) => {
    const url = new URL(route.request().url());
    const detailMatch = url.pathname.match(/\/api\/invoices\/(\d+)$/);
    if (route.request().method() === 'GET' && detailMatch) {
      return json(route, { data: invoices[Number(detailMatch[1])] });
    }
    if (route.request().method() === 'POST') {
      const payload = await route.request().postDataJSON();
      const hasDialysis = payload.items?.some((item: { dialysis_prescription?: boolean }) => item.dialysis_prescription);
      const id = 100 + invoiceCounter;
      const invoice = {
        id,
        invoice_number: `000-001-01-${String(invoiceCounter).padStart(8, '0')}`,
        patient_name: payload.patient_name,
        subtotal: hasDialysis ? '0.00' : '25.00',
        tax_amount: '0.00',
        discount_amount: '0.00',
        total: hasDialysis ? '0.00' : '25.00',
        paid_amount: hasDialysis ? '0.00' : '0.00',
        balance_due: hasDialysis ? '0.00' : '25.00',
        status: hasDialysis ? 'paid' : 'issued',
        issued_at: operationalIssuedAt,
        items: [{
          id: 1,
          service_id: 10,
          service_name: 'Eritropoyetina',
          category_id: 1,
          category_name: 'Medicamentos',
          quantity: '1.00',
          unit_price: hasDialysis ? '0.00' : '25.00',
          tax_rate: '0.00',
          tax_amount: '0.00',
          line_subtotal: hasDialysis ? '0.00' : '25.00',
          line_total: hasDialysis ? '0.00' : '25.00',
          special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
          special_rule_applied: hasDialysis,
          notes: null,
        }],
        issuer: currentUser ?? cashierUser,
      };
      invoices[id] = invoice;
      invoiceCounter += 1;
      return json(route, { data: invoice }, 201);
    }
    return json(route, {
      data: Object.values(invoices).sort((a: Record<string, unknown>, b: Record<string, unknown>) => Number(b.id) - Number(a.id)),
      meta: { current_page: 1, per_page: 10, total: Object.keys(invoices).length },
    });
  });

  await page.route('**/api/invoices/*/payments', async (route) => {
    const invoiceId = Number(route.request().url().match(/invoices\/(\d+)\/payments/)?.[1]);
    const invoice = invoices[invoiceId];
    invoice.paid_amount = invoice.total;
    invoice.balance_due = '0.00';
    invoice.status = 'paid';
    return json(route, {
      data: {
        payment: {
          id: 50,
          invoice_id: invoiceId,
          cash_session_id: 7,
          user_id: currentUser.id,
          method: 'cash',
          amount: invoice.total,
          reference: null,
          status: 'posted',
          paid_at: operationalPaidAt,
        },
        invoice,
      },
    }, 201);
  });

  await page.route('**/api/invoices/*/receipt**', (route) => {
    const invoiceId = Number(route.request().url().match(/invoices\/(\d+)\/receipt/)?.[1]);
    const width = new URL(route.request().url()).searchParams.get('width') ?? 'half_letter';
    return json(route, { data: receiptFor(invoices[invoiceId], width) });
  });

  await page.route('**/api/invoices/*/reprint', (route) => {
    const invoiceId = Number(route.request().url().match(/invoices\/(\d+)\/reprint/)?.[1]);
    const width = new URL(route.request().url()).searchParams.get('width') ?? 'half_letter';
    return json(route, { data: { receipt: receiptFor(invoices[invoiceId], width) } });
  });

  await page.route('**/api/reports/cash-sessions/*', (route) => json(route, {
    data: {
      session: currentCashSession,
      payments: [
        { id: 50, method: 'cash', amount: '25.00', paid_at: operationalPaidAt, cashier: 'Cajero Validacion' },
      ],
      movements: [],
      expected_cash_amount: '525.00',
      cash_difference: '0.00',
      permissions: { can_close: true, can_view_any: false },
    },
  }));
  await page.route('**/api/reports/executive**', (route) => json(route, {
    data: {
      period: { from: operationalDate, to: operationalDate, timezone: 'America/Tegucigalpa', days: 1 },
      filters: { cash_session_id: null, user_id: null, category_id: null, area_id: null, method: null, status: null },
      comparison: {
        billed: { current: '25.00', previous: '0.00', delta_cents: 2500, delta_percentage: null },
        collected: { current: '25.00', previous: '0.00', delta_cents: 2500, delta_percentage: null },
        previous_period: { from: operationalDate, to: operationalDate },
      },
      summary: {
        billed_total: '25.00',
        collected_total: '25.00',
        collected_total_cents: 2500,
        pending_total: '0.00',
        voided_total: '0.00',
        reversed_total: '0.00',
        invoice_count: 1,
        receipt_count: 1,
        paid_count: 1,
        partial_count: 0,
        pending_count: 0,
        voided_count: 0,
        average_ticket: '25.00',
      },
      payment_methods: [
        { method: 'cash', label: 'Efectivo', amount: '25.00', count: 1, percentage: 100 },
        { method: 'transfer', label: 'Transferencia', amount: '0.00', count: 0, percentage: 0 },
        { method: 'card', label: 'Tarjeta', amount: '0.00', count: 0, percentage: 0 },
        { method: 'other', label: 'Otro', amount: '0.00', count: 0, percentage: 0 },
      ],
      daily_trend: [{ date: operationalDate, billed: '25.00', collected: '25.00', pending: '0.00', voided_count: 0, invoice_count: 1 }],
      services: {
        top_by_amount: [{ service: 'Eritropoyetina', category: 'Medicamentos', item_count: 1, quantity: '1.00', total: '25.00', collected: '25.00' }],
        top_by_quantity: [{ service: 'Eritropoyetina', category: 'Medicamentos', item_count: 1, quantity: '1.00', total: '25.00' }],
        by_category: [{ category: 'Medicamentos', quantity: '1.00', total: '25.00', collected: '25.00', item_count: 1 }],
        by_area: [{ area_id: null, area: 'Sin area', item_count: 1, quantity: '1.00', total: '25.00' }],
      },
      cashiers: [{
        user_id: currentUser.id,
        name: currentUser.name,
        username: currentUser.username,
        invoice_count: 1,
        payment_count: 1,
        collected: '25.00',
        cash: '25.00',
        transfer: '0.00',
        card: '0.00',
        other: '0.00',
        voided_count: 0,
        difference_total: '0.00',
      }],
      cash_sessions: [],
      pending_aging: {
        '0_7_days': { count: 0, amount: '0.00' },
        '8_30_days': { count: 0, amount: '0.00' },
        '31_plus_days': { count: 0, amount: '0.00' },
        items: [],
      },
      voids_and_reversals: [],
      audit_summary: { critical_events: 0, reprints: 1, fiscal_changes: 0, cash_differences: 0, backup_events: 1 },
    },
  }));

  await page.route('**/api/reports/daily**', (route) => json(route, {
    data: {
      date: operationalDate,
      total_billed: '25.00',
      total_collected: '25.00',
      invoice_count: 1,
      payment_count: 1,
      payments_by_method: { cash: '25.00', transfer: '0.00', card: '0.00', other: '0.00' },
      invoices_by_status: {
        issued: { count: 0, total: '0.00' },
        partial: { count: 0, total: '0.00' },
        paid: { count: 1, total: '25.00' },
        void: { count: 0, total: '0.00' },
      },
    },
  }));
  await page.route('**/api/reports/monthly**', (route) => json(route, {
    data: {
      month: '2026-06',
      date_from: '2026-06-01',
      date_to: '2026-06-30',
      total_billed: '25.00',
      total_collected: '25.00',
      total_pending: '0.00',
      total_partial: '0.00',
      total_voided: '0.00',
      invoice_count: 1,
      payment_count: 1,
      payments_by_method: { cash: '25.00', transfer: '0.00', card: '0.00', other: '0.00' },
      invoices_by_status: {
        issued: { count: 0, total: '0.00' },
        partial: { count: 0, total: '0.00' },
        paid: { count: 1, total: '25.00' },
        void: { count: 0, total: '0.00' },
      },
      daily_totals: [
        {
          date: operationalDate,
          total_billed: '25.00',
          total_collected: '25.00',
          total_pending: '0.00',
          total_partial: '0.00',
          total_voided: '0.00',
          invoice_count: 1,
          payment_count: 1,
        },
      ],
    },
  }));
  await page.route('**/api/reports/income**', (route) => json(route, {
    data: {
      date_from: operationalDate,
      date_to: operationalDate,
      cash_session_id: null,
      user_id: null,
      total_collected: '25.00',
      payments_by_method: { cash: '25.00', transfer: '0.00', card: '0.00', other: '0.00' },
      payment_count: 1,
      invoice_count: 1,
    },
  }));
  await page.route('**/api/reports/categories', (route) => json(route, {
    data: {
      date_from: operationalDate,
      date_to: operationalDate,
      categories: [{ category: 'Medicamentos', item_count: 1, quantity: '1.00', subtotal: '25.00', tax_amount: '0.00', total: '25.00' }],
    },
  }));
  await page.route('**/api/reports/services', (route) => json(route, {
    data: {
      date_from: operationalDate,
      date_to: operationalDate,
      services: [{ service: 'Eritropoyetina', item_count: 1, quantity: '1.00', subtotal: '25.00', tax_amount: '0.00', total: '25.00' }],
    },
  }));
  await page.route('**/api/reports/operations', (route) => json(route, {
    data: {
      date_from: operationalDate,
      date_to: operationalDate,
      voided_invoices: [],
      reprints: [],
      backups: [],
      summary: { voided_count: 0, reprint_count: 0, backup_count: 0 },
    },
  }));

  await page.route(/\/api\/backups(?:\?|$)/, async (route) => {
    if (route.request().method() === 'POST') {
      const backup = {
        id: 9,
        filename: 'hospital-backup-20260609-101500-test.sql',
        size_bytes: null,
        checksum_sha256: null,
        status: 'pending',
        type: 'manual',
        created_by: currentUser?.id ?? 1,
        completed_at: null,
        created_at: `${operationalDate}T10:15:00-06:00`,
        updated_at: `${operationalDate}T10:15:00-06:00`,
        creator: currentUser ?? cashierUser,
      };
      backupLogs.unshift(backup);
      return json(route, { data: backup }, 202);
    }
    const list = backupLogs.length > 0 ? backupLogs : [
      {
        id: 1,
        filename: 'hospital-2026-06-08-2300.sql.gz',
        created_at: '2026-06-08T23:00:00-06:00',
        size_bytes: 1048576,
        status: 'success',
        initiated_by: 'scheduler',
      },
      {
        id: 2,
        filename: 'hospital-2026-06-09-1100.sql.gz',
        created_at: `${operationalDate}T11:00:00-06:00`,
        size_bytes: 1572864,
        status: 'pending',
        initiated_by: 'admin.validacion',
      },
    ];
    return json(route, { data: list, meta: { current_page: 1, per_page: 15, total: list.length } });
  });

  await page.route('**/api/system/status', (route) => json(route, {
    data: {
      environment: { app_env: 'production', app_debug: false, app_url: 'http://127.0.0.1:5173' },
      database: { connection: 'mysql', is_mysql_family: true },
      network: { configured_host: '192.168.1.10', host_type: 'lan', lan_ready: true },
      backups: { pending_count: 1, last_success_at: '2026-06-08T23:00:00-06:00' },
      readiness: { state: 'PRODUCTION_CANDIDATE', production_ready: true, blockers: [] },
    },
  }));
}

async function loginAs(page: Page, username: string) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
  });
  await page.goto('/login');
  const loginInput = page.getByLabel(/usuario o correo/i);
  await loginInput.waitFor({ state: 'visible', timeout: 15_000 });
  await loginInput.fill(username);
  await page.getByLabel(/^contraseña$/i).fill('Password123!');
  await Promise.all([
    page.waitForResponse('**/api/auth/login'),
    page.getByRole('button', { name: /iniciar sesi.n/i }).click(),
  ]);
  await page.waitForResponse('**/api/cash-sessions/current', { timeout: 10_000 }).catch(() => {});
}

test.describe('RC1 cashier flow screens', () => {
  test('login + dashboard (light + dark)', async ({ page }) => {
    await installApiMocks(page);
    await page.context().clearCookies();
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
    });
    await page.goto('/login');
    const loginInput = page.getByLabel(/usuario o correo/i);
    await expect(loginInput).toBeVisible();
    await expect(page.getByLabel(/^contraseña$/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /iniciar sesi.n/i })).toBeVisible();
    await captureScreen(page, 'login-light');

    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await expect(loginInput).toBeVisible();
    await captureScreen(page, 'login-dark');
    await page.evaluate(() => document.documentElement.classList.remove('dark'));

    await loginInput.fill('cajero.validacion');
    await page.getByLabel(/^contraseña$/i).fill('Password123!');
    await Promise.all([
      page.waitForResponse('**/api/auth/login'),
      page.getByRole('button', { name: /iniciar sesi.n/i }).click(),
    ]);
    await setTheme(page, 'light');
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /centro de mando|inicio|dashboard/i })).toBeVisible();
    await page.waitForTimeout(500);
    await page.waitForTimeout(500);
    await captureScreen(page, 'dashboard-light');

    await setTheme(page, 'dark');
    await page.waitForTimeout(500);
    await captureScreen(page, 'dashboard-dark');
    await setTheme(page, 'light');
  });

  test('POS billing - new, cart, payment modal, receipt (light + dark)', async ({ page }) => {
    await installApiMocks(page);
    await loginAs(page, 'cajero.validacion');
    await setTheme(page, 'light');
    await page.goto('/cashbox');
    await expect(page.getByRole('heading', { name: /^caja$/i })).toBeVisible();
    await page.getByRole('main').getByRole('button', { name: /abrir caja/i }).click();
    await expect(page.getByRole('alertdialog', { name: /confirmar apertura de caja/i })).toBeVisible();
    await page.getByRole('alertdialog', { name: /confirmar apertura de caja/i }).getByRole('button', { name: /abrir caja/i }).click();
    if (await page.getByRole('dialog', { name: /caja activa/i }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /cerrar modal/i }).click({ force: true });
    }
    await page.waitForTimeout(500);
    await captureScreen(page, 'cashbox-open-light');

    await page.goto('/billing/new');
    await expect(page.getByRole('heading', { name: /nueva factura/i })).toBeVisible();
    await page.waitForTimeout(500);
    await captureScreen(page, 'billing-new-empty-light');

    await expect(page.getByLabel(/nombre del paciente/i)).toBeEditable();
    await page.getByLabel(/nombre del paciente/i).fill('Maria Lopez');
    await page.getByLabel(/buscar por nombre/i).fill('eritropoyetina');
    await page.getByRole('button', { name: /eritropoyetina/i }).click();
    const invoiceDraft = page.getByRole('region', { name: /factura en curso/i });
    await expect(invoiceDraft.getByText(/^Total estimado:$/i)).toBeVisible();
    await expect(invoiceDraft.getByText(/L\s*25\.00/).first()).toBeVisible();
    await page.waitForTimeout(500);
    await captureScreen(page, 'billing-new-cart-light');

    await page.getByRole('button', { name: /emitir y cobrar/i }).click();
    const confirmIssueDialog = page.getByRole('dialog', { name: /confirmar emisi/i });
    await expect(confirmIssueDialog).toBeVisible();
    await confirmIssueDialog.getByRole('button', { name: /emitir y abrir cobro/i }).click();
    await expect(page.getByRole('heading', { name: /registrar pago/i })).toBeVisible();
    await page.waitForTimeout(500);
    await captureScreen(page, 'payment-modal-light');

    await page.getByLabel(/monto recibido/i).fill('25.00');
    await page.getByRole('button', { name: /confirmar cobro/i }).click();
    await expect(page.getByRole('heading', { name: /comprobante de factura|vista previa del recibo/i })).toBeVisible();
    await page.waitForTimeout(500);
    await captureScreen(page, 'receipt-preview-light');

    await page.getByRole('combobox', { name: /tama(?:ñ|n)o del recibo/i }).click();
    await page.getByRole('option', { name: 'A5', exact: true }).click({ force: true });
    await expect(page.getByLabel(/recibo institucional/i)).toHaveClass(/receipt-a5/);
    await page.waitForTimeout(500);
    await captureScreen(page, 'receipt-preview-a5-light');

    await page.getByRole('combobox', { name: /tama(?:ñ|n)o del recibo/i }).click();
    await page.getByRole('option', { name: /Carta|Letter|80mm/i }).first().click();
    await page.waitForTimeout(500);
    await captureScreen(page, 'receipt-preview-letter-light');

    await setTheme(page, 'dark');
    await page.waitForTimeout(500);
    await captureScreen(page, 'receipt-preview-dark');
    await setTheme(page, 'light');
  });

  test('reprint flow (light)', async ({ page }) => {
    await installApiMocks(page);
    await loginAs(page, 'cajero.validacion');
    await setTheme(page, 'light');
    await page.goto('/cashbox');
    await page.getByRole('main').getByRole('button', { name: /abrir caja/i }).click();
    await expect(page.getByRole('alertdialog', { name: /confirmar apertura de caja/i })).toBeVisible();
    await page.getByRole('alertdialog', { name: /confirmar apertura de caja/i }).getByRole('button', { name: /abrir caja/i }).click();
    if (await page.getByRole('dialog', { name: /caja activa/i }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /cerrar modal/i }).click({ force: true });
    }
    await page.goto('/billing/new');
    await expect(page.getByLabel(/nombre del paciente/i)).toBeEditable();
    await page.getByLabel(/nombre del paciente/i).fill('Maria Lopez');
    await page.getByLabel(/buscar por nombre/i).fill('eritropoyetina');
    await page.getByRole('button', { name: /eritropoyetina/i }).click();
    await page.getByRole('button', { name: /emitir y cobrar/i }).click();
    const confirmIssueDialog = page.getByRole('dialog', { name: /confirmar emisi/i });
    await expect(confirmIssueDialog).toBeVisible();
    await confirmIssueDialog.getByRole('button', { name: /emitir y abrir cobro/i }).click();
    await page.getByLabel(/monto recibido/i).fill('25.00');
    await page.getByRole('button', { name: /confirmar cobro/i }).click();
    await expect(page.getByRole('heading', { name: /comprobante de factura|vista previa del recibo/i })).toBeVisible();
    await page.getByRole('button', { name: /cerrar modal/i }).click({ force: true });
    await page.getByRole('button', { name: /nueva factura|crear otra factura/i }).click();

    await page.getByRole('link', { name: /historial/i }).click();
    await expect(page.getByRole('heading', { name: /historial de facturas/i })).toBeVisible();
    await page.waitForTimeout(500);
    await captureScreen(page, 'invoice-history-light');

    await page.getByRole('button', { name: /buscar/i }).click();
    await page.getByRole('button', { name: /acciones de la factura/i }).first().click();
    const reprintItem = page.getByRole('menuitem', { name: /reimprimir/i });
    await expect(reprintItem).toBeVisible();
    await reprintItem.click({ force: true });
    await page.getByLabel(/motivo de reimpresi.n/i).fill('Copia solicitada por paciente para expediente administrativo.');
    await page.getByRole('button', { name: /registrar reimpresi.n/i }).click();
    await expect(page.getByRole('heading', { name: /comprobante de factura - 000-001-01-00000001/i })).toBeVisible();
    await page.waitForTimeout(500);
    await captureScreen(page, 'reprint-modal-light');
  });

  test('cashbox close flow (light)', async ({ page }) => {
    await installApiMocks(page);
    await loginAs(page, 'cajero.validacion');
    await setTheme(page, 'light');
    await page.goto('/cashbox');
    await page.getByRole('main').getByRole('button', { name: /abrir caja/i }).click();
    await expect(page.getByRole('alertdialog', { name: /confirmar apertura de caja/i })).toBeVisible();
    await page.getByRole('alertdialog', { name: /confirmar apertura de caja/i }).getByRole('button', { name: /abrir caja/i }).click();
    if (await page.getByRole('dialog', { name: /caja activa/i }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /cerrar modal/i }).click({ force: true });
    }
    await page.waitForTimeout(500);
    await page.waitForTimeout(800);
    await captureScreen(page, 'cashbox-open-light');

    const closingAmount = page.locator('#closing_amount');
    if (await closingAmount.isVisible().catch(() => false)) {
      await closingAmount.fill('525.00');
      const closingNotes = page.locator('#closing_notes');
      if (await closingNotes.isVisible().catch(() => false)) {
        await closingNotes.fill('Cierre de prueba RC1');
      }
      await page.waitForTimeout(500);
      await captureScreen(page, 'cashbox-close-light');

      await page.getByRole('button', { name: /^cerrar caja$/i }).click();
      const closeDialog = page.getByRole('dialog');
      if (await closeDialog.isVisible().catch(() => false)) {
        await page.waitForTimeout(500);
        await captureScreen(page, 'cashbox-close-confirm-light');
        const confirmBtn = closeDialog.getByRole('button', { name: /confirmar cierre|cerrar caja|s.?\s*confirmar/i }).first();
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
          await page.waitForTimeout(800);
          await captureScreen(page, 'cashbox-closed-light');
        }
      }
    }
  });

  test('reports (light + dark)', async ({ page }) => {
    await installApiMocks(page);
    await loginAs(page, 'admin.validacion');
    await setTheme(page, 'light');
    await page.goto('/reports');
    await expect(page.getByRole('heading', { name: /^reportes$/i })).toBeVisible();
    await page.waitForTimeout(500);
    await page.waitForTimeout(500);
    await captureScreen(page, 'reports-admin-light');

    await setTheme(page, 'dark');
    await page.waitForTimeout(500);
    await captureScreen(page, 'reports-admin-dark');
    await setTheme(page, 'light');
  });

  test('settings fiscal (light + dark)', async ({ page }) => {
    await installApiMocks(page);
    await loginAs(page, 'admin.validacion');
    await setTheme(page, 'light');
    await page.goto('/settings/fiscal');
    await page.waitForTimeout(500);
    await page.waitForTimeout(800);
    await captureScreen(page, 'settings-fiscal-light');

    await setTheme(page, 'dark');
    await page.waitForTimeout(500);
    await captureScreen(page, 'settings-fiscal-dark');
    await setTheme(page, 'light');
  });

  test('backups (light)', async ({ page }) => {
    await installApiMocks(page);
    await loginAs(page, 'admin.validacion');
    await setTheme(page, 'light');
    await page.goto('/backups');
    await page.waitForTimeout(500);
    await page.waitForTimeout(800);
    await captureScreen(page, 'backups-light');

    const createBtn = page.getByRole('button', { name: /crear respaldo/i }).first();
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click();
      const confirmBtn = page.getByRole('button', { name: /^crear respaldo$/i });
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(800);
        await captureScreen(page, 'backups-pending-light');
      }
    }
  });

  test('login error/validation screen', async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => {
      try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
    });
    await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
    await page.route('**/api/auth/session', (route) => json(route, { data: null }));
    await page.route('**/api/auth/session', (route) => json(route, { message: 'Unauthenticated.' }, 401));
    await page.route('**/api/auth/login', (route) => json(route, {
      message: 'Credenciales invalidas.',
      errors: { login: ['Usuario o contrasena incorrectos.'] },
    }, 422));
    await page.goto('/login');
    await page.getByLabel(/usuario o correo/i).fill('wrong.user');
    await page.getByLabel(/^contraseña$/i).fill('badpassword');
    await page.getByRole('button', { name: /iniciar sesi.n/i }).click();
    await expect(page.getByText(/credenciales|incorrectos|inv.lid/i).first()).toBeVisible({ timeout: 10_000 });
    await captureScreen(page, 'login-error-light');
  });

  test('billing validation error (empty patient + cart with disabled button)', async ({ page }) => {
    await installApiMocks(page);
    await loginAs(page, 'cajero.validacion');
    await setTheme(page, 'light');
    await page.goto('/cashbox');
    await page.getByRole('main').getByRole('button', { name: /abrir caja/i }).click();
    if (await page.getByRole('dialog', { name: /caja activa/i }).isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /cerrar modal/i }).click({ force: true });
    }
    await page.goto('/billing/new');
    await expect(page.getByRole('button', { name: /emitir y cobrar/i })).toBeDisabled();
    await captureScreen(page, 'billing-validation-light');
  });
});
