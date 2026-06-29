import { expect, test, type Page, type Route } from '@playwright/test';
import axeCore from 'axe-core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const reportPath = resolve(process.env.E2E_V1_2_VISIBLE_UI_A11Y_REPORT_PATH ?? '../qa/production-audit/v1-2-visible-ui-a11y-report.json');
const smokeResults: Array<Record<string, unknown>> = [];

test.setTimeout(180_000);

const today = new Date().toISOString().slice(0, 10);
const issuedAt = `${today}T08:00:00-06:00`;
const paidAt = `${today}T08:03:00-06:00`;

const adminUser = {
  id: 1,
  name: 'Administradora Hospital',
  email: 'admin.validacion@hospital.local',
  username: 'admin.validacion',
  active: true,
  roles: ['admin'],
  permissions: [
    'settings.fiscal.view',
    'settings.fiscal.update',
    'receipt_settings.view',
    'receipt_settings.update',
    'catalog.view',
    'catalog.manage',
    'cash.view',
    'cash.open',
    'cash.close',
    'cash.close_any',
    'invoices.view',
    'invoices.create',
    'invoices.void',
    'invoices.reverse',
    'payments.create',
    'payments.view',
    'payments.void',
    'receipts.view',
    'receipts.reprint',
    'receipts.reprint_any',
    'receipts.print_test',
    'reports.view',
    'reports.managerial.view',
    'reports.cash_session.view',
    'reports.export',
    'backups.view',
    'backups.create',
    'backups.download',
    'users.view',
    'users.create',
    'users.update',
    'users.disable',
    'users.assign_admin_role',
    'audit.view',
    'system.status.view',
    'patients.mark_dialysis_prescription',
  ],
  must_change_password: false,
};

const cashierUser = {
  id: 2,
  name: 'Cajera Validacion',
  email: 'cajera.validacion@hospital.local',
  username: 'cajera.validacion',
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
    'patients.mark_dialysis_prescription',
  ],
  must_change_password: false,
};

const category = { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 };
const service = {
  id: 11,
  category_id: 1,
  area_id: null,
  name: 'Glucosa',
  slug: 'glucosa',
  price: '15.00',
  scan_code: 'LAB-GLU-001',
  barcode: null,
  qr_code: null,
  taxable: true,
  active: true,
  visible_in_billing: true,
  is_billable: true,
  special_rule_code: null,
  category,
  area: null,
};

const cashSession = {
  id: 7,
  user_id: 1,
  opening_amount: '500.00',
  closing_amount: null,
  expected_amount: '517.25',
  expected_cash_amount: '517.25',
  difference_amount: null,
  status: 'open',
  opening_notes: null,
  closing_notes: null,
  opened_at: issuedAt,
  closed_at: null,
  payments_count: 1,
  payments_total: '17.25',
  pending_invoice_count: 0,
  pending_amount: '0.00',
  payments_by_method: { cash: '17.25', transfer: '0.00', card: '0.00', other: '0.00' },
};

const invoice = {
  id: 100,
  invoice_number: '000-001-01-00000100',
  patient_name: 'Paciente Validacion',
  subtotal: '15.00',
  tax_amount: '2.25',
  discount_amount: '0.00',
  total: '17.25',
  paid_amount: '17.25',
  balance_due: '0.00',
  status: 'paid',
  issued_at: issuedAt,
  items: [
    {
      id: 1,
      service_id: service.id,
      service_name: service.name,
      category_id: category.id,
      category_name: category.name,
      quantity: '1.00',
      unit_price: '15.00',
      tax_rate: '15.00',
      tax_amount: '2.25',
      line_subtotal: '15.00',
      line_total: '17.25',
      special_rule_code: null,
      special_rule_applied: false,
      notes: null,
    },
  ],
  payments: [
    {
      id: 50,
      invoice_id: 100,
      cash_session_id: 7,
      user_id: 1,
      method: 'cash',
      amount: '17.25',
      reference: null,
      status: 'posted',
      paid_at: paidAt,
    },
  ],
  institutional_receipt: {
    id: 90,
    receipt_number_full: 'REC-A-00000090',
    status: 'issued',
    issued_at: paidAt,
    reprint_count: 0,
    print_events_count: 1,
    has_print_events: true,
  },
};

const dailyReport = {
  date: today,
  total_billed: '17.25',
  total_collected: '17.25',
  total_pending: '0.00',
  total_partial: '0.00',
  total_voided: '0.00',
  invoice_count: 1,
  payment_count: 1,
  payments_by_method: { cash: '17.25', transfer: '0.00', card: '0.00', other: '0.00' },
  invoices_by_status: {
    issued: { count: 0, total: '0.00' },
    partial: { count: 0, total: '0.00' },
    paid: { count: 1, total: '17.25' },
    void: { count: 0, total: '0.00' },
  },
};

const monthlyReport = {
  ...dailyReport,
  month: today.slice(0, 7),
  date_from: `${today.slice(0, 7)}-01`,
  date_to: today,
  daily_totals: [{ ...dailyReport, date: today }],
};

const executiveReport = {
  period: { from: `${today.slice(0, 7)}-01`, to: today, days: 1, timezone: 'America/Tegucigalpa' },
  filters: { cash_session_id: null, user_id: null, category_id: null, area_id: null, method: null, status: null },
  comparison: {
    billed: { current: '17.25', previous: '0.00', delta_cents: 1725, delta_percentage: null },
    collected: { current: '17.25', previous: '0.00', delta_cents: 1725, delta_percentage: null },
    previous_period: { from: today, to: today },
  },
  summary: {
    billed_total: '17.25',
    collected_total: '17.25',
    collected_total_cents: 1725,
    pending_total: '0.00',
    voided_total: '0.00',
    reversed_total: '0.00',
    invoice_count: 1,
    receipt_count: 1,
    paid_count: 1,
    partial_count: 0,
    pending_count: 0,
    voided_count: 0,
    average_ticket: '17.25',
  },
  payment_methods: [
    { method: 'cash', label: 'Efectivo', amount: '17.25', count: 1, percentage: 100 },
    { method: 'transfer', label: 'Transferencia', amount: '0.00', count: 0, percentage: 0 },
    { method: 'card', label: 'Tarjeta', amount: '0.00', count: 0, percentage: 0 },
    { method: 'other', label: 'Otro', amount: '0.00', count: 0, percentage: 0 },
  ],
  daily_trend: [{ date: today, billed: '17.25', collected: '17.25', pending: '0.00', voided_count: 0, invoice_count: 1 }],
  services: {
    top_by_amount: [{ service: 'Glucosa', category: 'Laboratorio', item_count: 1, quantity: '1.00', total: '17.25', collected: '17.25' }],
    top_by_quantity: [{ service: 'Glucosa', category: 'Laboratorio', item_count: 1, quantity: '1.00', total: '17.25' }],
    by_category: [{ category: 'Laboratorio', quantity: '1.00', total: '17.25', collected: '17.25', item_count: 1 }],
    by_area: [],
  },
  cashiers: [{ user_id: 1, name: 'Administradora Hospital', username: 'admin.validacion', invoice_count: 1, payment_count: 1, collected: '17.25', cash: '17.25', transfer: '0.00', card: '0.00', other: '0.00', voided_count: 0, difference_total: '0.00' }],
  cash_sessions: [{ id: 7, cashier: 'Administradora Hospital', opened_at: issuedAt, closed_at: null, opening_amount: '500.00', expected_cash: '517.25', counted_cash: null, difference: null, status: 'open', closure_note: null }],
  pending_aging: {
    '0_7_days': { count: 0, amount: '0.00' },
    '8_30_days': { count: 0, amount: '0.00' },
    '31_plus_days': { count: 0, amount: '0.00' },
    items: [],
  },
  voids_and_reversals: [],
  audit_summary: { critical_events: 0, reprints: 1, fiscal_changes: 0, cash_differences: 0, backup_events: 1 },
};
const routeExpectations = [
  { path: '/dashboard', heading: /centro de mando/i },
  { path: '/billing/new', heading: /nueva factura/i },
  { path: '/cashbox', heading: /^caja$/i },
  { path: '/catalog', heading: /catalogo|cat.logo/i },
  { path: '/invoices', heading: /historial/i },
  { path: '/reports', heading: /reportes/i },
  { path: '/backups', heading: /respaldos|backups/i },
  { path: '/settings/fiscal', heading: /configuracion|configuraci.n/i },
  { path: '/settings/institutional-receipts', heading: /recibos institucionales|recibos/i },
  { path: '/admin/users', heading: /usuarios/i },
  { path: '/help', heading: /ayuda/i },
  { path: '/about', heading: /informacion del sistema|informaci.n del sistema/i },
  { path: '/does-not-exist', heading: /pagina no encontrada|no encontrada/i },
];

const smokeViewports = [
  { name: '320x640', width: 320, height: 640 },
  { name: '375x667', width: 375, height: 667 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1920x1080', width: 1920, height: 1080 },
];

test.afterAll(() => {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify({
    generated_at: new Date().toISOString(),
    mode: 'mocked-non-mutating-playwright',
    results: smokeResults,
  }, null, 2)}\n`);
});

for (const viewport of smokeViewports) {
  test(`v1.2 visible UI a11y matrix passes at ${viewport.name}`, async ({ page }) => {
    const consoleIssues: string[] = [];
    captureConsoleIssues(page, consoleIssues);
    await installApiMocks(page);
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.goto('/login');
    await waitForScreen(page, /hospital san isidro/i);
    await auditCurrentPage(page, viewport.name, '/login');

    await login(page, 'admin.validacion');
    for (const route of routeExpectations) {
      await page.goto(route.path);
      await waitForScreen(page, route.heading);
      await auditCurrentPage(page, viewport.name, route.path);

      smokeResults.push({
        name: 'full route accessibility matrix',
        viewport: viewport.name,
        path: route.path,
        status: 'passed',
      });
    }

    await enableDarkMode(page);
    for (const darkRoute of [
      { path: '/dashboard', heading: /centro de mando/i },
      { path: '/reports', heading: /reportes/i },
      { path: '/settings/institutional-receipts', heading: /recibos institucionales|recibos/i },
      { path: '/admin/users', heading: /usuarios/i },
    ]) {
      await page.goto(darkRoute.path);
      await waitForScreen(page, darkRoute.heading);
      await auditCurrentPage(page, viewport.name, `${darkRoute.path} dark`);
    }
    await disableDarkMode(page);

    await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST' }));
    await login(page, 'cajera.validacion');
    await page.goto('/reports');
    await waitForScreen(page, /sin permisos/i);
    await auditCurrentPage(page, viewport.name, '/reports access-denied');

    expect(consoleIssues, consoleIssues.join('\n')).toEqual([]);
  });
}

test('dangerous history actions open a confirmation path that can be cancelled', async ({ page }) => {
  const consoleIssues: string[] = [];
  captureConsoleIssues(page, consoleIssues);
  await installApiMocks(page);
  await login(page, 'admin.validacion');
  await page.goto('/invoices');
  await waitForScreen(page, /historial/i);

  await page.getByRole('button', { name: /reversar/i }).click();
  await expect(page.getByRole('alertdialog', { name: /reversar factura/i })).toBeVisible();
  await expect(page.getByRole('alertdialog', { name: /reversar factura/i })).toHaveAccessibleDescription(/revise la informacion/i);
  await page.getByRole('button', { name: /cancelar/i }).click();
  await expect(page.getByRole('alertdialog', { name: /reversar factura/i })).toBeHidden();

  smokeResults.push({ name: 'history reverse cancel path', status: 'passed' });
  expect(consoleIssues, consoleIssues.join('\n')).toEqual([]);
});

async function login(page: Page, username: string) {
  await page.goto('/login');
  await page.locator('#login-input').fill(username);
  await page.locator('#password-input').fill('Password123!');
  await page.getByRole('button', { name: /entrar|iniciar/i }).click();
  await waitForScreen(page, /centro de mando/i);
}

async function waitForScreen(page: Page, heading: RegExp) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 15_000 });
}

async function auditCurrentPage(page: Page, viewportName: string, path: string) {
  await expect(page.getByRole('main')).toBeVisible();

  const unnamedControls = await findVisibleUnnamedControls(page);
  const axeViolations = await seriousAxeViolations(page);
  const h1Count = await visibleH1Count(page);
  const overflow = await horizontalOverflow(page);
  const focus = await tabFocusProbe(page);

  expect(unnamedControls, `${viewportName} ${path} unnamed controls`).toEqual([]);
  expect(axeViolations, `${viewportName} ${path} serious axe violations`).toEqual([]);
  expect(h1Count, `${viewportName} ${path} must expose exactly one visible h1`).toBe(1);
  expect(overflow, `${viewportName} ${path} horizontal overflow`).toEqual([]);
  expect(focus.focused, `${viewportName} ${path} Tab should move focus from body`).toBe(true);
  expect(focus.visible, `${viewportName} ${path} focused element should expose a visible focus style`).toBe(true);
}

async function enableDarkMode(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('hospital-billing-theme', 'dark');
    document.documentElement.classList.add('dark');
  });
}

async function disableDarkMode(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('hospital-billing-theme', 'light');
    document.documentElement.classList.remove('dark');
  });
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function installApiMocks(page: Page) {
  let isLogged = false;
  let currentUser = adminUser;
  const backup = {
    id: 1,
    filename: 'hospital-backup-20260618-120000-test.sql.enc',
    size_bytes: 3145728,
    checksum_sha256: 'abc1234567890defabc1234567890defabc1234567890defabc1234567890def',
    status: 'success',
    type: 'manual',
    created_by: 1,
    completed_at: issuedAt,
    created_at: issuedAt,
    updated_at: issuedAt,
    error_message: null,
    creator: { id: 1, name: 'Administradora Hospital', username: 'admin.validacion' },
  };

  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204 }));
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();

    if (path === '/api/auth/login' && method === 'POST') {
      const payload = request.postDataJSON() as { login?: string } | null;
      currentUser = payload?.login === cashierUser.username ? cashierUser : adminUser;
      isLogged = true;
      return json(route, { data: currentUser });
    }
    if (path === '/api/auth/logout') {
      isLogged = false;
      currentUser = adminUser;
      return json(route, { ok: true });
    }
    if (path === '/api/auth/session') {
      return json(route, { data: isLogged ? currentUser : null });
    }
    if (path === '/api/auth/me') {
      return isLogged ? json(route, { data: currentUser }) : json(route, { message: 'Unauthenticated.' }, 401);
    }
    if (path === '/api/public/branding' || path === '/api/settings/branding') {
      return json(route, { data: branding() });
    }
    if (path === '/api/settings/logo') {
      return json(route, { logo_url: null });
    }
    if (path === '/api/settings/fiscal' || path === '/api/settings/operational') {
      return json(route, { data: fiscalSettings() });
    }
    if (path === '/api/fiscal-sequences') {
      return json(route, { data: [fiscalSequence()] });
    }
    if (path === '/api/settings/institutional-receipts') {
      return json(route, { data: receiptSettings() });
    }
    if (path.includes('/api/settings/institutional-receipts/')) {
      return json(route, { data: receiptSettings().resolved_profile });
    }
    if (path === '/api/categories') {
      return json(route, { data: [category], meta: { current_page: 1, per_page: 50, total: 1 } });
    }
    if (path === '/api/areas' || path === '/api/service-areas') {
      return json(route, { data: [] });
    }
    if (path === '/api/services') {
      return json(route, { data: [service], meta: { current_page: 1, per_page: 24, total: 1 } });
    }
    if (path === '/api/cash-sessions/current') {
      return json(route, { data: cashSession });
    }
    if (path === '/api/cash-sessions') {
      return json(route, { data: [cashSession], meta: { current_page: 1, per_page: 50, total: 1 } });
    }
    if (path === '/api/cash-sessions/7/close') {
      return json(route, { data: { ...cashSession, status: 'closed', closing_amount: '517.25', closed_at: paidAt } });
    }
    if (path === '/api/invoices') {
      return json(route, { data: [invoice], meta: { current_page: 1, per_page: 10, total: 1 } });
    }
    if (path === '/api/invoices/100') {
      return json(route, { data: invoice });
    }
    if (path === '/api/invoices/100/reverse' || path === '/api/invoices/100/void') {
      return json(route, { data: { ...invoice, status: 'void' } });
    }
    if (path === '/api/invoices/100/receipt' || path === '/api/invoices/100/reprint') {
      return json(route, { data: { receipt: receiptData() } });
    }
    if (path.startsWith('/api/institutional-receipts/')) {
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-smoke' });
    }
    if (path === '/api/backups') {
      if (method === 'POST') return json(route, { data: backup }, 201);
      return json(route, { data: [backup], meta: { current_page: 1, per_page: 15, total: 1 } });
    }
    if (path.endsWith('/download')) {
      return route.fulfill({ status: 200, contentType: 'application/octet-stream', body: 'backup' });
    }
    if (path === '/api/system/health') {
      return json(route, { data: systemHealth() });
    }
    if (path === '/api/system/status' || path === '/api/system/status-summary') {
      return json(route, { data: systemStatus() });
    }
    if (path === '/api/system/client-errors') {
      return route.fulfill({ status: 204 });
    }
    if (path === '/api/reports/dashboard') {
      return json(route, { data: dashboardReport() });
    }
    if (path === '/api/reports/daily') {
      return json(route, { data: dailyReport });
    }
    if (path === '/api/reports/monthly') {
      return json(route, { data: monthlyReport });
    }
    if (path === '/api/reports/income') {
      return json(route, { data: incomeReport() });
    }
    if (path === '/api/reports/categories') {
      return json(route, { data: categoryReport() });
    }
    if (path === '/api/reports/areas') {
      return json(route, { data: { date_from: today, date_to: today, filters: {}, areas: [] } });
    }
    if (path === '/api/reports/services') {
      return json(route, { data: { date_from: today, date_to: today, filters: {}, services: [{ service: 'Glucosa', category: 'Laboratorio', quantity: '1.00', total: '17.25' }] } });
    }
    if (path === '/api/reports/operations') {
      return json(route, { data: operationsReport() });
    }
    if (path === '/api/reports/today') {
      return json(route, { data: { date: today, billed: '17.25', collected: '17.25', pending: '0.00', invoices: 1, payments: 1 } });
    }
    if (path === '/api/reports/executive') {
      return json(route, { data: executiveReport });
    }
    if (path.startsWith('/api/reports/cash-sessions/')) {
      return json(route, { data: cashSessionReport() });
    }
    if (path.includes('/api/reports/') && (path.endsWith('/pdf') || path.endsWith('/excel') || path.includes('/export'))) {
      return route.fulfill({ status: 200, contentType: 'application/octet-stream', body: 'export' });
    }
    if (path === '/api/admin/users') {
      return json(route, { data: [adminUser, cashierUser] });
    }
    if (path === '/api/admin/roles') {
      return json(route, { data: roles(), permission_catalog: permissionCatalog() });
    }
    if (path.startsWith('/api/admin/users/') || path.startsWith('/api/admin/roles/')) {
      return json(route, { data: adminUser });
    }

    return json(route, { data: null });
  });
}

async function findVisibleUnnamedControls(page: Page) {
  return page.locator([
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
  ].join(',')).evaluateAll((elements) => {
    function isVisible(element: Element) {
      const html = element as HTMLElement;
      const style = window.getComputedStyle(html);
      const rect = html.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && !html.closest('[aria-hidden="true"]');
    }
    function byIdText(ids: string | null) {
      return (ids ?? '')
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
        .join(' ')
        .trim();
    }
    function associatedLabelText(element: Element) {
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
    function accessibleName(element: Element) {
      const html = element as HTMLElement;
      return [
        html.getAttribute('aria-label'),
        byIdText(html.getAttribute('aria-labelledby')),
        associatedLabelText(html),
        html.getAttribute('title'),
        html.textContent,
        html.getAttribute('placeholder'),
      ].find((value) => value && value.trim().length > 0)?.trim() ?? '';
    }

    return elements
      .filter(isVisible)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute('role'),
        id: element.id,
        className: element.getAttribute('class'),
        name: accessibleName(element),
      }))
      .filter((control) => control.name.length === 0);
  });
}

async function seriousAxeViolations(page: Page) {
  await page.addScriptTag({ content: axeCore.source });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      },
    });
    return result.violations
      .filter((violation) => ['critical', 'serious'].includes(String(violation.impact)))
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.slice(0, 3).map((node) => ({
          target: node.target,
          html: node.html,
        })),
      }));
  });
}

async function visibleH1Count(page: Page) {
  return page.locator('h1').evaluateAll((headings) => headings.filter((heading) => {
    const html = heading as HTMLElement;
    const style = window.getComputedStyle(html);
    const rect = html.getBoundingClientRect();
    return style.display !== 'none'
      && style.visibility !== 'hidden'
      && rect.width > 0
      && rect.height > 0
      && !html.closest('[aria-hidden="true"]');
  }).length);
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const documentOverflow = document.documentElement.scrollWidth - viewportWidth;

    if (documentOverflow <= 2) {
      return [];
    }

    function hasHorizontalScrollContainer(element: HTMLElement) {
      let current: HTMLElement | null = element.parentElement;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        if (['auto', 'scroll'].includes(style.overflowX)) {
          return true;
        }
        current = current.parentElement;
      }
      return false;
    }

    return Array.from(document.body.querySelectorAll<HTMLElement>('*'))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        if (element.closest('[data-radix-popper-content-wrapper]')) return false;
        if (hasHorizontalScrollContainer(element)) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.right - viewportWidth > 2;
      })
      .slice(0, 8)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const id = element.id ? `#${element.id}` : '';
        const dataSlot = element.getAttribute('data-slot') ? `[data-slot="${element.getAttribute('data-slot')}"]` : '';
        return `${element.tagName.toLowerCase()}${id}${dataSlot} right=${Math.round(rect.right)} viewport=${viewportWidth}`;
      });
  });
}

async function tabFocusProbe(page: Page) {
  await page.keyboard.press('Tab');
  return page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    if (!active || active === document.body || active === document.documentElement) {
      return { focused: false, visible: false, tag: 'body' };
    }

    const style = window.getComputedStyle(active);
    const outlineWidth = Number.parseFloat(style.outlineWidth || '0');
    const boxShadowVisible = style.boxShadow !== 'none';
    const visible = (style.outlineStyle !== 'none' && outlineWidth > 0) || boxShadowVisible;

    return {
      focused: true,
      visible,
      tag: active.tagName.toLowerCase(),
      label: active.getAttribute('aria-label') ?? active.textContent?.trim().slice(0, 80) ?? '',
    };
  });
}

function captureConsoleIssues(page: Page, consoleIssues: string[]) {
  page.on('console', (message) => {
    if (message.type() === 'error') consoleIssues.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => consoleIssues.push(`pageerror: ${error.message}`));
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    if (request.url().includes('/sanctum/csrf-cookie') && failure?.errorText === 'net::ERR_ABORTED') return;
    if (request.url().includes('/api/auth/logout') && failure?.errorText === 'net::ERR_ABORTED') return;
    if (isBenignFrontendNavigationAbort(request.url(), request.method(), failure?.errorText)) return;
    consoleIssues.push(`requestfailed: ${request.method()} ${request.url()} ${failure?.errorText ?? ''}`.trim());
  });
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if ([419, 422].includes(status) || status >= 500) {
      consoleIssues.push(`http.${status}: ${response.request().method()} ${url}`);
    }
  });
}

function isBenignFrontendNavigationAbort(url: string, method: string, errorText?: string): boolean {
  if (method !== 'GET' || errorText !== 'net::ERR_ABORTED') return false;
  const parsed = new URL(url);
  if (parsed.origin !== 'http://127.0.0.1:5173') return false;
  if (parsed.pathname.startsWith('/api/')) return false;
  return parsed.pathname.startsWith('/src/')
    || parsed.pathname.startsWith('/node_modules/.vite/')
    || parsed.pathname.startsWith('/@vite/')
    || parsed.pathname.endsWith('.tsx')
    || parsed.pathname.endsWith('.ts')
    || parsed.pathname.endsWith('.js')
    || parsed.pathname.endsWith('.css');
}

function branding() {
  return {
    hospital_name: 'Hospital San Isidro',
    primary_color: 'indigo',
    slogan: 'Sistema de Caja Hospitalaria',
    government_line: 'Gobierno de Honduras',
    secretariat_line: 'Secretaria de Salud Publica',
    receipt_location: 'Tocoa, Colon',
    logo_url: null,
  };
}

function fiscalSettings() {
  return {
    ...branding(),
    name: 'Hospital San Isidro',
    rtn: '08011999123456',
    address: 'Tocoa, Colon',
    phone: '2222-2222',
    email: 'contacto@hospital.local',
    scanner_enabled: true,
    partial_payments_enabled: true,
    receipt_paper_size: 'half_letter',
    default_tax_rate: '15.00',
    receipt_header: 'HOSPITAL SAN ISIDRO',
    receipt_footer: 'Documento institucional',
    paper_size: 'half_letter',
    printer_profile: 'media_carta_horizontal',
  };
}

function fiscalSequence() {
  return {
    id: 1,
    document_type: 'invoice',
    prefix: '000-001-01',
    min_number: 1,
    max_number: 99999999,
    current_number: 100,
    cai: 'VALIDACION-CAI',
    valid_until: '2027-06-19',
    active: true,
  };
}

function receiptSettings() {
  const profile = {
    id: 1,
    code: 'media_carta_horizontal',
    name: 'Media carta horizontal',
    width_mm: '215.90',
    height_mm: '139.70',
    margin_top_mm: '6.00',
    margin_right_mm: '6.00',
    margin_bottom_mm: '6.00',
    margin_left_mm: '6.00',
    font_family: 'Arial, sans-serif',
    font_scale: '1.00',
    template_code: 'institutional_classic',
    copies_mode: 'original_only',
    show_copy_legend: true,
    show_physical_seal_space: true,
    use_logo: false,
    active: true,
    is_global_default: true,
  };
  const series = {
    id: 1,
    series: 'REC-A',
    prefix: 'RA',
    number_format: '{series}-{number:08}',
    min_number: 1,
    max_number: 99999999,
    current_number: 90,
    range_authorization: 'Autorizado para pruebas',
    legal_text: 'Documento de recaudacion institucional.',
    receipt_number_color: '#b91c1c',
    active: true,
    reprint_behavior: 'audit_only',
    void_behavior: 'permission_reason_audit',
  };
  return {
    institution: fiscalSettings(),
    series: [series],
    active_series: series,
    print_profiles: [profile],
    resolved_profile: profile,
    assignments: [],
  };
}

function dashboardReport() {
  return {
    current_month: { total_billed: '17.25', total_collected: '17.25', invoice_count: 1, payment_count: 1 },
    last_7_days: [{ date: today, total_billed: '17.25', total_collected: '17.25', invoice_count: 1, payment_count: 1 }],
    payments_by_method: { cash: '17.25', transfer: '0.00', card: '0.00', other: '0.00' },
    top_services: [{ service_name: 'Glucosa', category_name: 'Laboratorio', quantity: '1.00', total: '17.25' }],
    cashiers_summary: [{ user_id: 1, name: 'Administradora Hospital', username: 'admin.validacion', payment_count: 1, total_collected: '17.25' }],
  };
}

function incomeReport() {
  return {
    date_from: today,
    date_to: today,
    filters: {},
    total_billed: '17.25',
    total_collected: '17.25',
    total_pending: '0.00',
    total_partial: '0.00',
    total_voided: '0.00',
    invoice_count: 1,
    payment_count: 1,
    payments_by_method: { cash: '17.25', transfer: '0.00', card: '0.00', other: '0.00' },
    invoices_by_status: dailyReport.invoices_by_status,
    daily_totals: [{ date: today, total_billed: '17.25', total_collected: '17.25', total_pending: '0.00' }],
  };
}

function categoryReport() {
  return {
    date_from: today,
    date_to: today,
    filters: {},
    amount_label: 'Total',
    amount_source: 'Facturas emitidas, excluyendo anuladas.',
    categories: [{ category: 'Laboratorio', quantity: '1.00', subtotal: '15.00', tax: '2.25', total: '17.25' }],
  };
}

function operationsReport() {
  return {
    date_from: today,
    date_to: today,
    filters: {},
    summary: {
      void_count: 0,
      reprint_count: 1,
      payment_void_count: 0,
      service_change_count: 0,
      audit_event_count: 1,
      backup_count: 1,
      failed_backup_count: 0,
      cashier_count: 1,
    },
    voids: [],
    reprints: [{ invoice_number: invoice.invoice_number, reason: 'Copia auditada', user: 'Administradora Hospital', created_at: paidAt }],
    payment_voids: [],
    catalog_changes: [],
    audit_events: [{ event: 'login', user: 'Administradora Hospital', created_at: issuedAt }],
    backups: [{ filename: 'hospital-backup.sql.enc', status: 'success', created_at: issuedAt }],
    cashiers: [{ name: 'Administradora Hospital', payment_count: 1, total_collected: '17.25' }],
  };
}

function cashSessionReport() {
  return {
    session: cashSession,
    payments: invoice.payments,
    movements: [],
    summary: { total_collected: '17.25', expected_cash: '517.25', counted_cash: null, difference: null },
  };
}

function receiptData() {
  return {
    width: 'half_letter',
    hospital: { name: 'Hospital San Isidro', rtn: '08011999123456' },
    fiscal: { cai: 'VALIDACION-CAI', authorized_range: '000-001-01-00000001 a 000-001-01-99999999', valid_until: '2027-06-19' },
    invoice: { ...invoice, cashier: 'Administradora Hospital' },
    items: invoice.items,
    payments: [{ id: 50, method: 'cash', amount: '17.25', reference: null, paid_at: paidAt, cashier: 'Administradora Hospital' }],
  };
}

function systemHealth() {
  return {
    generated_at: new Date().toISOString(),
    database: { driver: 'mysql', connected: true },
    queue: { connection: 'database', pending: 0, failed: 0 },
    backups: { worker_recently_active: true, pending: 0, success_last_24h: 1, failed_last_24h: 0 },
    storage: { backup_files: 1, backup_bytes: 3145728 },
    recent_errors: [],
  };
}

function systemStatus() {
  return {
    environment: { app_env: 'production', app_debug: false, app_url: 'http://192.168.1.10:8081', queue_connection: 'database', filesystem_disk: 'local', app_version: '1.0.0-rc.4', php_version: '8.3.0', server_time: issuedAt, timezone: 'America/Tegucigalpa' },
    database: { connection: 'mysql', driver: 'mysql', connected: true, is_mysql_family: true },
    frontend: { dist_index_exists: true, assets_present: true, assets_count: 8, entry_label: 'frontend/dist/index.html' },
    network: { configured_host: '192.168.1.10', host_type: 'lan', lan_ready: true, client_url: 'http://192.168.1.10:8081', guidance: 'Clientes deben entrar por esta direccion LAN.' },
    backups: {
      pending_count: 0,
      worker_recently_active: true,
      oldest_pending_at: null,
      stale_pending_count: 0,
      stale_pending_threshold_minutes: 15,
      last_success_at: issuedAt,
      last_success_filename: 'hospital-backup-20260618-120000-test.sql.enc',
      last_failure_at: null,
      last_failure_message: null,
      dump_binary: { configured: true, available: true, name: 'mariadb-dump' },
      storage: { writable: true, free_bytes: 2147483648 },
      queue: { connection: 'database', jobs_table_available: true, failed_jobs_table_available: true, failed_jobs_count: 0, pending_backup_jobs: 0, worker_command: 'php artisan queue:work --queue=backups --tries=1 --timeout=600', scheduler_command: 'php artisan schedule:work' },
    },
    runtime: {
      logs_writable: true,
      cache_writable: true,
      laravel_log: { exists: true, size_bytes: 1024, modified_at: issuedAt },
      backup_automation_log: { exists: true, size_bytes: 1024, modified_at: issuedAt },
      frontend_build: { available: true, modified_at: issuedAt },
      installed_version: '1.0.0-rc.4',
      latest_migration: '2026_06_18_000000_final_hardening',
      migration_count: 50,
      pending_migration_count: 0,
      pending_migrations: [],
    },
    readiness: { state: 'PRODUCTION_READY', production_ready: true, blockers: [] },
    preflight: {
      production_checks: [
        { code: 'APP_ENV_PRODUCTION', label: 'Modo produccion', status: 'validated', detail: 'production' },
        { code: 'BACKUP_STORAGE_WRITABLE', label: 'Carpeta respaldos', status: 'validated', detail: 'Disponible' },
      ],
      public_routes: [
        { path: '/up', expected: '200', status: 'validated' },
        { path: '/login', expected: '200', status: 'validated' },
      ],
      physical_proofs: [
        { code: 'half_letter', label: 'Media carta', required_file: 'qa/print-proof/half-letter.jpg', status: 'manual_required', detail: 'Pendiente de evidencia fisica real.' },
      ],
      commands: { preflight: 'php artisan system:preflight', backup_worker: 'php artisan queue:work --queue=backups --tries=1 --timeout=600', scheduler: 'php artisan schedule:work' },
    },
  };
}
function roles() {
  const permissions = permissionCatalog().flatMap((group) => group.permissions.map((permission) => ({
    ...permission,
    module: group.module,
  })));

  return [
    { id: 1, name: 'admin', label: 'Admin', protected: true, permissions },
    { id: 2, name: 'cajero', label: 'Cajero', protected: false, permissions: permissions.filter((permission) => ['catalog.view', 'cash.view', 'invoices.create', 'payments.create', 'receipts.view'].includes(permission.name)) },
  ];
}

function permissionCatalog() {
  return [
    { module: 'Facturacion', permissions: [{ name: 'invoices.create', label: 'Crear facturas' }, { name: 'invoices.view', label: 'Ver historial' }] },
    { module: 'Caja', permissions: [{ name: 'cash.view', label: 'Ver caja' }, { name: 'payments.create', label: 'Registrar pagos' }] },
    { module: 'Usuarios', permissions: [{ name: 'users.view', label: 'Ver usuarios' }, { name: 'users.assign_admin_role', label: 'Gestionar administradores' }] },
  ];
}
