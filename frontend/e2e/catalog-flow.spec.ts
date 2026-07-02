import { expect, test, type Page, type Route } from '@playwright/test';

const catalogAdminUser = {
  id: 31,
  name: 'Catalogo Administradora',
  email: 'catalogo@hospital.local',
  username: 'catalogo.admin',
  active: true,
  roles: ['catalog_manager'],
  permissions: ['catalog.view', 'catalog.manage'],
  must_change_password: false,
};

const laboratoryCategory = {
  id: 1,
  name: 'Laboratorio',
  slug: 'laboratorio',
  active: true,
  sort_order: 1,
};

const laboratoryArea = {
  id: 1,
  name: 'Laboratorio',
  slug: 'laboratorio',
  active: true,
};

const baseService = {
  id: 1,
  category_id: laboratoryCategory.id,
  area_id: laboratoryArea.id,
  name: 'Servicio',
  slug: 'servicio',
  aliases: null,
  scan_code: null,
  barcode: null,
  qr_code: null,
  description: null,
  internal_code: null,
  price: '100.00',
  taxable: true,
  active: true,
  visible_in_billing: true,
  is_billable: true,
  special_rule_code: null,
  category: laboratoryCategory,
  area: laboratoryArea,
};

const glucoseService = serviceFixture({
  id: 1,
  name: 'Glucosa basal',
  slug: 'glucosa-basal',
  price: '125.00',
  scan_code: 'GLU-001',
});

const hemogramService = serviceFixture({
  id: 2,
  name: 'Hemograma completo',
  slug: 'hemograma-completo',
  price: '180.00',
  scan_code: 'HEM-001',
});

test.describe('Catalog - critical mocked e2e', () => {
  test('manager can search services and deactivate only after confirmation', async ({ page }) => {
    let deleteCalls = 0;
    await installCatalogMocks(page, {
      onDeleteService: () => {
        deleteCalls += 1;
      },
    });

    await page.goto('/catalog');

    await expect(page.getByRole('heading', { level: 1, name: /cat.logo de servicios/i })).toBeVisible();
    await expect(page.getByLabel(/resumen de servicios/i)).toContainText(/2 servicios/i);
    await expect(page.getByRole('button', { name: /crear nuevo servicio/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /crear nueva categor.a/i })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Glucosa basal', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Hemograma completo', exact: true })).toBeVisible();

    await page.getByLabel(/buscar servicio/i).fill('hemo');

    await expect(page.getByRole('cell', { name: 'Hemograma completo', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Glucosa basal', exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: /acciones de servicio hemograma completo/i }).click();
    await page.getByRole('menuitem', { name: /^desactivar$/i }).click();
    await expect.poll(() => deleteCalls).toBe(0);

    await expect(page.getByRole('alertdialog', { name: /desactivar servicio/i })).toBeVisible();
    await expect(page.getByText(/facturas historicas conservaran sus snapshots/i)).toBeVisible();
    await page.getByRole('button', { name: /desactivar servicio/i }).click();

    await expect.poll(() => deleteCalls).toBe(1);
    await expect(page.getByRole('alertdialog', { name: /desactivar servicio/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /restaurar|eliminar/i })).toHaveCount(0);
  });
});

async function installCatalogMocks(page: Page, options: { onDeleteService?: () => void } = {}) {
  await installCommonMocks(page, catalogAdminUser);
  await page.route(/\/api\/categories(?:[/?]|$)/, (route) => json(route, { data: [laboratoryCategory] }));
  await page.route(/\/api\/areas(?:[/?]|$)/, (route) => json(route, { data: [laboratoryArea] }));
  await page.route(/\/api\/settings\/operational(?:[/?]|$)/, (route) => json(route, {
    data: {
      scanner_enabled: true,
      partial_payments_enabled: false,
      default_tax_rate: '15.00',
    },
  }));
  await page.route(/\/api\/services(?:[/?]|$)/, (route) => {
    const request = route.request();

    if (request.method() === 'DELETE') {
      options.onDeleteService?.();
      return json(route, { data: { ...hemogramService, active: false } });
    }

    if (request.method() === 'PATCH' || request.method() === 'POST') {
      return json(route, { data: hemogramService });
    }

    const url = new URL(request.url());
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    const services = search
      ? [glucoseService, hemogramService].filter((service) => service.name.toLowerCase().includes(search))
      : [glucoseService, hemogramService];

    return json(route, {
      data: services,
      meta: {
        current_page: 1,
        from: services.length ? 1 : null,
        last_page: 1,
        path: '/api/services',
        per_page: 15,
        to: services.length,
        total: services.length,
      },
    });
  });
}

function serviceFixture(overrides: Partial<typeof baseService> = {}) {
  return {
    ...baseService,
    ...overrides,
  };
}

async function installCommonMocks(page: Page, sessionUser: typeof catalogAdminUser) {
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/auth/session', (route) => json(route, { data: sessionUser }));
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

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
