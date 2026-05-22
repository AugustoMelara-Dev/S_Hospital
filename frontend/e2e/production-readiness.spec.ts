import { expect, test, type Page, type Route } from '@playwright/test';

const cashierUser = {
  id: 2,
  name: 'Cajero Demo',
  email: 'cajero.demo@hospital-billing.local',
  username: 'cajero.demo',
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
  name: 'Admin Demo',
  email: 'admin.demo@hospital-billing.local',
  username: 'admin.demo',
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
    taxable: true,
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

async function installApiMocks(page: Page) {
  let currentUser = cashierUser;
  let currentCashSession: Record<string, unknown> | null = null;
  let invoiceCounter = 1;
  const invoices: Record<number, Record<string, unknown>> = {};
  const backupLogs: Record<string, unknown>[] = [];

  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));

  await page.route('**/api/settings/fiscal', (route) => json(route, {
    data: {
      primary_color: 'indigo',
      name: 'Hospital Demo',
      rtn: '08011999123456',
      address: 'Direccion Demo',
      phone: '2222-2222',
      email: 'contacto@hospital-demo.local'
    }
  }));

  await page.route('**/api/settings/logo', (route) => json(route, { logo_url: null }));
  await page.route('**/api/health', (route) => json(route, { status: 'ok' }));

  await page.route('**/api/auth/login', async (route) => {
    let payload: { login?: string } = {};
    try {
      payload = route.request().postDataJSON() as { login?: string };
    } catch {
      payload = {};
    }
    currentUser = payload.login === 'admin.demo' ? adminUser : cashierUser;
    return json(route, { data: currentUser });
  });

  await page.route('**/api/auth/me', (route) => json(route, { data: currentUser }));
  await page.route('**/api/auth/session', (route) => json(route, { data: currentUser }));
  await page.route('**/api/auth/logout', (route) => {
    currentUser = cashierUser;
    return json(route, { ok: true });
  });
  await page.route('**/api/categories**', (route) => json(route, {
    data: [
      { id: 1, name: 'Medicamentos', slug: 'medicamentos', active: true, sort_order: 1 },
      { id: 2, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 2 },
    ],
  }));
  await page.route('**/api/services**', (route) => json(route, { data: services, meta: { total: services.length } }));
  await page.route('**/api/cash-sessions/current', (route) => json(route, { data: currentCashSession }));
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
  await page.route('**/api/cash-sessions/*/close', async (route) => {
    const expectedAmount = currentCashSession?.expected_cash_amount ?? currentCashSession?.expected_amount ?? currentCashSession?.opening_amount ?? '500.00';
    const closedSession = {
      ...(currentCashSession ?? {}),
      id: currentCashSession?.id ?? 7,
      closing_amount: '500.00',
      expected_amount: expectedAmount,
      difference_amount: '0.00',
      status: 'closed',
      closing_notes: null,
      closed_at: new Date().toISOString(),
    };
    currentCashSession = null;

    return json(route, { data: closedSession });
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
        tax_amount: hasDialysisPrescription ? '0.00' : '3.75',
        discount_amount: '0.00',
        total: hasDialysisPrescription ? '0.00' : '28.75',
        paid_amount: hasDialysisPrescription ? '0.00' : '0.00',
        balance_due: hasDialysisPrescription ? '0.00' : '28.75',
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
          tax_rate: hasDialysisPrescription ? '0.00' : '15.00',
          tax_amount: hasDialysisPrescription ? '0.00' : '3.75',
          line_subtotal: hasDialysisPrescription ? '0.00' : '25.00',
          line_total: hasDialysisPrescription ? '0.00' : '28.75',
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
    const width = new URL(route.request().url()).searchParams.get('width') ?? '80mm';
    return json(route, { data: receiptFor(invoices[invoiceId], width) });
  });

  await page.route('**/api/invoices/*/reprint', (route) => {
    const invoiceId = Number(route.request().url().match(/invoices\/(\d+)\/reprint/)?.[1]);
    const width = new URL(route.request().url()).searchParams.get('width') ?? '80mm';
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

  await page.route('**/api/reports/daily**', (route) => json(route, {
    data: {
      date: '2026-05-17',
      total_billed: '28.75',
      total_collected: '28.75',
      invoice_count: 1,
      payment_count: 1,
      payments_by_method: { cash: '28.75', transfer: '0.00', card: '0.00', other: '0.00' },
      invoices_by_status: {
        issued: { count: 0, total: '0.00' },
        partial: { count: 0, total: '0.00' },
        paid: { count: 1, total: '28.75' },
        void: { count: 0, total: '0.00' },
      },
    },
  }));
  await page.route('**/api/reports/income**', (route) => json(route, {
    data: {
      date_from: '2026-05-17',
      date_to: '2026-05-17',
      cash_session_id: null,
      user_id: null,
      total_collected: '28.75',
      payments_by_method: { cash: '28.75', transfer: '0.00', card: '0.00', other: '0.00' },
      payment_count: 1,
      invoice_count: 1,
    },
  }));
  await page.route('**/api/reports/categories**', (route) => json(route, {
    data: {
      date_from: '2026-05-17',
      date_to: '2026-05-17',
      categories: [{ category: 'Medicamentos', item_count: 1, quantity: '1.00', subtotal: '25.00', tax_amount: '3.75', total: '28.75' }],
    },
  }));
  await page.route('**/api/reports/services**', (route) => json(route, {
    data: {
      date_from: '2026-05-17',
      date_to: '2026-05-17',
      services: [{ service: 'Eritropoyetina', item_count: 1, quantity: '1.00', subtotal: '25.00', tax_amount: '3.75', total: '28.75' }],
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
            label: 'Impresora termica fisica 80mm/58mm',
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
            code: 'THERMAL_PRINTER_PROOF',
            label: 'Impresora termica 80mm/58mm',
            required_file: 'qa/THERMAL_PRINTER_PROOF.md',
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
    hospital: { name: 'Hospital Demo', rtn: '08011999123456' },
    fiscal: {
      cai: 'DEMO-CAI',
      authorized_range: '000-001-01-00000001 a 000-001-01-99999999',
      valid_until: '2027-05-17',
    },
    invoice: {
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      issued_at: invoice.issued_at,
      cashier: 'Cajero Demo',
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
      cashier: 'Cajero Demo',
    }],
  };
}

async function loginAs(page: Page, username: string) {
  await page.goto('/login');
  const loginInput = page.getByLabel(/usuario o (correo|email)/i);
  const visibleState = await Promise.any([
    loginInput.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'login' as const),
    page.getByRole('navigation', { name: /navegacion principal/i }).waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'session' as const),
  ]).catch(() => 'timeout' as const);

  if (visibleState === 'session') {
    return;
  }

  if (visibleState === 'timeout') {
    await expect(loginInput).toBeVisible();
  }

  await loginInput.fill(username);
  await page.getByLabel(/^contrase[nñ]a$/i).fill('Password123!');
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

  await page.getByRole('button', { name: 'Abrir menu', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Caja', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /cat.logo/i }).first()).toBeVisible();
  await page.keyboard.press('Escape');
}

test('production readiness cashier and admin workflow', async ({ page }) => {
  const consoleIssues: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleIssues.push(`console.error: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    const url = request.url();
    if ((url.includes('/sanctum/csrf-cookie') || url.includes('/api/health')) && failure?.errorText === 'net::ERR_ABORTED') {
      return;
    }
    if ((url.includes('/src/features/dashboard/DashboardView.tsx') || url.includes('/api/settings/logo')) && failure?.errorText === 'net::ERR_ABORTED') {
      return;
    }

    consoleIssues.push(`requestfailed: ${request.method()} ${request.url()} ${failure?.errorText ?? ''}`.trim());
  });

  await installApiMocks(page);
  await loginAs(page, 'cajero.demo');
  await page.goto('/cashbox');

  await expect(page.getByRole('heading', { name: /^caja$/i })).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: /abrir caja/i }).click();
  await expect(page.getByRole('heading', { name: /cerrar caja/i })).toBeVisible();
  if (await page.getByRole('dialog', { name: /caja activa/i }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /cerrar modal/i }).click();
  }

  await page.getByRole('link', { name: /nueva factura/i }).first().click();
  await page.getByLabel(/nombre del paciente/i).fill('Maria Lopez');
  await page.getByLabel(/buscar por nombre/i).fill('eritropoyetina');
  await page.getByRole('button', { name: /eritropoyetina/i }).click();
  await expect(page.getByText(/Total:\s*L\.\s*28\.75/)).toBeVisible();
  await page.getByRole('button', { name: /emitir y cobrar/i }).click();
  await page.getByRole('button', { name: /emitir y abrir cobro/i }).click();
  await expect(page.getByRole('heading', { name: /registrar pago/i })).toBeVisible();
  await expect(page.getByText(/ingrese el monto recibido/i)).toBeVisible();
  await page.getByLabel(/monto recibido/i).fill('17.25');
  await expect(page.getByText(/ingrese el monto recibido/i)).toBeHidden();
  await page.getByRole('button', { name: /confirmar cobro/i }).click();
  await expect(page.getByRole('dialog', { name: /vista previa del recibo/i })).toBeVisible();
  await expect(page.getByText('80mm')).toBeVisible();
  await page.locator('[aria-label="Ancho del recibo"]').click();
  await page.getByRole('option', { name: '58mm' }).click();
  await expect(page.getByLabel(/recibo t[eé]rmico/i)).toHaveClass(/receipt-58mm/);
  await page.getByRole('button', { name: /cerrar modal/i }).click();
  await page.getByRole('button', { name: /crear otra factura/i }).click();

  await page.getByRole('link', { name: /nueva factura/i }).click();
  await page.getByLabel(/nombre del paciente/i).fill('Jose Perez');
  await page.getByLabel(/buscar por nombre/i).fill('eritropoyetina');
  await page.getByRole('button', { name: /eritropoyetina/i }).click();
  await page.getByLabel(/receta de dialisis/i).click();
  await expect(page.getByLabel(/receta de dialisis/i)).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: /emitir y cobrar/i }).click();
  await page.getByRole('button', { name: /confirmar emisi[oó]n/i }).click();
  await expect(page.getByRole('dialog', { name: /vista previa del recibo/i })).toBeVisible();
  await expect(page.getByText('L. 0.00').first()).toBeVisible();
  await page.getByRole('button', { name: /cerrar modal/i }).click();
  await page.getByRole('button', { name: /crear otra factura/i }).click();

  await page.getByRole('link', { name: /historial/i }).click();
  await expect(page.getByRole('heading', { name: /historial de facturas/i })).toBeVisible();
  if (await page.getByRole('dialog', { name: /caja activa/i }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /cerrar modal/i }).click();
  }
  await page.getByRole('button', { name: /buscar/i }).click();
  await page.getByRole('button', { name: /^reimprimir$/i }).first().click();
  await page.getByRole('button', { name: /registrar reimpresi.n/i }).click();
  await expect(page.getByRole('heading', { name: /recibo - 000-001-01-00000001/i })).toBeVisible();
  await page.locator('[aria-label="Ancho del recibo"]').click();
  await page.getByRole('option', { name: '58mm' }).click();
  await expect(page.getByLabel(/recibo t[eé]rmico/i)).toHaveClass(/receipt-58mm/);

  await page.getByRole('button', { name: /cerrar modal/i }).click();
  await page.getByRole('button', { name: /abrir menu de usuario/i }).click();
  await page.getByRole('menuitem', { name: /cerrar sesi[oó]n|cerrar sesion/i }).click();
  await page.getByLabel(/usuario o (correo|email)/i).fill('admin.demo');
  await page.getByLabel(/^contrase[nñ]a$/i).fill('Password123!');
  await Promise.all([
    page.waitForResponse('**/api/auth/login'),
    page.getByRole('button', { name: /iniciar|entrar/i }).click(),
  ]);
  await expect(page.getByRole('link', { name: /reportes/i })).toBeVisible();
  await page.getByRole('link', { name: /reportes/i }).click();
  await expect(page.getByRole('heading', { name: /^reportes$/i })).toBeVisible();
  await expect(page.getByText(/^cobrado$/i)).toBeVisible();

  await page.getByRole('link', { name: /respaldos/i }).click();
  await expect(page.getByRole('heading', { name: /^respaldos$/i })).toBeVisible();
  await page.getByRole('button', { name: /crear respaldo/i }).first().click();
  await page.getByRole('button', { name: /^crear respaldo$/i }).click();
  await expect(page.getByRole('table').getByText('Pendiente', { exact: true })).toBeVisible();
  expect(consoleIssues).toEqual([]);
});

test('responsive shell keeps operational modules reachable', async ({ page }) => {
  const consoleIssues: string[] = [];
  const viewports = [
    { width: 1280, height: 800 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleIssues.push(`console.error: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installApiMocks(page);
  await loginAs(page, 'cajero.demo');

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/billing/new');
    await expect(page.getByRole('heading', { name: /nueva factura/i })).toBeVisible();
    await expectOperationalNavigation(page);
    await expect(page.getByLabel(/nombre del paciente/i)).toBeVisible();
    await expect(page.getByLabel(/scanner usb o codigo manual/i)).toBeVisible();
  }

  expect(consoleIssues).toEqual([]);
});

test('accessibility smoke keeps cashier POS workflow keyboard operable', async ({ page }) => {
  const consoleIssues: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleIssues.push(`console.error: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installApiMocks(page);
  await loginAs(page, 'cajero.demo');
  await page.goto('/cashbox');

  const openingAmount = page.getByLabel(/monto inicial/i);
  await expect(openingAmount).toBeVisible();
  await expect(openingAmount).toBeFocused();
  await openingAmount.fill('500.00');
  await openingAmount.press('Enter');
  await expect(page.getByText(/caja lista para facturar/i)).toBeVisible();

  await page.goto('/billing/new');
  await expect(page.getByRole('heading', { name: /nueva factura/i })).toBeVisible();
  await expect(page.getByLabel(/nombre del paciente/i)).toBeVisible();
  await expect(page.getByLabel(/scanner usb o codigo manual/i)).toBeVisible();

  await page.getByLabel(/nombre del paciente/i).fill('Maria Accesible');
  const serviceSearch = page.getByLabel(/buscar por nombre, categoria o codigo/i);
  await serviceSearch.fill('eritropoyetina');
  await serviceSearch.press('Enter');
  await expect(page.getByText(/Total:\s*L\.\s*28\.75/)).toBeVisible();
  await expect(serviceSearch).toBeFocused();

  await page.getByRole('button', { name: /emitir y cobrar/i }).click();
  const confirmInvoice = page.getByRole('button', { name: /emitir y abrir cobro/i });
  await expect(confirmInvoice).toBeFocused();
  await page.keyboard.press('Enter');

  const paymentAmount = page.getByLabel(/monto recibido/i);
  await expect(paymentAmount).toBeFocused();
  await paymentAmount.fill('28.75');
  await paymentAmount.press('Enter');

  await expect(page.getByRole('dialog', { name: /vista previa del recibo/i })).toBeVisible();
  const receiptWidth = page.locator('[aria-label="Ancho del recibo"]');
  await expect(receiptWidth).toBeVisible();
  await receiptWidth.click();
  await page.getByRole('option', { name: '58mm' }).click();
  await expect(page.getByLabel(/recibo t[eé]rmico/i)).toHaveClass(/receipt-58mm/);

  expect(consoleIssues).toEqual([]);
});

test('cash close dialog enforces accessible difference note and safe cancel', async ({ page }) => {
  const consoleIssues: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleIssues.push(`console.error: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    consoleIssues.push(`pageerror: ${error.message}`);
  });

  await installApiMocks(page);
  await loginAs(page, 'cajero.demo');
  await page.goto('/cashbox');

  const openingAmount = page.getByLabel(/monto inicial/i);
  await openingAmount.fill('500.00');
  await openingAmount.press('Enter');
  await expect(page.getByText(/caja lista para facturar/i)).toBeVisible();

  const countedAmount = page.getByLabel(/monto contado/i);
  await expect(countedAmount).toBeFocused();
  await countedAmount.fill('499.00');
  await expect(page.getByText(/hay una diferencia/i)).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: /^cerrar caja$/i }).click();

  const closeDialog = page.getByRole('alertdialog');
  await expect(closeDialog).toBeVisible();
  const differenceNote = page.getByLabel(/nota sobre la diferencia/i);
  await expect(differenceNote).toBeFocused();
  await expect(closeDialog.getByText(/la nota es obligatoria/i)).toBeVisible();
  await expect(closeDialog.getByRole('button', { name: /^cerrar caja$/i })).toBeDisabled();

  await closeDialog.getByRole('button', { name: /cancelar/i }).click();
  await expect(closeDialog).toBeHidden();
  await expect(page.getByRole('heading', { name: /^caja$/i })).toBeVisible();
  await expect(page.getByText(/caja lista para facturar/i)).toBeVisible();
  await expect(countedAmount).toBeVisible();

  expect(consoleIssues).toEqual([]);
});
