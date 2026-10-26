import { expect, test, type Page, type Route } from '@playwright/test';
import { assertStrictMockGuard, installStrictMockGuard } from './fixtures/strict-mock-guard';
import { installAdminApi, json, openCashSessionFixture, type AdminTestUser } from './fixtures/admin-e2e';
import { installCashSessionOptions } from './fixtures/cash-options';

/**
 * Reportes — filtros de período y exportación sobre el producto nuevo.
 * El reporte ejecutivo es un fixture sintético con las secciones nuevas
 * (`operations`, `detail`, `collections`, `gratuities`).
 */

test.beforeEach(async ({ page }) => installStrictMockGuard(page));
test.afterEach(async ({ page }) => assertStrictMockGuard(page));

const SUPERVISOR: AdminTestUser = {
  id: 81,
  name: 'Supervisora Reportes',
  email: 'reportes@hospital.local',
  username: 'reportes.supervisora',
  active: true,
  roles: ['supervisor'],
  permissions: ['reports.managerial.view', 'reports.export'],
  must_change_password: false,
};

/**
 * Contrato real: `ExecutiveReportService::period` llama a `inclusiveDays()`
 * (backend/app/Actions/Reports/ExecutiveReportService.php:118 y :1199): días
 * INCLUSIVOS del rango (01..30 jun → 30, ver
 * backend/tests/Feature/Reports/ExecutiveExportEvidenceTest.php:316). El valor
 * se deriva de `from`/`to` en lugar de fijarlo a 2, de modo que la respuesta
 * sea coherente con el período que pide la UI.
 */
function inclusiveDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

/** Día operativo corrido (UTC sobre la fecha calendario), para el período previo. */
function shiftDays(iso: string, delta: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + delta * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function executiveReport(from: string, to: string) {
  // Espejo de `comparison()` del backend: el período previo dura lo mismo que el
  // rango y termina el día antes de `from` (ExecutiveReportService.php:1161-1163).
  const days = inclusiveDays(from, to);
  const previous = { from: shiftDays(from, -days), to: shiftDays(from, -1) };
  return {
    period: { from, to, timezone: 'America/Tegucigalpa', days },
    filters: { cash_session_id: null, user_id: null, category_id: null, area_id: null, method: null, status: null },
    accounting_policy: {
      scope: 'operational_cash',
      expenses_supported: false,
      exclusions_already_applied: true,
      billed_definition: 'Facturas emitidas no anuladas.',
      collected_definition: 'Pagos posteados no reversados.',
    },
    comparison: {
      billed: { current: '340.00', previous: '250.00', delta_cents: 9000, delta_percentage: 36 },
      collected: { current: '315.00', previous: '250.00', delta_cents: 6500, delta_percentage: 26 },
      previous_period: previous,
    },
    summary: {
      billed_total: '340.00',
      collected_total: '315.00',
      collected_total_cents: 31500,
      pending_total: '25.00',
      voided_total: '0.00',
      reversed_total: '0.00',
      invoice_count: 2,
      receipt_count: 2,
      paid_count: 1,
      partial_count: 1,
      pending_count: 0,
      voided_count: 0,
      average_ticket: '170.00',
      without_charge_count: 1,
      gratuity_item_count: 1,
      gratuity_adjustment_total: '25.00',
      gratuity_adjustment_persisted: true,
    },
    payment_methods: [
      { method: 'cash', label: 'Efectivo', amount: '200.00', count: 1, percentage: 63.49 },
      { method: 'transfer', label: 'Transferencia', amount: '115.00', count: 1, percentage: 36.51 },
    ],
    daily_trend: [{ date: from, billed: '170.00', collected: '150.00', pending: '20.00', voided_count: 0, invoice_count: 1 }],
    services: { top_by_amount: [], top_by_quantity: [], by_category: [], by_area: [] },
    cashiers: [
      {
        user_id: 1,
        name: 'Administradora Hospital',
        username: 'admin.validacion',
        invoice_count: 2,
        payment_count: 2,
        collected: '315.00',
        cash: '200.00',
        transfer: '115.00',
        card: '0.00',
        other: '0.00',
        voided_count: 0,
        difference_total: '0.00',
      },
    ],
    cash_sessions: [
      {
        id: 7,
        cashier: 'Administradora Hospital',
        opened_at: '2026-09-01T08:00:00-06:00',
        closed_at: '2026-09-01T16:00:00-06:00',
        opening_amount: '500.00',
        expected_cash: '700.00',
        counted_cash: '700.00',
        difference: '0.00',
        status: 'closed',
        status_label: 'Cerrada',
        closure_note: null,
        cash_register_name: 'Caja principal',
        cash_register_code: 'CAJA-01',
      },
    ],
    pending_aging: {
      '0_7_days': { count: 1, amount: '25.00' },
      '8_30_days': { count: 0, amount: '0.00' },
      '31_plus_days': { count: 0, amount: '0.00' },
      items: [],
    },
    voids_and_reversals: [],
    audit_summary: { critical_events: 0, reprints: 1, fiscal_changes: 0, cash_differences: 0, backup_events: 0 },
    operations: [
      {
        date: from,
        invoice_number: '000-001-01-00000077',
        patient: 'Maria Lopez',
        cash_session_id: 7,
        cash_session_label: 'Caja #7',
        cashier: 'Administradora Hospital',
        total: '340.00',
        paid: '315.00',
        balance: '25.00',
        status: 'partial',
        status_label: 'Pago parcial',
        settlement: 'chargeable',
        settlement_label: 'Cobrable',
        receipt_document: 'REC-00000070',
      },
    ],
    detail: [
      {
        date: from,
        invoice_number: '000-001-01-00000077',
        patient: 'Maria Lopez',
        service: 'Eritropoyetina',
        category: 'Medicamentos',
        area: null,
        quantity: '1.00',
        unit_price: '2500.00',
        tax: '0.00',
        line_total: '0.00',
        rule_adjustment: '2500.00',
        rule_adjustment_persisted: true,
        is_free: true,
        rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
        rule_label: 'Sin cobro por receta de diálisis',
        settlement: 'free_by_rule',
      },
    ],
    collections: [
      {
        paid_at: '2026-09-01T09:00:00-06:00',
        invoice_number: '000-001-01-00000077',
        patient: 'Maria Lopez',
        cash_session_id: 7,
        cash_session_label: 'Caja #7',
        cashier: 'Administradora Hospital',
        method: 'cash',
        method_label: 'Efectivo',
        reference: null,
        amount: '200.00',
        status: 'posted',
        status_label: 'Pago registrado',
      },
    ],
    gratuities: [
      {
        date: from,
        invoice_number: '000-001-01-00000077',
        patient: 'Maria Lopez',
        service: 'Eritropoyetina',
        category: 'Medicamentos',
        quantity: '1.00',
        unit_price: '2500.00',
        line_total: '0.00',
        adjustment_value: '2500.00',
        adjustment_persisted: true,
        rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
        reason: 'Receta de diálisis',
        settlement: 'free_by_rule',
      },
    ],
  };
}

async function installReportesMocks(
  page: Page,
  options: {
    onExecutive?: (params: URLSearchParams) => void;
    onPdf?: () => void;
    onExcel?: () => void;
  } = {},
): Promise<void> {
  await installAdminApi(page, { user: SUPERVISOR, cashSession: openCashSessionFixture() });
  await installCashSessionOptions(page, () => [openCashSessionFixture({ status: 'closed', closed_at: '2026-09-01T16:00:00-06:00' })]);

  await page.route(/\/api\/cash-sessions(?:\?.*)?$/, (route) =>
    json(route, {
      data: [openCashSessionFixture({ status: 'closed', closed_at: '2026-09-01T16:00:00-06:00' })],
      meta: { current_page: 1, per_page: 50, total: 1 },
    }),
  );
  await page.route(/\/api\/categories(?:\?.*)?$/, (route) =>
    json(route, { data: [{ id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true }] }),
  );
  await page.route(/\/api\/reports\/executive\/pdf(?:\?.*)?$/, (route) => {
    options.onPdf?.();
    return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-report' });
  });
  await page.route(/\/api\/reports\/executive\/excel(?:\?.*)?$/, (route) => {
    options.onExcel?.();
    return route.fulfill({
      status: 200,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      body: 'xlsx',
    });
  });
  await page.route(/\/api\/reports\/executive(?:\?.*)?$/, (route: Route) => {
    const params = new URL(route.request().url()).searchParams;
    options.onExecutive?.(new URLSearchParams(params));
    return json(route, { data: executiveReport(params.get('date_from') ?? '2026-09-01', params.get('date_to') ?? '2026-09-02') });
  });
}

test.describe('Reportes — filtros y exportación', () => {
  test('aplica el período elegido y lo refleja en la consulta del servidor', async ({ page }) => {
    const queries: URLSearchParams[] = [];
    await installReportesMocks(page, { onExecutive: (params) => queries.push(params) });

    await page.goto('/reportes');
    await expect(page.getByRole('heading', { level: 1, name: /^reportes$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /resumen del período/i })).toBeVisible();
    await expect(page.getByText('Facturado', { exact: true })).toBeVisible();

    await page.getByLabel(/^desde$/i).fill('2026-09-01');
    await page.getByLabel(/^hasta$/i).fill('2026-09-02');
    await page.getByRole('button', { name: /^aplicar$/i }).click();

    await expect.poll(() => queries.at(-1)?.get('date_from') ?? null).toBe('2026-09-01');
    await expect.poll(() => queries.at(-1)?.get('date_to') ?? null).toBe('2026-09-02');
    // El alcance se muestra sin el párrafo interno «ámbito autorizado del servidor»
    // que el §47 prohíbe como decoración.
    const scope = page.getByTestId('reporte-scope');
    await expect(scope).toBeVisible();
    await expect(scope).not.toContainText(/ámbito autorizado del servidor/i);
  });

  test('exporta PDF y Excel con el período aplicado', async ({ page }) => {
    let pdfExports = 0;
    let excelExports = 0;
    await installReportesMocks(page, {
      onPdf: () => {
        pdfExports += 1;
      },
      onExcel: () => {
        excelExports += 1;
      },
    });

    await page.goto('/reportes');
    await page.getByLabel(/^desde$/i).fill('2026-09-01');
    await page.getByLabel(/^hasta$/i).fill('2026-09-02');
    await page.getByRole('button', { name: /^aplicar$/i }).click();

    const exportPdf = page.getByRole('button', { name: /exportar pdf/i });
    await expect(exportPdf).toBeEnabled();
    await exportPdf.click();
    await expect.poll(() => pdfExports).toBe(1);

    const exportExcel = page.getByRole('button', { name: /exportar excel/i });
    await expect(exportExcel).toBeEnabled();
    await exportExcel.click();
    await expect.poll(() => excelExports).toBe(1);
  });
});
