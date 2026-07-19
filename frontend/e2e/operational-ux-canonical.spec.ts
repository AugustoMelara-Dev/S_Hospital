import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';

import { assertStrictMockGuard, installStrictMockGuard } from './fixtures/strict-mock-guard';

const evidenceDirectory = resolve(process.cwd(), '..', 'qa', 'operational-ux', 'after', 'canonical');

test.beforeAll(() => mkdirSync(evidenceDirectory, { recursive: true }));
test.beforeEach(async ({ page }) => installStrictMockGuard(page));
test.afterEach(async ({ page }) => assertStrictMockGuard(page));

const admin = {
  id: 21,
  name: 'Ana Martínez',
  email: 'ana.martinez@hospital.local',
  username: 'ana.martinez',
  active: true,
  roles: ['admin'],
  permissions: [
    'catalog.view', 'catalog.manage', 'cash.view', 'cash.open', 'cash.close',
    'invoices.create', 'invoices.view', 'invoices.void', 'invoices.operate_any',
    'payments.create', 'receipts.view', 'receipts.reprint', 'receipts.reprint_any',
    'reports.managerial.view', 'reports.cash_session.view', 'settings.fiscal.view',
    'settings.fiscal.update', 'settings.operational.update', 'receipt_settings.view',
    'patients.mark_dialysis_prescription',
  ],
  must_change_password: false,
};

const categories = [
  { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
  { id: 2, name: 'Imágenes', slug: 'imagenes', active: true, sort_order: 2 },
  { id: 3, name: 'Medicamentos', slug: 'medicamentos', active: true, sort_order: 3 },
];
const areas = [
  { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true },
  { id: 2, name: 'Radiología', slug: 'radiologia', active: true },
  { id: 3, name: 'Farmacia', slug: 'farmacia', active: true },
];

function service(id: number, name: string, price: string, categoryIndex = 0) {
  const category = categories[categoryIndex];
  const area = areas[categoryIndex];
  return {
    id, category_id: category.id, area_id: area.id, name,
    slug: name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-'),
    aliases: null, scan_code: `SRV-${String(id).padStart(3, '0')}`, barcode: null,
    qr_code: null, description: null, internal_code: null, price, taxable: categoryIndex !== 2,
    active: true, visible_in_billing: true, is_billable: true,
    special_rule_code: name === 'Eritropoyetina' ? 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' : null,
    category, area,
  };
}

const services = [
  service(11, 'Glucosa basal', '125.00'),
  service(12, 'Hemograma completo', '180.00'),
  service(13, 'Perfil lipídico', '265.00'),
  service(14, 'Examen general de orina', '95.00'),
  service(21, 'Radiografía de tórax', '450.00', 1),
  service(31, 'Eritropoyetina', '25.00', 2),
];

const openSession = {
  id: 77, user_id: admin.id, opened_by: admin.id, opening_amount: '500.00',
  expected_cash_amount: '1845.00', expected_amount: '1845.00', cash_sales: '1345.00',
  cash_refunds: '0.00', payments_total: '1795.00', payments_count: 12,
  payments_by_method: { cash: '1345.00', transfer: '300.00', card: '150.00', other: '0.00' },
  pending_invoice_count: 2, pending_amount: '375.00', missing_institutional_receipt_count: 1,
  reversed_payments_count: 0, reversed_payments_total: '0.00', status: 'open',
  opening_notes: 'Apertura de turno matutino', closing_amount: null, closing_notes: null,
  opened_at: '2026-07-15T07:00:00-06:00', closed_at: null,
  created_at: '2026-07-15T07:00:00-06:00', updated_at: '2026-07-15T11:30:00-06:00',
  user: { id: admin.id, name: admin.name, username: admin.username },
};

const invoices = [
  invoice(501, '000-001-01-00000501', 'María José Hernández Álvarez', 'issued', '250.00'),
  invoice(502, '000-001-01-00000502', 'Carlos Rivera', 'paid', '180.00'),
];

function invoice(id: number, invoiceNumber: string, patientName: string, status: 'issued' | 'paid', total: string) {
  return {
    id, invoice_number: invoiceNumber, patient_name: patientName, subtotal: total,
    tax_amount: '0.00', discount_amount: '0.00', total,
    paid_amount: status === 'paid' ? total : '0.00', balance_due: status === 'paid' ? '0.00' : total,
    status, payment_status: status === 'paid' ? 'paid' : 'pending', issued_at: '2026-07-15T09:30:00-06:00',
    void_reason: null, voided_at: null, reversed_at: null, user_id: admin.id,
    cash_register_session_id: openSession.id, issuer: admin, voided_by: null,
    items: [], payments: [], institutional_receipt: status === 'paid' ? {
      id: 700, receipt_number_full: 'REC-A-00000502', status: 'issued',
      issued_at: '2026-07-15T09:35:00-06:00', reprint_count: 0,
      has_print_events: true, print_events_count: 1,
    } : null,
  };
}

const fiscalSettings = {
  id: 1, hospital_name: 'Hospital General San Isidro', rtn: '08011999000001',
  default_tax_rate: '15.00', primary_color: 'teal', address: 'Tocoa, Colón',
  phone: '2444-0000', email: 'administracion@sanisidro.local', slogan: 'Atención con dignidad',
  scanner_enabled: true, partial_payments_enabled: false, receipt_template_mode: 'institutional',
  receipt_paper_size: 'half_letter', government_line: 'Gobierno de Honduras',
  secretariat_line: 'Secretaría de Salud', receipt_location: 'Tocoa, Colón', receipt_footer_text: '',
};

test('01 · login', async ({ page }) => {
  await installPublicMocks(page);
  await capture(page, '/login', '01-login.png', { width: 1917, height: 1018 }, /iniciar sesi.n/i);
  await expect(page.getByText(/validando credenciales/i)).toHaveCount(0);
});

test('02 · dashboard', async ({ page }) => {
  await installAppMocks(page);
  await capture(page, '/dashboard', '02-dashboard.png', { width: 1917, height: 1027 }, /continuar operaci.n/i);
  await expect(page.getByRole('main').getByRole('link', { name: /nueva factura/i })).toBeVisible();
});

test('03 · facturación vacía', async ({ page }) => {
  await installAppMocks(page);
  await page.setViewportSize({ width: 1917, height: 1027 });
  await page.goto('/billing/new');
  await expect(page.getByLabel(/nombre del paciente/i)).toBeVisible();
  await expect(page.getByRole('region', { name: /cuenta actual/i })).toBeVisible();
  await save(page, '03-billing-empty.png');
});

test('04 · facturación con resultados', async ({ page }) => {
  await installAppMocks(page);
  await page.setViewportSize({ width: 1917, height: 1027 });
  await page.goto('/billing/new');
  await page.getByLabel(/nombre del paciente/i).fill('María José Hernández Álvarez');
  await page.getByLabel(/buscar por nombre/i).fill('a');
  await expect(page.getByText('Glucosa basal', { exact: true })).toBeVisible();
  await save(page, '04-billing-results.png');
});

test('05 · facturación con cuenta móvil', async ({ page }) => {
  await installAppMocks(page);
  await page.setViewportSize({ width: 672, height: 921 });
  await page.goto('/billing/new');
  await page.getByLabel(/nombre del paciente/i).fill('María José Hernández Álvarez');
  await page.getByLabel(/buscar por nombre/i).fill('glucosa');
  await page.getByRole('button', { name: /agregar glucosa basal/i }).click();
  await page.getByRole('button', { name: /ver cuenta/i }).click();
  await expect(page.getByRole('dialog')).toContainText('Glucosa basal');
  await save(page, '05-billing-cart.png');
});

test('06 · caja resumen', async ({ page }) => {
  await installAppMocks(page);
  await capture(page, '/cashbox', '06-cashbox-summary.png', { width: 1917, height: 1032 }, /^caja$/i);
  await expect(page.getByRole('tab', { name: /^resumen$/i })).toHaveAttribute('aria-selected', 'true');
});

test('07 · caja movimientos', async ({ page }) => {
  await installAppMocks(page);
  await page.setViewportSize({ width: 1917, height: 1027 });
  await page.goto('/cashbox');
  await page.getByRole('tab', { name: /^movimientos$/i }).click();
  await expect(page.getByRole('region', { name: /^movimientos de caja$/i }).first()).toBeVisible();
  await save(page, '07-cashbox-movements.png');
});

test('08 · caja cierre', async ({ page }) => {
  await installAppMocks(page);
  await page.setViewportSize({ width: 1917, height: 1028 });
  await page.goto('/cashbox');
  await page.getByRole('tab', { name: /^cierre$/i }).click();
  await expect(page.getByLabel(/monto contado/i)).toBeVisible();
  await save(page, '08-cashbox-close.png');
});

test('09 · historial', async ({ page }) => {
  await installAppMocks(page);
  await capture(page, '/invoices', '09-history.png', { width: 1917, height: 1026 }, /historial/i);
  await expect(page.getByText('María José Hernández Álvarez', { exact: true })).toBeVisible();
});

test('10 · catálogo entrada', async ({ page }) => {
  await installAppMocks(page);
  await capture(page, '/catalog', '10-catalog-intro.png', { width: 1917, height: 1033 }, /cat.logo institucional/i);
  await expect(page.getByLabel(/buscar servicio/i)).toBeVisible();
});

test('11 · catálogo filtrado', async ({ page }) => {
  await installAppMocks(page);
  await page.setViewportSize({ width: 1917, height: 1027 });
  await page.goto('/catalog');
  await page.getByLabel(/buscar servicio/i).fill('hemo');
  await expect(page.getByText('Hemograma completo', { exact: true })).toBeVisible();
  await expect(page.getByText('Glucosa basal', { exact: true })).toHaveCount(0);
  await save(page, '11-catalog-grid.png');
});

test('12 · configuración', async ({ page }) => {
  await installAppMocks(page);
  await page.setViewportSize({ width: 1917, height: 1018 });
  await page.goto('/settings/fiscal');
  await expect(page.getByRole('region', { name: /resumen fiscal/i })).toBeVisible();
  await save(page, '12-settings.png');
});

async function capture(
  page: Page,
  url: string,
  filename: string,
  viewport: { width: number; height: number },
  heading: RegExp,
) {
  await page.setViewportSize(viewport);
  await page.goto(url);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
  await save(page, filename);
}

async function save(page: Page, filename: string) {
  if (!page.url().endsWith('/login')) {
    await expect(page.getByRole('button', { name: /abrir men. de usuario/i })).toBeVisible();
  }
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  const geometry = await page.locator('html').evaluate((root) => ({
    scrollWidth: root.scrollWidth,
    clientWidth: root.clientWidth,
  }));
  expect(geometry.scrollWidth, `${filename} no debe tener desbordamiento horizontal`).toBeLessThanOrEqual(geometry.clientWidth);
  await page.screenshot({ path: resolve(evidenceDirectory, filename), fullPage: false, animations: 'disabled' });
}

async function installPublicMocks(page: Page) {
  await commonInfrastructureMocks(page);
  await page.route('**/api/auth/session', (route) => json(route, { data: null }));
}

async function installAppMocks(page: Page) {
  await commonInfrastructureMocks(page);
  await page.route('**/api/auth/session', (route) => json(route, { data: admin }));
  await page.route('**/api/auth/me', (route) => json(route, { data: admin }));
  await page.route(/\/api\/categories(?:[/?]|$)/, (route) => json(route, { data: categories }));
  await page.route(/\/api\/(?:areas|service-areas)(?:[/?]|$)/, (route) => json(route, { data: areas }));
  await page.route(/\/api\/services(?:[/?]|$)/, (route) => {
    const url = new URL(route.request().url());
    const search = (url.searchParams.get('search') ?? '').toLocaleLowerCase('es');
    const categoryId = Number(url.searchParams.get('category_id') ?? 0);
    const filtered = services.filter((item) => (!search || item.name.toLocaleLowerCase('es').includes(search))
      && (!categoryId || item.category_id === categoryId));
    return json(route, { data: filtered, meta: pagination(filtered.length, 24) });
  });
  await page.route(/\/api\/cash-sessions\/current(?:[/?]|$)/, (route) => json(route, { data: openSession }));
  await page.route(/\/api\/reports\/cash-sessions\/\d+(?:[/?]|$)/, (route) => json(route, { data: cashReport() }));
  await page.route(/\/api\/invoices(?:\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    const patient = (url.searchParams.get('patient') ?? '').toLocaleLowerCase('es');
    const filtered = invoices.filter((item) => !patient || item.patient_name.toLocaleLowerCase('es').includes(patient));
    return json(route, { data: filtered, meta: pagination(filtered.length, 10) });
  });
  await page.route(/\/api\/invoices\/\d+(?:\?.*)?$/, (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/').at(-1));
    return json(route, { data: invoices.find((item) => item.id === id) ?? invoices[0] });
  });
  await page.route('**/api/reports/dashboard**', (route) => json(route, { data: dashboardReport() }));
  await page.route('**/api/system/setup-status', (route) => json(route, {
    needs_setup: false,
    steps: { admin_exists: true, fiscal_settings: true, fiscal_sequence_exists: true, catalog_has_services: true },
  }));
  await page.route('**/api/settings/fiscal', (route) => json(route, { data: fiscalSettings }));
  await page.route('**/api/settings/operational', (route) => json(route, { data: fiscalSettings }));
  await page.route('**/api/fiscal-sequences**', (route) => json(route, { data: [{
    id: 1, document_type: 'invoice', prefix: '000-001-01', min_number: 1,
    max_number: 99999999, current_number: 503, cai: 'A1B2C3-D4E5F6-G7H8I9-J0K1L2-M3N4O5-P6',
    valid_from: '2026-01-01', valid_until: '2027-01-01', active: true,
  }] }));
}

async function commonInfrastructureMocks(page: Page) {
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/settings/branding', (route) => json(route, { data: {
    hospital_name: 'Hospital General San Isidro', primary_color: 'teal', slogan: 'Atención con dignidad',
    government_line: 'Gobierno de Honduras', secretariat_line: 'Secretaría de Salud', receipt_location: 'Tocoa, Colón',
  } }));
  await page.route('**/api/settings/logo', (route) => json(route, { logo_url: null }));
  await page.route('**/api/system/health', (route) => json(route, { ok: true }));
  await page.route('**/api/system/echo-config', (route) => json(route, { data: {
    enabled: false, broadcaster: 'log', key: null, ws_host: null, ws_port: null, force_tls: false,
  } }));
  await page.route('**/api/system/status-summary', (route) => json(route, { data: {
    app: { env: 'local', debug: false }, database: { connected: true },
    queue: { failed_jobs_count: 0 }, backups: { last_success_at: '2026-07-15T02:00:00-06:00' },
  } }));
}

function pagination(total: number, perPage: number) {
  return { current_page: 1, from: total ? 1 : null, last_page: 1, path: '/api', per_page: perPage, to: total, total };
}

function dashboardReport() {
  return {
    current_month: { total_billed: '18750.00', total_collected: '16955.00', total_pending: '1795.00', invoice_count: 86, payment_count: 79 },
    last_7_days: [{ date: '2026-07-15', total_billed: '2170.00', total_collected: '1795.00', invoice_count: 14, payment_count: 12 }],
    payments_by_method: openSession.payments_by_method,
    top_services: [{ service_name: 'Hemograma completo', category_name: 'Laboratorio', quantity: '8.00', total: '1440.00' }],
    cashiers_summary: [{ user_id: admin.id, name: admin.name, username: admin.username, payment_count: 12, total_collected: '1795.00' }],
  };
}

function cashReport() {
  return {
    cash_session: openSession, totals_by_method: openSession.payments_by_method,
    total_cash: '1345.00', total_transfer: '300.00', total_card: '150.00', total_other: '0.00',
    payments_count: 12, payments_total: '1795.00', expected_cash_amount: '1845.00',
    pending_invoice_count: 2, pending_amount: '375.00', missing_institutional_receipt_count: 1,
    reversed_payments_count: 0, reversed_payments_total: '0.00',
    payments: [{
      id: 301, invoice_id: 501, cash_session_id: 77, user_id: admin.id, method: 'cash', amount: '250.00',
      reference: null, status: 'posted', paid_at: '2026-07-15T09:35:00-06:00', invoice: invoices[0],
    }, {
      id: 302, invoice_id: 502, cash_session_id: 77, user_id: admin.id, method: 'transfer', amount: '180.00',
      reference: 'BAC-150726-0318', status: 'posted', paid_at: '2026-07-15T10:05:00-06:00', invoice: invoices[1],
    }],
    movements: [{
      id: 901, cash_session_id: 77, payment_id: 301, user_id: admin.id, type: 'payment', method: 'cash',
      amount: '250.00', notes: 'Pago de factura 000-001-01-00000501', occurred_at: '2026-07-15T09:35:00-06:00',
    }, {
      id: 902, cash_session_id: 77, payment_id: 302, user_id: admin.id, type: 'payment', method: 'transfer',
      amount: '180.00', notes: 'Transferencia BAC-150726-0318', occurred_at: '2026-07-15T10:05:00-06:00',
    }],
  };
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}
