import { expect, test, type Page, type Route } from '@playwright/test';

const reportUser = {
  id: 81,
  name: 'Supervisora Reportes',
  email: 'reportes@hospital.local',
  username: 'reportes.supervisora',
  active: true,
  roles: ['supervisor'],
  permissions: ['reports.view', 'reports.managerial.view', 'reports.cash_session.view', 'reports.export', 'audit.view'],
  must_change_password: false,
};

const reportPeriod = { from: '2026-06-15', to: '2026-06-16', days: 2, timezone: 'America/Tegucigalpa' };

test.describe('Reports - critical mocked e2e (3 sub-routes)', () => {
  test('executive report applies date filters and requests PDF and Excel exports', async ({ page }) => {
    let lastExecutiveQuery = new URLSearchParams();
    let pdfExports = 0;
    let excelExports = 0;

    await installReportsMocks(page, {
      onExecutiveReport: (params) => {
        lastExecutiveQuery = params;
      },
      onPdfExport: () => {
        pdfExports += 1;
      },
      onExcelExport: () => {
        excelExports += 1;
      },
    });

    await page.goto('/reports/executive');

    await expect(page.getByRole('heading', { level: 1, name: /control ejecutivo/i })).toBeVisible();
    await expect(page.getByText(/total facturado/i)).toBeVisible();
    await expect(page.getByText(/glucosa basal/i)).toBeVisible();

    await page.getByLabel(/inicio ejecutivo/i).fill(reportPeriod.from);
    await page.getByLabel(/fin ejecutivo/i).fill(reportPeriod.to);
    await page.getByRole('button', { name: /refrescar ejecutivo/i }).click();

    await expect.poll(() => lastExecutiveQuery.get('date_from')).toBe(reportPeriod.from);
    await expect.poll(() => lastExecutiveQuery.get('date_to')).toBe(reportPeriod.to);

    await page.getByRole('button', { name: /pdf ejecutivo/i }).click();
    await expect.poll(() => pdfExports).toBe(1);

    await page.getByRole('button', { name: /excel ejecutivo/i }).click();
    await expect.poll(() => excelExports).toBe(1);
  });

  test('cash sub-route loads a cash session report by caja number', async ({ page }) => {
    let requestedCashSessionId = '';
    await installReportsMocks(page, {
      onCashReport: (id) => {
        requestedCashSessionId = id;
      },
    });

    await page.goto('/reports/cash');

    await expect(page.getByText(/operacion de caja/i).first()).toBeVisible();
    await page.getByLabel(/numero de caja/i).fill('7');
    await page.getByRole('button', { name: /ver caja/i }).click();

    await expect.poll(() => requestedCashSessionId).toBe('7');
    await expect(page.getByRole('cell', { name: 'Administradora Hospital' })).toBeVisible();
    await expect(page.getByRole('region', { name: /pagos registrados/i })).toContainText('Maria Lopez');
    await expect(page.getByRole('region', { name: /totales por metodo/i })).toContainText('Efectivo');
  });

  test('audit sub-route exposes institutional audit counters', async ({ page }) => {
    await installReportsMocks(page);

    await page.goto('/reports/audit');

    await expect(page.getByText(/auditoria institucional/i)).toBeVisible();
    await expect(page.getByText(/eventos criticos/i)).toBeVisible();
    await expect(page.getByText(/reimpresiones/i)).toBeVisible();
    await expect(page.getByText(/eventos de respaldo/i)).toBeVisible();
  });

  test('mobile report navigation wraps without horizontal page overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await installReportsMocks(page);

    await page.goto('/reports');

    const navigation = page.getByRole('navigation', { name: /secciones de reportes/i });
    await expect(navigation).toBeVisible();
    await expect(page.getByRole('link', { name: /ejecutivo/i })).toHaveAttribute('aria-current', 'page');
    await page.getByRole('link', { name: /caja/i }).click();
    await expect(page.getByRole('link', { name: /caja/i })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText(/operacion de caja/i).first()).toBeVisible();

    await expectNoHorizontalPageOverflow(page);
    const navOverflow = await navigation.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(navOverflow).toBeLessThanOrEqual(1);
  });
});

async function installReportsMocks(
  page: Page,
  options: {
    onExecutiveReport?: (params: URLSearchParams) => void;
    onPdfExport?: () => void;
    onExcelExport?: () => void;
    onCashReport?: (id: string) => void;
  } = {},
) {
  await page.addInitScript(() => {
    window.open = () => null;
  });
  await installCommonMocks(page);
  await page.route(/\/api\/reports\/executive\/pdf(?:\?.*)?$/, (route) => {
    options.onPdfExport?.();
    return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-report' });
  });
  await page.route(/\/api\/reports\/executive\/excel(?:\?.*)?$/, (route) => {
    options.onExcelExport?.();
    return route.fulfill({ status: 200, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', body: 'xlsx' });
  });
  await page.route(/\/api\/reports\/executive(?:\?.*)?$/, (route) => {
    const params = new URL(route.request().url()).searchParams;
    options.onExecutiveReport?.(new URLSearchParams(params));
    return json(route, { data: executiveReport(params.get('date_from') ?? reportPeriod.from, params.get('date_to') ?? reportPeriod.to) });
  });
  await page.route(/\/api\/reports\/cash-sessions\/\d+(?:[/?]|$)/, (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    options.onCashReport?.(id);
    return json(route, { data: cashSessionReport(Number(id)) });
  });
}

function executiveReport(from: string, to: string) {
  return {
    period: { from, to, days: from === to ? 1 : 2, timezone: 'America/Tegucigalpa' },
    filters: { cash_session_id: null, user_id: null, category_id: null, area_id: null, method: null, status: null },
    comparison: {
      billed: { current: '340.00', previous: '250.00', delta_cents: 9000, delta_percentage: 36 },
      collected: { current: '315.00', previous: '250.00', delta_cents: 6500, delta_percentage: 26 },
      previous_period: { from: '2026-06-13', to: '2026-06-14' },
    },
    summary: {
      billed_total: '340.00',
      collected_total: '315.00',
      collected_total_cents: 31500,
      pending_total: '25.00',
      voided_total: '15.00',
      reversed_total: '0.00',
      invoice_count: 5,
      receipt_count: 4,
      paid_count: 4,
      partial_count: 1,
      pending_count: 1,
      voided_count: 1,
      average_ticket: '68.00',
    },
    payment_methods: [
      { method: 'cash', label: 'Efectivo', amount: '200.00', count: 3, percentage: 63.49 },
      { method: 'transfer', label: 'Transferencia', amount: '115.00', count: 1, percentage: 36.51 },
      { method: 'card', label: 'Tarjeta', amount: '0.00', count: 0, percentage: 0 },
      { method: 'other', label: 'Otro', amount: '0.00', count: 0, percentage: 0 },
    ],
    daily_trend: [
      { date: from, billed: '170.00', collected: '150.00', pending: '20.00', voided_count: 0, invoice_count: 2 },
      { date: to, billed: '170.00', collected: '165.00', pending: '5.00', voided_count: 1, invoice_count: 3 },
    ],
    services: {
      top_by_amount: [{ service: 'Glucosa basal', category: 'Laboratorio', item_count: 3, quantity: '3.00', total: '51.75', collected: '51.75' }],
      top_by_quantity: [{ service: 'Hemograma completo', category: 'Laboratorio', item_count: 2, quantity: '2.00', total: '180.00' }],
      by_category: [{ category: 'Laboratorio', quantity: '5.00', total: '231.75', collected: '231.75', item_count: 5 }],
      by_area: [{ area_id: 1, area: 'Laboratorio', item_count: 5, quantity: '5.00', total: '231.75' }],
    },
    cashiers: [{
      user_id: 1,
      name: 'Administradora Hospital',
      username: 'admin.validacion',
      invoice_count: 5,
      payment_count: 4,
      collected: '315.00',
      cash: '200.00',
      transfer: '115.00',
      card: '0.00',
      other: '0.00',
      voided_count: 1,
      difference_total: '-5.00',
    }],
    cash_sessions: [{
      id: 7,
      cashier: 'Administradora Hospital',
      opened_at: '2026-06-15T08:00:00-06:00',
      closed_at: '2026-06-15T16:00:00-06:00',
      opening_amount: '500.00',
      expected_cash: '700.00',
      counted_cash: '695.00',
      difference: '-5.00',
      status: 'closed',
      closure_note: 'Faltante autorizado',
    }],
    pending_aging: {
      '0_7_days': { count: 1, amount: '25.00' },
      '8_30_days': { count: 0, amount: '0.00' },
      '31_plus_days': { count: 0, amount: '0.00' },
      items: [{
        invoice_number: '000-001-01-00000079',
        patient: 'Jose Rivera',
        total: '25.00',
        balance_due: '25.00',
        issued_at: '2026-06-16T09:00:00-06:00',
        age_days: 1,
        bucket: '0_7_days',
      }],
    },
    voids_and_reversals: [{
      kind: 'void',
      invoice_number: '000-001-01-00000078',
      patient: 'Ana Cruz',
      amount: '15.00',
      reason: 'Duplicada',
      user: 'Administradora Hospital',
      authorized_by: 'Administradora Hospital',
      created_at: '2026-06-16T10:00:00-06:00',
    }],
    audit_summary: {
      critical_events: 2,
      reprints: 1,
      fiscal_changes: 1,
      cash_differences: 1,
      backup_events: 1,
    },
  };
}

function cashSessionReport(id: number) {
  return {
    cash_session: {
      id,
      user_id: 1,
      user: { id: 1, name: 'Administradora Hospital', username: 'admin.validacion' },
      opening_amount: '500.00',
      closing_amount: '695.00',
      expected_amount: '700.00',
      expected_cash_amount: '700.00',
      difference_amount: '-5.00',
      status: 'closed',
      opening_notes: null,
      closing_notes: 'Faltante autorizado',
      opened_at: '2026-06-15T08:00:00-06:00',
      closed_at: '2026-06-15T16:00:00-06:00',
    },
    totals_by_method: { cash: '200.00', transfer: '115.00', card: '0.00', other: '0.00' },
    total_cash: '200.00',
    total_transfer: '115.00',
    total_card: '0.00',
    total_other: '0.00',
    payments_count: 2,
    payments_total: '315.00',
    expected_cash_amount: '700.00',
    pending_invoice_count: 1,
    pending_amount: '25.00',
    payments: [{
      id: 90,
      invoice_id: 77,
      cash_session_id: id,
      user_id: 1,
      method: 'cash',
      amount: '200.00',
      reference: null,
      status: 'posted',
      paid_at: '2026-06-15T09:00:00-06:00',
      invoice: {
        id: 77,
        invoice_number: '000-001-01-00000077',
        patient_name: 'Maria Lopez',
        status: 'paid',
        total: '200.00',
        paid_amount: '200.00',
        balance_due: '0.00',
      },
      user: { id: 1, name: 'Administradora Hospital', username: 'admin.validacion' },
    }],
    movements: [{
      id: 1,
      cash_session_id: id,
      payment_id: null,
      user_id: 1,
      type: 'closing',
      method: 'closing',
      amount: '-5.00',
      notes: 'Faltante autorizado',
      occurred_at: '2026-06-15T16:00:00-06:00',
      user: { id: 1, name: 'Administradora Hospital', username: 'admin.validacion' },
    }],
  };
}

async function installCommonMocks(page: Page) {
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/auth/session', (route) => json(route, { data: reportUser }));
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

async function expectNoHorizontalPageOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
