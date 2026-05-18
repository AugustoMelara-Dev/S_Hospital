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

  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));

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
      opened_at: '2026-05-17T08:00:00-06:00',
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
        tax_amount: hasDialysisPrescription ? '0.00' : '3.75',
        discount_amount: '0.00',
        total: hasDialysisPrescription ? '0.00' : '28.75',
        paid_amount: '0.00',
        balance_due: hasDialysisPrescription ? '0.00' : '28.75',
        status: 'issued',
        issued_at: '2026-05-17T08:00:00-06:00',
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
          paid_at: '2026-05-17T08:03:00-06:00',
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
  await page.route('**/api/backups**', async (route) => {
    if (route.request().method() === 'POST') {
      return json(route, {
        data: {
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
        },
      }, 202);
    }

    return json(route, { data: [], meta: { current_page: 1, per_page: 15, total: 0 } });
  });
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
      paid_at: '2026-05-17T08:03:00-06:00',
      cashier: 'Cajero Demo',
    }],
  };
}

async function loginAs(page: Page, username: string) {
  await page.goto('/login');
  await page.getByLabel(/usuario o email/i).fill(username);
  await page.getByLabel(/contrasena/i).fill('Password123!');
  await page.getByRole('button', { name: /entrar/i }).click();
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
    if (request.url().includes('/sanctum/csrf-cookie') && failure?.errorText === 'net::ERR_ABORTED') {
      return;
    }

    consoleIssues.push(`requestfailed: ${request.method()} ${request.url()} ${failure?.errorText ?? ''}`.trim());
  });

  await installApiMocks(page);
  await loginAs(page, 'cajero.demo');

  await expect(page.locator('#cash-title')).toBeVisible();
  await page.getByRole('main').getByRole('button', { name: /abrir caja/i }).click();
  await expect(page.getByText('Caja abierta', { exact: true })).toBeVisible();
  if (await page.getByRole('dialog', { name: /caja activa/i }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /cerrar modal/i }).click();
  }

  await page.getByRole('link', { name: /nueva factura/i }).click();
  await page.getByLabel(/nombre del paciente/i).fill('Maria Lopez');
  await page.getByRole('button', { name: 'Medicamentos', exact: true }).click();
  await page.getByRole('button', { name: /eritropoyetina/i }).click();
  await expect(page.getByLabel(/resumen de factura/i).getByText('L. 25.00').first()).toBeVisible();
  await page.getByRole('button', { name: /emitir factura/i }).click();
  await page.getByRole('button', { name: /confirmar emision/i }).click();
  await expect(page.getByRole('dialog', { name: /factura emitida/i })).toBeVisible();
  await page.getByRole('button', { name: /cobrar ahora/i }).click();
  await expect(page.getByRole('heading', { name: /registrar pago/i })).toBeVisible();
  await page.getByRole('button', { name: /cobrar/i }).click();
  await page.getByRole('button', { name: /confirmar cobro/i }).click();
  await expect(page.getByRole('heading', { name: /preview termico/i })).toBeVisible();
  await expect(page.getByLabel(/ancho del recibo/i)).toHaveValue('80mm');
  await page.getByLabel(/ancho del recibo/i).selectOption('58mm');
  await expect(page.getByLabel(/recibo termico/i)).toHaveClass(/receipt-58mm/);
  await page.getByRole('button', { name: /cerrar modal/i }).click();

  await page.getByRole('link', { name: /nueva factura/i }).click();
  await page.getByLabel(/nombre del paciente/i).fill('Jose Perez');
  await page.getByRole('button', { name: 'Medicamentos', exact: true }).click();
  await page.getByRole('button', { name: /eritropoyetina/i }).click();
  await page.getByLabel(/receta de dialisis/i).check();
  await page.getByRole('button', { name: /emitir factura/i }).click();
  await page.getByRole('button', { name: /confirmar emision/i }).click();
  await expect(page.getByRole('dialog', { name: /factura emitida/i })).toBeVisible();
  await page.getByRole('button', { name: /cobrar ahora/i }).click();
  await expect(page.getByText('Total L. 0.00')).toBeVisible();

  await page.getByRole('link', { name: /historial/i }).click();
  await expect(page.getByRole('heading', { name: /historial de facturas/i })).toBeVisible();
  if (await page.getByRole('dialog', { name: /caja activa/i }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /cerrar modal/i }).click();
  }
  await page.getByRole('button', { name: /filtrar/i }).click();
  await page.getByRole('main').getByRole('button', { name: /^ver$/i }).first().click();
  await page.getByRole('button', { name: /reimprimir/i }).click();
  await expect(page.getByRole('heading', { name: /preview termico/i })).toBeVisible();
  await page.getByLabel(/ancho del recibo/i).selectOption('58mm');
  await expect(page.getByLabel(/recibo termico/i)).toHaveClass(/receipt-58mm/);

  await page.getByRole('button', { name: /salir/i }).click();
  await page.getByLabel(/usuario o email/i).fill('admin.demo');
  await page.getByLabel(/contrasena/i).fill('Password123!');
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page.getByRole('link', { name: /reportes/i })).toBeVisible();
  await page.getByRole('link', { name: /reportes/i }).click();
  await expect(page.getByRole('heading', { name: /^reportes$/i })).toBeVisible();
  await expect(page.getByText(/total cobrado/i)).toBeVisible();

  await page.getByRole('link', { name: /backups/i }).click();
  await expect(page.getByRole('heading', { name: /backups locales/i })).toBeVisible();
  await page.getByRole('button', { name: /crear backup/i }).click();
  await expect(page.getByText('Pendiente', { exact: true })).toBeVisible();
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
    await expect(page.getByText(/nueva factura/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Caja', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Catalogo', exact: true })).toBeVisible();
    await expect(page.getByLabel(/nombre del paciente/i)).toBeVisible();
    await expect(page.getByLabel(/scanner usb o codigo manual/i)).toBeVisible();
  }

  expect(consoleIssues).toEqual([]);
});
