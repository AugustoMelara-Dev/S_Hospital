import { type Page, type Route } from '@playwright/test';

/**
 * Helpers de mock para los recorridos E2E del producto nuevo "Panel administrativo".
 *
 * Los specs instalan `installStrictMockGuard` (e2e/fixtures/strict-mock-guard.ts)
 * ANTES que estos handlers: cualquier `/api/**` no declarado aquí es registrado
 * y hace fallar la prueba. Todos los datos son sintéticos y desechables.
 */

export type AdminTestUser = {
  id: number;
  name: string;
  email: string;
  username: string;
  active: boolean;
  roles: string[];
  permissions: string[];
  must_change_password: boolean;
};

export type AdminTestCashSession = {
  id: number;
  user_id: number;
  user?: { id: number; name: string; username: string };
  opening_amount: string;
  closing_amount: string | null;
  expected_amount: string | null;
  expected_cash_amount?: string;
  difference_amount: string | null;
  status: 'open' | 'closed';
  opening_notes: string | null;
  closing_notes: string | null;
  closing_breakdown?: { bills: Record<string, number>; other_amount: string } | null;
  opened_at: string;
  closed_at: string | null;
  payments_count?: number;
  payments_total?: string;
  payments_by_method?: { cash: string; transfer: string; card: string; other: string };
  pending_invoice_count?: number;
  pending_amount?: string;
  missing_institutional_receipt_count?: number;
};

export type CatalogService = {
  id: number;
  category_id: number;
  name: string;
  slug: string;
  price: string;
  taxable: boolean;
  active: boolean;
  visible_in_billing: boolean;
  is_billable: boolean;
  special_rule_code: string | null;
  category?: { id: number; name: string } | null;
  area?: { id: number; name: string } | null;
};

export type CatalogCategory = { id: number; name: string; slug: string; active: boolean };

export type PreviewInput = {
  items: Array<{ service_id: number; quantity: string }>;
  dialysis_prescription?: boolean;
};

export function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

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

export const ERYTHROPOIETIN_RULE = 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION';

export type AdminApi = {
  /** Cambia la sesión que devuelve GET /api/cash-sessions/current. */
  setCashSession: (session: AdminTestCashSession | null) => void;
};

/**
 * Shell común: sesión, branding, salud, echo y sesión de caja vigente.
 * Debe llamarse después de instalar el guard estricto.
 */
export async function installAdminApi(
  page: Page,
  options: { user: AdminTestUser; cashSession?: AdminTestCashSession | null },
): Promise<AdminApi> {
  let currentCashSession = options.cashSession ?? null;

  await page.addInitScript(() => {
    window.open = () => null;
  });

  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/auth/session', (route) => json(route, { data: options.user }));
  await page.route('**/api/auth/me', (route) => json(route, { data: options.user }));
  await page.route('**/api/settings/branding', (route) => json(route, BRANDING));
  await page.route('**/api/settings/logo', (route) => json(route, { logo_url: null }));
  await page.route('**/api/system/health', (route) => json(route, { ok: true }));
  await page.route('**/api/system/echo-config', (route) =>
    json(route, {
      data: {
        enabled: false,
        broadcaster: 'log',
        key: null,
        ws_host: null,
        ws_port: null,
        force_tls: false,
      },
    }),
  );
  await page.route('**/api/system/status-summary', (route) =>
    json(route, {
      data: {
        app: { env: 'local', debug: false },
        database: { connected: true },
        queue: { failed_jobs_count: 0 },
        backups: { last_success_at: null },
      },
    }),
  );
  await page.route(/\/api\/cash-sessions\/current(?:\?.*)?$/, (route) =>
    json(route, { data: currentCashSession }),
  );

  return {
    setCashSession: (session) => {
      currentCashSession = session;
    },
  };
}

/** Catálogo de Cobrar: categorías y búsqueda de servicios. */
export async function installCatalog(
  page: Page,
  options: { categories: CatalogCategory[]; services: CatalogService[] },
): Promise<void> {
  await page.route(/\/api\/categories(?:\?.*)?$/, (route) =>
    json(route, { data: options.categories }),
  );
  await page.route(/\/api\/services(?:\?.*)?$/, (route) => {
    const search = (new URL(route.request().url()).searchParams.get('search') ?? '').toLowerCase();
    const services = search
      ? options.services.filter((service) => service.name.toLowerCase().includes(search))
      : options.services;

    return json(route, {
      data: services,
      meta: {
        current_page: 1,
        from: services.length ? 1 : null,
        last_page: 1,
        path: '/api/services',
        per_page: 30,
        to: services.length,
        total: services.length,
      },
    });
  });
}

/** Valoración autoritativa: POST /api/invoices/preview. */
export async function installPreview(
  page: Page,
  build: (input: PreviewInput) => unknown,
): Promise<void> {
  await page.route(/\/api\/invoices\/preview$/, async (route) => {
    const input = (route.request().postDataJSON() ?? {}) as PreviewInput;
    return json(route, { data: build(input) });
  });
}

export function currencyTotals(input: {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  exemptCents?: number;
}) {
  return {
    status: 'ok',
    currency: 'HNL',
    tax: {
      label: 'ISV',
      available: true,
      rate: '15.00',
      rate_basis_points: 1500,
      origin: 'fiscal_settings',
    },
    totals: {
      subtotal_cents: input.subtotalCents,
      taxable_base_cents: input.subtotalCents,
      exempt_cents: input.exemptCents ?? 0,
      tax_cents: input.taxCents,
      discount_cents: 0,
      total_cents: input.totalCents,
    },
    zero_reason: input.totalCents === 0 ? 'rule' : null,
    items: [],
    emission: {
      persisted: false,
      invoice_created: false,
      fiscal_number_consumed: false,
      payment_created: false,
      institutional_receipt_created: false,
    },
  };
}

export function openCashSessionFixture(overrides: Partial<AdminTestCashSession> = {}): AdminTestCashSession {
  return {
    id: 7,
    user_id: 71,
    user: { id: 71, name: 'Cajera Facturacion', username: 'facturacion.caja' },
    opening_amount: '500.00',
    closing_amount: null,
    expected_amount: '500.00',
    expected_cash_amount: '500.00',
    difference_amount: null,
    status: 'open',
    opening_notes: null,
    closing_notes: null,
    opened_at: '2026-09-18T08:00:00-06:00',
    closed_at: null,
    payments_count: 0,
    payments_total: '0.00',
    payments_by_method: { cash: '0.00', transfer: '0.00', card: '0.00', other: '0.00' },
    pending_invoice_count: 0,
    pending_amount: '0.00',
    missing_institutional_receipt_count: 0,
    ...overrides,
  };
}
