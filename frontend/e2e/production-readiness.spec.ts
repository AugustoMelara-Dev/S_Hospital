import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const captureRcScreenshots = process.env.E2E_CAPTURE_RC_SCREENSHOTS === '1';
const captureDirName = 'rc-e2e-mocked-2026-06-01';
const captureOutputDir = process.env.E2E_CAPTURE_RC_OUTPUT_DIR ?? path.join('test-results', captureDirName);
const captureReportDir = (
  process.env.E2E_CAPTURE_RC_REPORT_DIR ?? path.posix.join('frontend', 'test-results', captureDirName)
).replaceAll('\\', '/');
const capturedScreens: Array<{ name: string; path: string; route: string; theme: 'light' | 'dark' }> = [];

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
    'patients.mark_dialysis_prescription',
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

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

const operationalDate = localDateString();
const operationalIssuedAt = `${operationalDate}T08:00:00-06:00`;
const operationalPaidAt = `${operationalDate}T08:03:00-06:00`;

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function captureScreen(page: Page, name: string, theme: 'light' | 'dark' = 'light') {
  if (!captureRcScreenshots) {
    return;
  }

  await mkdir(captureOutputDir, { recursive: true });
  const fileName = `${name}.png`;
  const file = path.join(captureOutputDir, fileName);
  await page.screenshot({ path: file, fullPage: true });
  capturedScreens.push({ name, path: path.posix.join(captureReportDir, fileName), route: new URL(page.url()).pathname, theme });
}

async function setVisualTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((nextTheme) => {
    localStorage.setItem('hospital-billing-theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  }, theme);
}

async function writeCaptureReport(consoleIssues: string[] = []) {
  if (!captureRcScreenshots) {
    return;
  }

  await mkdir(captureOutputDir, { recursive: true });
  await writeFile(
    path.join(captureOutputDir, 'rc-e2e-mocked-report.json'),
    `${JSON.stringify({
      generated_at: new Date().toISOString(),
      mode: 'mocked-e2e',
      note: 'Capturas con API mockeada; no sustituyen LAN, MySQL/MariaDB ni impresora fisica.',
      screenshots: capturedScreens,
      console_issues: consoleIssues,
    }, null, 2)}\n`,
  );
}

async function installApiMocks(page: Page) {
  let currentUser = cashierUser;
  let currentCashSession: Record<string, unknown> | null = null;
  let isLogged = false;
  let invoiceCounter = 1;
  const invoices: Record<number, Record<string, unknown>> = {};
  const backupLogs: Record<string, unknown>[] = [];
  const fiscalSettings = {
    primary_color: 'indigo',
    hospital_name: 'Hospital San Isidro',
    name: 'Hospital San Isidro',
    rtn: '08011999123456',
    address: 'Tocoa, Colon',
    phone: '2222-2222',
    email: 'contacto@hospital-san-isidro.local',
    scanner_enabled: false,
    partial_payments_enabled: false,
    receipt_paper_size: 'half_letter',
  };

  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204 }));
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));

  await page.route('**/api/settings/fiscal', (route) => json(route, {
    data: fiscalSettings,
  }));
  await page.route('**/api/settings/operational', (route) => json(route, {
    data: fiscalSettings,
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
        valid_until: '2027-05-17',
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
  await page.route('**/api/health', (route) => json(route, { status: 'ok' }));
  await page.route('**/api/system/health', (route) => json(route, { status: 'ok' }));
  await page.route('**/api/system/setup-status', (route) => json(route, {
    data: { setup_required: false, default_admin_present: true },
  }));
  await page.route('**/api/system/echo-config', (route) => json(route, {
    data: {
      enabled: false,
      driver: 'log',
      host: '127.0.0.1',
      port: 6001,
      scheme: 'http',
    },
  }));
  await page.route('**/api/system/client-errors', (route) => route.fulfill({ status: 204 }));

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
  await page.route('**/api/auth/logout', (route) => {
    currentUser = cashierUser;
    isLogged = false;
    return json(route, { ok: true });
  });
  await page.route('**/api/categories**', (route) => json(route, {
    data: [
      { id: 1, name: 'Medicamentos', slug: 'medicamentos', active: true, sort_order: 1 },
      { id: 2, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 2 },
    ],
  }));
  await page.route('**/api/areas**', (route) => json(route, { data: [] }));
  await page.route('**/api/service-areas**', (route) => json(route, { data: [] }));
  await page.route('**/api/services**', (route) => json(route, { data: services, meta: { total: services.length } }));
  await page.route('**/api/cash-sessions/current', (route) => json(route, { data: currentCashSession }));
  await page.route(/\/api\/cash-sessions(?:\?|$)/, (route) => {
    const sessions = currentCashSession ? [currentCashSession] : [];

    return json(route, { data: sessions, meta: { current_page: 1, per_page: 50, total: sessions.length } });
  });
  await page.route('**/api/cash-sessions/open', async (route) => {
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
      opened_at: '2026-05-18T08:00:00-06:00',
      closed_at: null,
    };
    return json(route, { data: currentCashSession }, 201);
  });

  await page.route('**/api/invoices**', async (route) => {
    const url = new URL(route.request().url());
    const detailMatch = url.pathname.match(/\/api\/invoices\/(\d+)$/);
    if (route.request().method() === 'GET' && detailMatch) {
      return json(route, { data: invoices[Number(detailMatch[1])] });
    }

    if (route.request().method() === 'POST') {
      const payload = await route.request().postDataJSON();
      const hasDialysisPrescription = payload.items?.some((item: { dialysis_prescription?: boolean }) => item.dialysis_prescription);
      const id = 100 + invoiceCounter;
      const invoice = {
        id,
        invoice_number: `000-001-01-${String(invoiceCounter).padStart(8, '0')}`,
        patient_name: payload.patient_name,
        subtotal: hasDialysisPrescription ? '0.00' : '25.00',
        tax_amount: '0.00',
        discount_amount: '0.00',
        total: hasDialysisPrescription ? '0.00' : '25.00',
        paid_amount: hasDialysisPrescription ? '0.00' : '0.00',
        balance_due: hasDialysisPrescription ? '0.00' : '25.00',
        status: hasDialysisPrescription ? 'paid' : 'issued',
        issued_at: operationalIssuedAt,
        items: [{
          id: 1,
          service_id: 10,
          service_name: 'Eritropoyetina',
          category_id: 1,
          category_name: 'Medicamentos',
          quantity: '1.00',
          unit_price: hasDialysisPrescription ? '0.00' : '25.00',
          tax_rate: '0.00',
          tax_amount: '0.00',
          line_subtotal: hasDialysisPrescription ? '0.00' : '25.00',
          line_total: hasDialysisPrescription ? '0.00' : '25.00',
          special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
          special_rule_applied: hasDialysisPrescription,
          notes: null,
        }],
        issuer: currentUser,
      };
      invoices[id] = invoice;
      invoiceCounter += 1;
      return json(route, { data: invoice }, 201);
    }

    return json(route, {
      data: Object.values(invoices),
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
      payments: [],
      movements: [],
      expected_cash_amount: currentCashSession?.opening_amount ?? '0.00',
      cash_difference: '0.00',
      permissions: { can_close: true, can_view_any: false },
    },
  }));

  await page.route('**/api/reports/executive**', (route) => json(route, {
    data: {
      period: {
        from: '2026-06-01',
        to: '2026-06-18',
        timezone: 'America/Tegucigalpa',
        days: 18,
      },
      filters: {
        cash_session_id: null,
        user_id: null,
        category_id: null,
        area_id: null,
        method: null,
        status: null,
      },
      comparison: {
        billed: { current: '25.00', previous: '0.00', delta_cents: 2500, delta_percentage: null },
        collected: { current: '25.00', previous: '0.00', delta_cents: 2500, delta_percentage: null },
        previous_period: { from: '2026-05-14', to: '2026-05-31' },
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
      daily_trend: [{ date: '2026-06-18', billed: '25.00', collected: '25.00', pending: '0.00', voided_count: 0, invoice_count: 1 }],
      services: {
        top_by_amount: [{ service: 'Eritropoyetina', category: 'Medicamentos', item_count: 1, quantity: '1.00', total: '25.00', collected: '25.00' }],
        top_by_quantity: [{ service: 'Eritropoyetina', category: 'Medicamentos', item_count: 1, quantity: '1.00', total: '25.00' }],
        by_category: [{ category: 'Medicamentos', quantity: '1.00', total: '25.00', collected: '25.00', item_count: 1 }],
        by_area: [{ area_id: null, area: 'Sin area', item_count: 1, quantity: '1.00', total: '25.00' }],
      },
      cashiers: [{ user_id: 2, name: 'Cajero Validacion', username: 'cajero.validacion', invoice_count: 1, payment_count: 1, collected: '25.00', cash: '25.00', transfer: '0.00', card: '0.00', other: '0.00', voided_count: 0, difference_total: '0.00' }],
      cash_sessions: [],
      pending_aging: {
        '0_7_days': { count: 0, amount: '0.00' },
        '8_30_days': { count: 0, amount: '0.00' },
        '31_plus_days': { count: 0, amount: '0.00' },
        items: [],
      },
      voids_and_reversals: [],
      audit_summary: { critical_events: 0, reprints: 0, fiscal_changes: 0, cash_differences: 0, backup_events: 1 },
    },
  }));


  await page.route('**/api/reports/dashboard**', (route) => json(route, {
    data: {
      current_month: {
        total_billed: '25.00',
        total_collected: '25.00',
        invoice_count: Object.keys(invoices).length,
        payment_count: Object.keys(invoices).length,
      },
      last_7_days: [{
        date: operationalDate,
        total_billed: '25.00',
        total_collected: '25.00',
        invoice_count: Object.keys(invoices).length,
        payment_count: Object.keys(invoices).length,
      }],
      payments_by_method: { cash: '25.00', transfer: '0.00', card: '0.00', other: '0.00' },
      top_services: [{ service_name: 'Eritropoyetina', category_name: 'Medicamentos', quantity: '1.00', total: '25.00' }],
      cashiers_summary: [{ user_id: currentUser.id, name: currentUser.name, username: currentUser.username, payment_count: Object.keys(invoices).length, total_collected: '25.00' }],
    },
  }));

  await page.route('**/api/reports/daily**', (route) => json(route, {
    data: {
      date: '2026-05-17',
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
      month: '2026-05',
      date_from: '2026-05-01',
      date_to: '2026-05-31',
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
          date: '2026-05-17',
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
      date_from: '2026-05-17',
      date_to: '2026-05-17',
      cash_session_id: null,
      user_id: null,
      total_collected: '25.00',
      payments_by_method: { cash: '25.00', transfer: '0.00', card: '0.00', other: '0.00' },
      payment_count: 1,
      invoice_count: 1,
    },
  }));
  await page.route('**/api/reports/categories**', (route) => json(route, {
    data: {
      date_from: '2026-05-17',
      date_to: '2026-05-17',
      categories: [{ category: 'Medicamentos', item_count: 1, quantity: '1.00', subtotal: '25.00', tax_amount: '0.00', total: '25.00' }],
    },
  }));
  await page.route('**/api/reports/services**', (route) => json(route, {
    data: {
      date_from: '2026-05-17',
      date_to: '2026-05-17',
      services: [{ service: 'Eritropoyetina', item_count: 1, quantity: '1.00', subtotal: '25.00', tax_amount: '0.00', total: '25.00' }],
    },
  }));
  await page.route('**/api/reports/operations**', (route) => json(route, {
    data: {
      date_from: '2026-05-17',
      date_to: '2026-05-17',
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
        filename: 'hospital-backup-20260517-101500-test.sql',
        size_bytes: null,
        checksum_sha256: null,
        status: 'pending',
        type: 'manual',
        created_by: currentUser.id,
        completed_at: null,
        created_at: '2026-05-17T10:15:00-06:00',
        updated_at: '2026-05-17T10:15:00-06:00',
        creator: currentUser,
      };
      backupLogs.unshift(backup);
      return json(route, {
        data: backup,
      }, 202);
    }

    return json(route, { data: backupLogs, meta: { current_page: 1, per_page: 15, total: backupLogs.length } });
  });
  await page.route('**/api/system/status', (route) => json(route, {
    data: {
      environment: {
        app_env: 'local',
        app_debug: true,
        app_url: 'http://127.0.0.1:5173',
        queue_connection: 'database',
        filesystem_disk: 'local',
        php_version: '8.3.0',
        server_time: new Date().toISOString(),
        timezone: 'America/Tegucigalpa',
      },
      database: {
        connection: 'mysql',
        driver: 'mysql',
        is_mysql_family: true,
      },
      frontend: {
        dist_index_exists: true,
        assets_present: true,
        assets_count: 4,
        entry_label: 'frontend/dist/index.html',
      },
      network: {
        configured_host: '192.168.1.10',
        host_type: 'lan',
        lan_ready: true,
        client_url: 'http://192.168.1.10:8000',
        guidance: 'Clientes deben entrar por esta direccion LAN.',
      },
      backups: {
        pending_count: backupLogs.filter((backup) => backup.status === 'pending').length,
        last_success_at: null,
        last_success_filename: null,
        last_failure_at: null,
        last_failure_message: null,
        dump_binary: {
          configured: false,
          available: true,
          name: 'mysqldump.exe',
        },
        storage: {
          writable: true,
          free_bytes: 1048576,
        },
        queue: {
          connection: 'database',
          pending_backup_jobs: 0,
          worker_command: 'php artisan queue:work --queue=backups --tries=1 --timeout=600',
          scheduler_command: 'php artisan schedule:run',
          failed_jobs_count: 0,
          jobs_table_available: true,
          failed_jobs_table_available: true,
        },
      },
      runtime: {
        migration_count: 12,
        latest_migration: '2026_05_01_000001_create_backup_logs_table',
        laravel_log: {
          exists: true,
          size_bytes: 2048,
          modified_at: new Date().toISOString(),
        },
        backup_automation_log: {
          exists: false,
          size_bytes: null,
          modified_at: null,
        },
      },
      readiness: {
        state: 'PRODUCTION_CANDIDATE',
        production_ready: false,
        blockers: [
          {
            code: 'PENDING_LAN_CLIENT_VALIDATION',
            label: 'Validacion desde segunda PC LAN',
            status: 'pending',
          },
          {
            code: 'PENDING_HARDWARE_VALIDATION',
            label: 'Impresora institucional fisica media carta/carta/A5/80mm/58mm',
            status: 'pending',
          },
        ],
      },
      preflight: {
        production_checks: [
          {
            code: 'APP_ENV_PRODUCTION',
            label: 'APP_ENV=production',
            status: 'pending',
            detail: 'Actual: local',
          },
          {
            code: 'DUMP_BINARY_AVAILABLE',
            label: 'mysqldump/mariadb-dump disponible',
            status: 'validated',
            detail: 'mysqldump.exe',
          },
          {
            code: 'BACKUP_WORKER_CONTINUOUS',
            label: 'Worker de backups como tarea/servicio',
            status: 'manual_required',
            detail: 'php artisan queue:work --queue=backups --tries=1 --timeout=600',
          },
        ],
        public_routes: [
          {
            path: '/up',
            expected: 'HTTP 200',
            status: 'manual_required',
          },
          {
            path: '/login',
            expected: 'SPA cargada desde host LAN',
            status: 'manual_required',
          },
          {
            path: '/verify-email',
            expected: 'SPA o ruta esperada cargada desde host LAN',
            status: 'manual_required',
          },
        ],
        physical_proofs: [
          {
            code: 'LAN_CLIENT_VALIDATION_PROOF',
            label: 'Segunda PC en LAN',
            required_file: 'qa/LAN_CLIENT_VALIDATION_PROOF.md',
            status: 'pending',
          },
          {
            code: 'INSTITUTIONAL_RECEIPT_PRINT_PROOF',
            label: 'Impresora institucional media carta/carta/A5/80mm/58mm',
            required_file: 'qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md',
            status: 'pending',
          },
        ],
        commands: {
          preflight: 'powershell.exe -ExecutionPolicy Bypass -File scripts\\\\production_readiness_preflight.ps1 -BaseUrl http://IP_DEL_SERVIDOR',
          backup_worker: 'php artisan queue:work --queue=backups --tries=1 --timeout=600',
          scheduler: 'php artisan schedule:run',
        },
      },
    },
  }));
}

function receiptFor(invoice: Record<string, unknown>, width: string) {
  return {
    width,
    hospital: { name: 'Hospital San Isidro', rtn: '08011999123456' },
    fiscal: {
      cai: 'VALIDACION-CAI',
      authorized_range: '000-001-01-00000001 a 000-001-01-99999999',
      valid_until: '2027-05-17',
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

async function loginAs(page: Page, username: string) {
  await page.goto('/login');
  const loginInput = page.getByLabel(/usuario o (correo|email)/i);
  const visibleState = await Promise.any([
    loginInput.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'login' as const),
    page.getByRole('heading', { name: /inicio|dashboard/i }).waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'session' as const),
  ]).catch(() => 'timeout' as const);

  if (visibleState === 'session') {
    return;
  }

  if (visibleState === 'timeout') {
    await expect(loginInput).toBeVisible();
  }

  await loginInput.fill(username);
  await page.getByLabel(/^contraseña$|^contrasena$/i).fill('Password123!');
  await Promise.all([
    page.waitForResponse('**/api/auth/login'),
    page.getByRole('button', { name: /iniciar|entrar/i }).click(),
  ]);
}

async function expectOperationalNavigation(page: Page) {
  const desktopCashLink = page.getByRole('link', { name: 'Caja', exact: true }).first();
  if (await desktopCashLink.isVisible().catch(() => false)) {
    await expect(desktopCashLink).toBeVisible();
    await expect(page.getByRole('link', { name: /cat.logo/i }).first()).toBeVisible();
    return;
  }

  await page.getByRole('button', { name: /^abrir men(?:u|ú|Ãº)$/i }).click();
  await expect(page.getByRole('link', { name: 'Caja', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /cat.logo/i }).first()).toBeVisible();
  await page.keyboard.press('Escape');
}

test('production readiness cashier and admin workflow', async ({ page }) => {
  const consoleIssues: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = msg.text();
      if (text.includes('401') || text.includes('Unauthorized')) return;
      if (text.includes('[echo]')) return;
      if (text.includes('[posMath]')) return;
      if (text.includes('Missing `Description`')) return;
      if (/Failed to load resource: the server responded with a status of 404/i.test(text)) return;
      consoleIssues.push(`${msg.type()}: ${msg.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    if (failure?.errorText === 'net::ERR_ABORTED') {
      return;
    }

    consoleIssues.push(`requestfailed: ${request.method()} ${request.url()} ${failure?.errorText ?? ''}`.trim());
  });

  await installApiMocks(page);
  await loginAs(page, 'cajero.validacion');
  await setVisualTheme(page, 'light');
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /inicio|dashboard/i })).toBeVisible();
  await captureScreen(page, 'dashboard-light', 'light');
  await setVisualTheme(page, 'dark');
  await captureScreen(page, 'dashboard-dark', 'dark');
  await setVisualTheme(page, 'light');

  await page.goto('/cashbox');

  await expect(page.getByRole('heading', { name: /^caja$/i })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: /abrir caja/i }).click();
  await expect(page.getByRole('heading', { name: /cerrar caja/i })).toBeVisible();
  if (await page.getByRole('dialog', { name: /caja activa/i }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /cerrar modal/i }).click();
  }
  await captureScreen(page, 'cashbox-open-light', 'light');

  await page.getByLabel(/navegaci(?:o|ó|Ã³)n principal/i).getByRole('link', { name: /nueva factura/i }).click();
  await captureScreen(page, 'billing-new-empty-light', 'light');
  await page.getByLabel(/nombre del paciente/i).fill('Maria Lopez');
  await page.getByLabel(/buscar por nombre/i).fill('eritropoyetina');
  await page.getByRole('button', { name: /eritropoyetina/i }).click();
  await captureScreen(page, 'billing-new-cart-light', 'light');
  await expect(page.getByText(/Total estimado:\s*L\.?\s*25\.00/)).toBeVisible();
  await page.getByRole('button', { name: /emitir y cobrar/i }).click();
  await page.getByRole('button', { name: /emitir y abrir cobro/i }).click();
  await expect(page.getByRole('heading', { name: /registrar pago/i })).toBeVisible();
  await expect(page.getByText(/ingrese el monto recibido/i)).toBeVisible();
  await page.getByLabel(/monto recibido/i).fill('25.00');
  await expect(page.getByText(/ingrese el monto recibido/i)).toBeHidden();
  await page.getByRole('button', { name: /confirmar cobro/i }).click();
  await expect(page.getByRole('dialog', { name: /comprobante de factura/i })).toBeVisible();
  await expect(page.getByText('Media carta')).toBeVisible();
  await page.getByRole('combobox', { name: /tama(?:ñ|n)o del recibo/i }).click();
  await page.getByRole('option', { name: 'A5', exact: true }).click({ force: true });
  await expect(page.getByLabel(/recibo institucional/i)).toHaveClass(/receipt-a5/);
  await captureScreen(page, 'receipt-preview-a5-light', 'light');
  await captureScreen(page, 'receipt-preview-light', 'light');
  await setVisualTheme(page, 'dark');
  await captureScreen(page, 'receipt-preview-dark', 'dark');
  await setVisualTheme(page, 'light');
  await page.getByRole('button', { name: /cerrar modal/i }).click();
  await page.getByRole('button', { name: /crear otra factura/i }).click();

  await page.getByRole('link', { name: /nueva factura/i }).click();
  await page.getByLabel(/nombre del paciente/i).fill('Jose Perez');
  await page.getByLabel(/buscar por nombre/i).fill('eritropoyetina');
  await page.getByRole('button', { name: /eritropoyetina/i }).click();
  const dialysisPrescription = page.getByLabel(/receta de di(?:á|a)lisis/i);
  await dialysisPrescription.click();
  await expect(dialysisPrescription).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: /emitir y cobrar/i }).click();
  await page.getByRole('button', { name: /confirmar emisi.n/i }).click();
  await expect(page.getByRole('dialog', { name: /comprobante de factura/i })).toBeVisible();
  await expect(page.getByText('L. 0.00').first()).toBeVisible();
  await page.getByRole('button', { name: /cerrar modal/i }).click({ force: true });
  await page.getByRole('button', { name: /crear otra factura/i }).click();

  await page.getByRole('link', { name: /historial/i }).click();
  await expect(page.getByRole('heading', { name: /historial de facturas/i })).toBeVisible();
  if (await page.getByRole('dialog', { name: /caja activa/i }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /cerrar modal/i }).click();
  }
  await page.getByRole('button', { name: /buscar/i }).click();
  await page.getByRole('button', { name: /^reimprimir$/i }).first().click();
  await page.getByLabel(/motivo de reimpresi.n/i).fill('Copia solicitada por paciente para expediente administrativo.');
  await page.getByRole('button', { name: /registrar reimpresi.n/i }).click();
  await expect(page.getByRole('dialog', { name: /comprobante de factura - 000-001-01-00000001/i })).toBeVisible();
  await page.getByRole('combobox', { name: /tama(?:ñ|n)o del recibo/i }).click();
  await page.getByRole('option', { name: 'A5', exact: true }).click({ force: true });
  await expect(page.getByLabel(/recibo institucional/i)).toHaveClass(/receipt-a5/);

  await page.getByRole('button', { name: /cerrar modal/i }).click();
  await page.getByRole('button', { name: /abrir men(?:u|ú|Ãº) de usuario/i }).click();
  await page.getByText(/cerrar sesi.n/i).click();
  await page.getByLabel(/usuario o (correo|email)/i).fill('admin.validacion');
  await page.getByLabel(/^contraseña$|^contrasena$/i).fill('Password123!');
  await Promise.all([
    page.waitForResponse('**/api/auth/login'),
    page.getByRole('button', { name: /iniciar|entrar/i }).click(),
  ]);
  await expect(page.getByRole('link', { name: /reportes/i })).toBeVisible();
  await page.getByRole('link', { name: /reportes/i }).click();
  await expect(page.getByRole('heading', { name: /^reportes$/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /cobrado/i })).toBeVisible();
  await captureScreen(page, 'reports-admin-light', 'light');

  await page.getByRole('link', { name: /respaldos/i }).click();
  await expect(page.getByRole('heading', { name: /^respaldos$/i })).toBeVisible();
  await page.getByRole('button', { name: /crear respaldo/i }).first().click();
  await page.getByRole('button', { name: /^crear respaldo$/i }).click();
  await expect(page.getByRole('table').getByText('Pendiente', { exact: true })).toBeVisible();
  await captureScreen(page, 'backups-pending-light', 'light');
  await writeCaptureReport(consoleIssues);
  expect(consoleIssues).toEqual([]);
});

test('responsive shell keeps operational modules reachable', async ({ page }) => {
  const consoleIssues: string[] = [];
  const viewports = [
    { width: 1280, height: 800 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ];

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = msg.text();
      if (text.includes('401') || text.includes('Unauthorized')) return;
      if (text.includes('[echo]')) return;
      if (text.includes('[posMath]')) return;
      if (text.includes('Missing `Description`')) return;
      if (/Failed to load resource: the server responded with a status of 404/i.test(text)) return;
      consoleIssues.push(`${msg.type()}: ${msg.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installApiMocks(page);
  await loginAs(page, 'cajero.validacion');

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/billing/new');
    await expect(page.getByRole('heading', { name: /nueva factura/i })).toBeVisible();
    await expectOperationalNavigation(page);
    await expect(page.getByLabel(/nombre del paciente/i)).toBeVisible();
    await expect(page.getByLabel(/buscar por nombre/i)).toBeVisible();
    await expect(page.getByLabel(/scanner usb o codigo manual/i)).toHaveCount(0);
  }

  expect(consoleIssues).toEqual([]);
});

test('main screens expose named controls and dangerous actions can be cancelled', async ({ page }) => {
  const consoleIssues: string[] = [];
  const screens = [
    { path: '/dashboard', heading: /inicio|dashboard/i, name: 'dashboard' },
    { path: '/cashbox', heading: /^caja$/i, name: 'cashbox' },
    { path: '/billing/new', heading: /nueva factura/i, name: 'billing-new' },
    { path: '/invoices', heading: /historial de facturas/i, name: 'invoice-history' },
    { path: '/reports', heading: /^reportes$/i, name: 'reports' },
    { path: '/backups', heading: /^respaldos$/i, name: 'backups' },
    { path: '/settings/fiscal', heading: /^configuraci.n$/i, name: 'settings-fiscal' },
  ];

  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = msg.text();
      if (text.includes('401') || text.includes('Unauthorized')) return;
      if (text.includes('[echo]')) return;
      if (text.includes('[posMath]')) return;
      if (text.includes('Missing `Description`')) return;
      if (/Failed to load resource: the server responded with a status of 404/i.test(text)) return;
      consoleIssues.push(`${msg.type()}: ${msg.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();

    if (url.includes('/api/') && (status >= 500 || status === 404)) {
      consoleIssues.push(`http.${status}: ${response.request().method()} ${url}`);
    }
  });

  await installApiMocks(page);
  await loginAs(page, 'admin.validacion');

  const unnamedByScreen: Record<string, string[]> = {};

  for (const screen of screens) {
    await page.goto(screen.path);
    await expect(page.getByRole('heading', { name: screen.heading })).toBeVisible();
    unnamedByScreen[screen.name] = await visibleInteractiveElementsWithoutNames(page);
  }

  const unnamedFailures = Object.entries(unnamedByScreen)
    .flatMap(([screen, controls]) => controls.map((control) => `${screen}: ${control}`));
  expect(unnamedFailures, unnamedFailures.join('\n')).toEqual([]);

  await page.goto('/backups');
  await expect(page.getByRole('heading', { name: /^respaldos$/i })).toBeVisible();
  await page.getByRole('button', { name: /crear respaldo/i }).first().click();
  const backupDialog = page.getByRole('alertdialog', { name: /crear respaldo local/i });
  await expect(backupDialog).toBeVisible();
  await backupDialog.getByRole('button', { name: /cancelar/i }).click();
  await expect(backupDialog).toBeHidden();

  expect(consoleIssues).toEqual([]);
});

async function visibleInteractiveElementsWithoutNames(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selector = [
      'button',
      'a[href]',
      'input:not([type="hidden"])',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[role="menuitem"]',
      '[role="tab"]',
      '[role="checkbox"]',
      '[role="combobox"]',
    ].join(',');

    function isVisible(element: Element): boolean {
      const html = element as HTMLElement;
      const style = window.getComputedStyle(html);
      return style.visibility !== 'hidden'
        && style.display !== 'none'
        && html.offsetParent !== null
        && html.getClientRects().length > 0;
    }

    function labelledByText(element: Element): string {
      const ids = element.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];
      return ids
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ');
    }

    function associatedLabelText(element: Element): string {
      if (!(element instanceof HTMLInputElement)
        && !(element instanceof HTMLSelectElement)
        && !(element instanceof HTMLTextAreaElement)) {
        return '';
      }

      return Array.from(element.labels ?? [])
        .map((label) => label.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ');
    }

    function accessibleNameCandidate(element: Element): string {
      return [
        element.getAttribute('aria-label') ?? '',
        labelledByText(element),
        associatedLabelText(element),
        element.getAttribute('title') ?? '',
        element.textContent?.trim() ?? '',
        element.getAttribute('placeholder') ?? '',
      ].join(' ').replace(/\s+/g, ' ').trim();
    }

    return Array.from(document.querySelectorAll(selector))
      .filter(isVisible)
      .filter((element) => accessibleNameCandidate(element).length === 0)
      .map((element) => {
        const html = element as HTMLElement;
        const id = html.id ? `#${html.id}` : '';
        const role = html.getAttribute('role') ? `[role="${html.getAttribute('role')}"]` : '';
        const type = html.getAttribute('type') ? `[type="${html.getAttribute('type')}"]` : '';
        const classes = html.className && typeof html.className === 'string'
          ? `.${html.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.')}`
          : '';

        return `${html.tagName.toLowerCase()}${id}${role}${type}${classes}`;
      });
  });
}
