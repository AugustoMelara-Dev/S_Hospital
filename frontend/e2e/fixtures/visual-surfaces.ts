import { expect, type Page, type Route } from '@playwright/test';
import {
  ERYTHROPOIETIN_RULE,
  currencyTotals,
  installCatalog,
  installAdminApi,
  installPreview,
  json,
  openCashSessionFixture,
  type CatalogCategory,
  type CatalogService,
  type AdminTestUser,
  type PreviewInput,
} from './admin-e2e';

/**
 * Mocks E2E de las superficies nuevas "Panel administrativo", extraídos de
 * `e2e/visual-capture.spec.ts` (T-QA-03/T-QA-05) para reutilizarlos desde
 * `e2e/a11y-audit.spec.ts` (T-QA-06) sin duplicar handlers.
 *
 * Todo es sintético y desechable: no hay backend detrás. Cada endpoint no
 * declarado lo captura `installFallback` y queda listado en `getUnexpectedApis()`.
 */

const unexpectedApis = new Set<string>();

/** Endpoints `/api/**` no declarados vistos durante la corrida (orden estable). */
export function getUnexpectedApis(): string[] {
  return [...unexpectedApis].sort();
}

export function resetUnexpectedApis(): void {
  unexpectedApis.clear();
}

export type LayoutMetrics = { scrollWidth: number; clientWidth: number };

export async function layoutMetrics(page: Page): Promise<LayoutMetrics> {
  return page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
}

/**
 * Catch-all registrado ANTES que los mocks específicos: Playwright resuelve las
 * rutas en orden inverso de registro, así que los mocks concretos ganan. Sirve
 * para que una llamada no declarada no rompa la captura; queda listada en
 * `unexpected_api_requests`.
 */
export async function installFallback(page: Page, label = 'desconocido'): Promise<void> {
  await page.route(
    (url) => url.pathname.startsWith('/api/'),
    (route) => {
      const request = route.request();
      unexpectedApis.add(`[${label}] ${request.method()} ${new URL(request.url()).pathname}`);
      return json(route, { data: [] });
    },
  );
}

export const VISUAL_USER: AdminTestUser = {
  id: 81,
  name: 'Revisora Visual',
  email: 'visual@hospital.local',
  username: 'visual.qa',
  active: true,
  roles: ['admin'],
  permissions: [
    'catalog.view',
    'catalog.manage',
    'cash.view',
    'cash.open',
    'cash.close',
    'invoices.create',
    'invoices.view',
    'invoices.void',
    'invoices.reverse',
    'invoices.operate_any',
    'payments.create',
    'receipts.view',
    'receipts.reprint',
    'reports.managerial.view',
    'reports.cash_session.view',
    'audit.view',
    'reports.export',
    'users.view',
    'settings.fiscal.view',
    'receipt_settings.view',
    'backups.view',
    'system.status.view',
    'patients.mark_dialysis_prescription',
  ],
  must_change_password: false,
};

export const VISUAL_CASH_SESSION = openCashSessionFixture({
  user_id: VISUAL_USER.id,
  user: { id: VISUAL_USER.id, name: VISUAL_USER.name, username: VISUAL_USER.username },
});

const BRANDING = {
  data: {
    hospital_name: 'Hospital San Isidro',
    primary_color: 'indigo',
    slogan: 'Sistema LAN',
    government_line: null,
    secretariat_line: null,
    receipt_location: 'Tocoa',
  },
};

// --- Login (sin sesión) ----------------------------------------------------

export async function installLoginSurface(page: Page): Promise<void> {
  await installFallback(page, 'login');
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/auth/session', (route) => json(route, { data: null }));
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthenticated.' }),
    }),
  );
  await page.route('**/api/settings/branding', (route) => json(route, BRANDING));
  await page.route('**/api/settings/logo', (route) => json(route, { logo_url: null }));
}

// --- Cobrar ----------------------------------------------------------------

const CATEGORY: CatalogCategory = { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true };

const GLUCOSE: CatalogService = {
  id: 11,
  category_id: 1,
  name: 'Glucosa basal',
  slug: 'glucosa-basal',
  price: '15.00',
  taxable: true,
  active: true,
  visible_in_billing: true,
  is_billable: true,
  special_rule_code: null,
  category: { id: 1, name: 'Laboratorio' },
};

const ERYTHROPOIETIN: CatalogService = {
  id: 33,
  category_id: 1,
  name: 'Eritropoyetina',
  slug: 'eritropoyetina',
  price: '2500.00',
  taxable: false,
  active: true,
  visible_in_billing: true,
  is_billable: true,
  special_rule_code: ERYTHROPOIETIN_RULE,
  category: { id: 1, name: 'Medicamentos' },
};

const SERVICES = [GLUCOSE, ERYTHROPOIETIN];

function serviceById(id: number): CatalogService {
  const service = SERVICES.find((candidate) => candidate.id === id);
  if (!service) throw new Error(`Servicio sintético desconocido: ${id}`);
  return service;
}

/**
 * Espejo de la regla por línea y del contrato del servidor
 * (`CalculateInvoiceTotalsAction`):
 * - el elegible con receta queda a 0 y NO aporta base exenta (`exempt_cents`);
 * - `exempt` es la parte no gravable COBRABLE (`subtotal - base gravable`).
 */
export function buildPreview(input: PreviewInput): unknown {
  let subtotalCents = 0;
  let taxCents = 0;
  let exemptCents = 0;

  for (const item of input.items) {
    const service = serviceById(item.service_id);
    const quantity = Number(item.quantity);
    const lineCents = Math.round(Number(service.price) * 100) * quantity;
    const free = service.special_rule_code === ERYTHROPOIETIN_RULE && input.dialysis_prescription === true;

    // La línea sin cobro aporta 0 a subtotal, exento e ISV.
    if (free) continue;

    subtotalCents += lineCents;
    if (service.taxable) {
      taxCents += Math.round(lineCents * 0.15);
    } else {
      exemptCents += lineCents;
    }
  }

  return currencyTotals({
    subtotalCents,
    taxCents,
    totalCents: subtotalCents + taxCents,
    exemptCents,
  });
}

function invoiceFixture(patientName: string, total: string, balanceDue: string) {
  return {
    id: 77,
    invoice_number: '000-001-01-00000077',
    patient_name: patientName,
    subtotal: total,
    tax_amount: '0.00',
    discount_amount: '0.00',
    total,
    paid_amount: '0.00',
    balance_due: balanceDue,
    status: 'issued',
    issued_at: '2026-09-18T09:00:00-06:00',
    items: [],
  };
}

/**
 * Comprobante institucional de Cobrar (T-QA-05). El importe no se dibuja en la
 * zona Resultado; solo habilita Imprimir / Guardar PDF.
 */
const COBRAR_RECEIPT = {
  id: 78,
  invoice_id: 77,
  payment_id: 90,
  cash_session_id: 7,
  receipt_number: 78,
  receipt_number_full: 'REC-A-00000078',
  status: 'issued',
  amount: '0.00',
  issued_at: '2026-09-18T09:05:00-06:00',
  reprint_count: 0,
  template_code: 'institutional_compact',
  print_profile_code: 'carta_vertical',
  copy_mode: 'original_only',
};

export async function installCobrarMocks(
  page: Page,
  options: { invoiceTotal?: string } = {},
): Promise<void> {
  const invoiceTotal = options.invoiceTotal ?? '17.25';

  await installFallback(page, 'cobrar');
  await installAdminApi(page, { user: VISUAL_USER, cashSession: VISUAL_CASH_SESSION });
  await installCatalog(page, { categories: [CATEGORY], services: SERVICES });
  await installPreview(page, buildPreview);

  await page.route(/\/api\/invoices(?:\?.*)?$/, (route: Route) => {
    if (route.request().method() !== 'POST') {
      return json(route, { data: [], meta: { current_page: 1, per_page: 10, total: 0 } });
    }
    const payload = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    const patient = String(payload.patient_name ?? 'Paciente');
    return json(route, { data: invoiceFixture(patient, invoiceTotal, invoiceTotal) }, 201);
  });

  await page.route(/\/api\/invoices\/\d+\/payments$/, (route: Route) => {
    const payload = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    return json(
      route,
      {
        data: {
          payment: {
            id: 90,
            invoice_id: 77,
            amount: payload.amount,
            method: payload.method,
            status: 'posted',
            paid_at: '2026-09-18T09:05:00-06:00',
          },
          invoice: {
            ...invoiceFixture('Paciente', invoiceTotal, '0.00'),
            status: 'paid',
            paid_amount: invoiceTotal,
          },
          institutional_receipt: COBRAR_RECEIPT,
          institutional_receipt_error: null,
          receipt_outcome: 'issued',
        },
      },
      201,
    );
  });

  await page.route(/\/api\/institutional-receipts$/, (route) =>
    json(route, { data: COBRAR_RECEIPT }, 201),
  );
}

/** EPO sola con receta de diálisis: el servidor confirma total L. 0.00. */
export async function prepareZeroCart(page: Page): Promise<void> {
  await page.goto('/cobrar');
  await expect(page.getByRole('heading', { level: 1, name: /^cobrar$/i })).toBeVisible();
  await page.getByLabel(/nombre del paciente/i).fill('Paciente EPO');
  await addService(page, 'Eritropoyetina');
  await page.getByRole('checkbox', { name: /paciente con receta de diálisis/i }).check();
  await expect(
    page.locator('[aria-label="Líneas de la cuenta"]').getByText(/sin cobro por receta/i),
  ).toBeVisible();
  const totalZone = page.getByRole('complementary', { name: /total y acción/i });
  await expect(totalZone.getByText('L. 0.00', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
}

export async function addService(page: Page, name: string): Promise<void> {
  // Re-anclado al contrato vivo del rediseño (Dark 2026-10-16): tras cada
  // agregado CatalogZone colapsa los resultados (`resultsDismissed`), y el fill
  // del buscador los re-activa (`handleSearchChange`); el mock de
  // `/api/services` filtra por nombre. La nota histórica T-QA-02 (buscador con
  // ancho 0 px) ya no aplica: AdminSearch actual mide min-w 15rem.
  const searchBox = page.getByLabel(/buscar servicio o producto/i);
  await searchBox.fill(name);
  const addButton = page.getByRole('button', { name: new RegExp(`agregar ${name}`, 'i') }).first();
  await expect(addButton).toBeVisible({ timeout: 10_000 });
  await addButton.click();
  await expect(
    page.locator('[aria-label="Líneas de la cuenta"]').getByText(name, { exact: false }).first(),
  ).toBeVisible();
}

export async function prepareMixedCart(page: Page): Promise<void> {
  await page.goto('/cobrar');
  await expect(page.getByRole('heading', { level: 1, name: /^cobrar$/i })).toBeVisible();
  await page.getByLabel(/nombre del paciente/i).fill('Maria Lopez');
  await addService(page, 'Eritropoyetina');
  await addService(page, 'Glucosa basal');
  await page.getByRole('checkbox', { name: /paciente con receta de diálisis/i }).check();
  await expect(
    page.locator('[aria-label="Líneas de la cuenta"]').getByText(/sin cobro por receta/i),
  ).toBeVisible();
  const totalZone = page.getByRole('complementary', { name: /total y acción/i });
  await expect(totalZone.getByText('L. 17.25', { exact: true })).toBeVisible({ timeout: 10_000 });
  // El exento es el del servidor: la línea gratuita aporta 0, no su precio registrado.
  await expect(totalZone.getByText('L. 0.00', { exact: true })).toBeVisible();
  await expect(totalZone.getByText('L. 2,500.00', { exact: true })).toHaveCount(0);
}

// --- Recibos ---------------------------------------------------------------

const INSTITUTIONAL_RECEIPT = {
  id: 700,
  receipt_number_full: 'REC-00000070',
  status: 'issued',
  issued_at: '2026-09-18T09:45:00-06:00',
  reprint_count: 1,
  has_print_events: true,
  print_events_count: 1,
};

const ISSUED_INVOICE = {
  id: 501,
  invoice_number: 'A-0001',
  patient_name: 'Maria Lopez',
  subtotal: '217.39',
  tax_amount: '32.61',
  discount_amount: '0.00',
  total: '250.00',
  paid_amount: '0.00',
  balance_due: '250.00',
  status: 'issued',
  payment_status: 'pending',
  issued_at: '2026-09-18T09:30:00-06:00',
  void_reason: null,
  voided_at: null,
  user_id: VISUAL_USER.id,
  cash_session_id: 7,
  issuer: { id: VISUAL_USER.id, name: VISUAL_USER.name, username: VISUAL_USER.username },
  voided_by: null,
  // Líneas reales del detalle: `GET /api/invoices/{id}` devuelve `items`, no
  // solo totales. La suma coincide con subtotal 217.39 / ISV 32.61 / total 250.00
  // (137.39 + 80.00 = 217.39; 20.61 + 12.00 = 32.61) e incluye la línea gratuita
  // de eritropoyetina con `special_rule_applied` para ejercitar el ajuste.
  items: [
    {
      id: 9001,
      service_id: 11,
      service_name: 'Glucosa basal',
      category_id: 1,
      category_name: 'Laboratorio',
      quantity: '1.00',
      unit_price: '137.39',
      tax_rate: '15.00',
      tax_amount: '20.61',
      line_subtotal: '137.39',
      line_total: '158.00',
      special_rule_code: null,
      special_rule_applied: false,
      notes: null,
    },
    {
      id: 9002,
      service_id: 12,
      service_name: 'Hemograma completo',
      category_id: 1,
      category_name: 'Laboratorio',
      quantity: '2.00',
      unit_price: '40.00',
      tax_rate: '15.00',
      tax_amount: '12.00',
      line_subtotal: '80.00',
      line_total: '92.00',
      special_rule_code: null,
      special_rule_applied: false,
      notes: null,
    },
    {
      id: 9003,
      service_id: 33,
      service_name: 'Eritropoyetina',
      category_id: 1,
      category_name: 'Medicamentos',
      quantity: '1.00',
      unit_price: '2500.00',
      tax_rate: '0.00',
      tax_amount: '0.00',
      line_subtotal: '0.00',
      line_total: '0.00',
      special_rule_code: ERYTHROPOIETIN_RULE,
      special_rule_applied: true,
      notes: null,
    },
  ],
  payments: [],
  institutional_receipt: null,
};

const PAID_INVOICE = {
  ...ISSUED_INVOICE,
  id: 502,
  invoice_number: 'A-0002',
  patient_name: 'Carlos Rivera',
  total: '180.00',
  paid_amount: '180.00',
  balance_due: '0.00',
  status: 'paid',
  payment_status: 'paid',
  institutional_receipt: INSTITUTIONAL_RECEIPT,
};

export async function installRecibosMocks(page: Page): Promise<void> {
  await installFallback(page, 'recibos');
  await installAdminApi(page, { user: VISUAL_USER, cashSession: VISUAL_CASH_SESSION });

  await page.route(/\/api\/invoices(?:\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    const patient = (url.searchParams.get('patient') ?? '').toLowerCase();
    const invoices = [ISSUED_INVOICE, PAID_INVOICE].filter(
      (invoice) => !patient || invoice.patient_name.toLowerCase().includes(patient),
    );
    return json(route, {
      data: invoices,
      meta: {
        current_page: 1,
        from: invoices.length ? 1 : null,
        last_page: 1,
        path: '/api/invoices',
        per_page: 10,
        to: invoices.length,
        total: invoices.length,
      },
    });
  });

  await page.route(/\/api\/invoices\/\d+(?:\?.*)?$/, (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/').at(-1));
    const invoice = id === PAID_INVOICE.id ? PAID_INVOICE : ISSUED_INVOICE;
    return json(route, { data: invoice });
  });

  await page.route(/\/api\/cash-sessions(?:\?.*)?$/, (route) =>
    json(route, {
      data: [openCashSessionFixture({ status: 'closed', closed_at: '2026-09-18T16:00:00-06:00' })],
      meta: { current_page: 1, per_page: 50, total: 1 },
    }),
  );

  await page.route(/\/api\/settings\/institutional-receipts(?:\?.*)?$/, (route) =>
    json(route, {
      data: {
        institution: null,
        active_series: null,
        series: [],
        print_profiles: [],
        assignments: [],
        resolved_profile: {
          id: 1,
          code: 'carta_vertical',
          name: 'Carta vertical',
          copies_mode: 'original_only',
          show_copy_legend: false,
          show_physical_seal_space: false,
          use_logo: true,
          active: true,
          is_global_default: true,
        },
      },
    }),
  );

  await page.route(/\/api\/institutional-receipts\/\d+\/pdf(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: '<!doctype html><html><body><section class="receipt-page"><span class="chip">ORIGINAL</span><h1>REC-00000070</h1></section></body></html>',
    }),
  );
}

// --- Caja ------------------------------------------------------------------

export async function installCajaMocks(page: Page): Promise<void> {
  await installFallback(page, 'caja');
  await installAdminApi(page, { user: VISUAL_USER, cashSession: VISUAL_CASH_SESSION });
  await page.route(/\/api\/reports\/cash-sessions\/\d+(?:\?.*)?$/, (route) =>
    json(route, { data: { movements: [], payments: [] } }),
  );
}

// --- Reportes --------------------------------------------------------------

/**
 * Contrato real: `ExecutiveReportService::period` llama a `inclusiveDays()`
 * (backend/app/Actions/Reports/ExecutiveReportService.php:118 y :1199), que
 * devuelve los días INCLUSIVOS del rango (01..30 jun → 30; ver
 * backend/tests/Feature/Reports/ExecutiveExportEvidenceTest.php:316). El
 * fixture NO fija el número: lo deriva del rango, porque el rango por defecto
 * de /reportes es «este mes» (01..22 sep al ejecutarlo el 22 sep) y un
 * `days: 2` fijo contradecía `from`/`to` en la misma respuesta.
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
        rule_code: ERYTHROPOIETIN_RULE,
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
        rule_code: ERYTHROPOIETIN_RULE,
        reason: 'Receta de diálisis',
        settlement: 'free_by_rule',
      },
    ],
  };
}

export async function installReportesMocks(page: Page): Promise<void> {
  await installFallback(page, 'reportes');
  await installAdminApi(page, { user: VISUAL_USER, cashSession: VISUAL_CASH_SESSION });

  await page.route(/\/api\/cash-sessions(?:\?.*)?$/, (route) =>
    json(route, {
      data: [openCashSessionFixture({ status: 'closed', closed_at: '2026-09-01T16:00:00-06:00' })],
      meta: { current_page: 1, per_page: 50, total: 1 },
    }),
  );
  await page.route(/\/api\/categories(?:\?.*)?$/, (route) =>
    json(route, { data: [{ id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true }] }),
  );
  await page.route(/\/api\/reports\/executive(?:\?.*)?$/, (route: Route) => {
    const params = new URL(route.request().url()).searchParams;
    return json(route, {
      data: executiveReport(params.get('date_from') ?? '2026-09-01', params.get('date_to') ?? '2026-09-02'),
    });
  });
}

// --- Resumen ---------------------------------------------------------------

function todayReport() {
  return {
    date: '2026-09-18',
    timezone: 'America/Tegucigalpa',
    server_time: '2026-09-18T10:00:00-06:00',
    cash_session_open: true,
    cash_session_id: 7,
    cash_session_opened_at: '2026-09-18T08:00:00-06:00',
    cash_session_opening_amount: '500.00',
    issued_count: 2,
    collected_count: 1,
    billed: '250.00',
    collected: '180.00',
    pending: '70.00',
    voided_count: 0,
    voided_amount: '0.00',
    reversal_count: 0,
    pending_invoice_count: 1,
    pending_invoice_amount: '70.00',
    payments_by_method: { cash: '180.00', transfer: '0.00', card: '0.00', other: '0.00' },
    payments_count_by_method: { cash: 1, transfer: 0, card: 0, other: 0 },
    backup_pending: false,
    backup_pending_age_hours: null,
  };
}

const RESUMEN_INVOICES = [
  {
    id: 501,
    invoice_number: 'A-0001',
    patient_name: 'Maria Lopez',
    total: '250.00',
    status: 'issued',
    issued_at: '2026-09-18T09:30:00-06:00',
  },
  {
    id: 502,
    invoice_number: 'A-0002',
    patient_name: 'Carlos Rivera',
    total: '0.00',
    status: 'paid',
    issued_at: '2026-09-18T09:45:00-06:00',
  },
];

export async function installResumenMocks(page: Page): Promise<void> {
  await installFallback(page, 'resumen');
  await installAdminApi(page, { user: VISUAL_USER, cashSession: VISUAL_CASH_SESSION });
  await page.route(/\/api\/reports\/today(?:\?.*)?$/, (route) => json(route, { data: todayReport() }));
  await page.route(/\/api\/invoices(?:\?.*)?$/, (route) =>
    json(route, {
      data: RESUMEN_INVOICES,
      meta: {
        current_page: 1,
        from: 1,
        last_page: 1,
        path: '/api/invoices',
        per_page: 8,
        to: RESUMEN_INVOICES.length,
        total: RESUMEN_INVOICES.length,
      },
    }),
  );
}

// --- Administración / Catálogo ---------------------------------------------

export async function installCatalogAdminMocks(page: Page): Promise<void> {
  await installFallback(page, 'catalogo-admin');
  await installAdminApi(page, { user: VISUAL_USER, cashSession: VISUAL_CASH_SESSION });
  await page.route(/\/api\/categories(?:\?.*)?$/, (route) => json(route, { data: [CATEGORY] }));
  await page.route(/\/api\/areas(?:\?.*)?$/, (route) =>
    json(route, { data: [{ id: 1, name: 'Laboratorio', active: true }] }),
  );
  await page.route(/\/api\/services(?:\?.*)?$/, (route) =>
    json(route, {
      data: SERVICES,
      meta: {
        current_page: 1,
        from: 1,
        last_page: 1,
        path: '/api/services',
        per_page: 15,
        to: SERVICES.length,
        total: SERVICES.length,
      },
    }),
  );
}
