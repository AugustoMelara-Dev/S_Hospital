import { expect, test, type Page, type Route } from '@playwright/test';
import { assertStrictMockGuard, installStrictMockGuard } from './fixtures/strict-mock-guard';
import { operationalEvidencePath } from './fixtures/operational-evidence-path';

test.beforeEach(async ({ page }) => installStrictMockGuard(page));
test.afterEach(async ({ page }) => assertStrictMockGuard(page));

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

const emergencyCategory = { id: 2, name: 'Emergencia', slug: 'emergencia', active: true, sort_order: 2 };
const emergencyArea = { id: 2, name: 'Urgencias', slug: 'urgencias', active: true };

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
    const patchPayloads: Array<Record<string, unknown>> = [];
    await installCatalogMocks(page, {
      onDeleteService: () => {
        deleteCalls += 1;
      },
      onPatchService: (payload) => {
        patchPayloads.push(payload);
      },
    });

    await page.goto('/catalog');

    await expect(page.getByRole('heading', { level: 1, name: /cat.logo institucional/i })).toBeVisible();
    await expect(page.getByLabel(/resumen de servicios/i)).toContainText(/2 servicios/i);
    await expect(page.getByRole('button', { name: /crear nuevo servicio/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /crear nueva categor.a/i })).toBeVisible();
    await expect(page.getByText('Glucosa basal', { exact: true })).toBeVisible();
    await expect(page.getByText('Hemograma completo', { exact: true })).toBeVisible();

    await page.getByLabel(/buscar servicio/i).fill('hemo');

    await expect(page.getByText('Hemograma completo', { exact: true })).toBeVisible();
    await expect(page.getByText('Glucosa basal', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: /acciones de servicio hemograma completo/i }).click();
    await page.getByRole('menuitem', { name: /desactivar/i }).click();
    await expect.poll(() => deleteCalls).toBe(0);

    const statusDialog = page.getByRole('dialog', { name: /desactivar servicio/i });
    await expect(statusDialog).toBeVisible();
    await expect(statusDialog.getByText(/facturas historicas conservaran sus snapshots/i)).toBeVisible();
    await statusDialog.getByLabel(/motivo/i).fill('Servicio retirado temporalmente de caja');
    await statusDialog.getByRole('button', { name: /desactivar servicio/i }).click();

    await expect.poll(() => patchPayloads.length).toBe(1);
    expect(patchPayloads[0]).toEqual(expect.objectContaining({
      active: false,
      availability_change_reason: 'Servicio retirado temporalmente de caja',
    }));
    expect(deleteCalls).toBe(0);
    await expect(statusDialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: /restaurar|eliminar/i })).toHaveCount(0);
    await page.waitForLoadState('networkidle');
  });

  test('keeps URL continuity and real shadcn Sheet keyboard behavior', async ({ page }) => {
    await installCatalogMocks(page);
    await page.goto('/catalog?q=glucosa');

    const createTrigger = page.getByRole('button', { name: /crear nuevo servicio/i });
    await createTrigger.click();
    const createDrawer = page.getByRole('dialog', { name: /nuevo servicio/i });
    await expect(createDrawer).toBeVisible();
    await expect(page).toHaveURL(/q=glucosa/);
    await expect(page).toHaveURL(/panel=new-service/);

    await createDrawer.press('Escape');
    await expect(createDrawer).toHaveCount(0);
    await expect(page).toHaveURL(/q=glucosa/);
    await expect(page).not.toHaveURL(/panel=/);
    await expect(createTrigger).toBeFocused();

    await page.goto('/catalog?q=glucosa&service=1');
    const editDrawer = page.getByRole('dialog', { name: /editar servicio/i });
    await expect(editDrawer).toBeVisible();
    await expect(editDrawer.getByLabel(/precio/i)).toHaveValue('125.00');
    await editDrawer.getByRole('button', { name: /^cerrar$/i }).click();
    await expect(editDrawer).toHaveCount(0);
    await expect(page).toHaveURL(/q=glucosa/);
    await expect(page).not.toHaveURL(/service=/);

    await page.goBack();
    await expect(page.getByRole('dialog', { name: /editar servicio/i })).toBeVisible();
    await page.waitForLoadState('networkidle');
  });

  test('shows filters and distinguishable services first, then switches to a mobile list', async ({ page }, testInfo) => {
    const duplicateServices = [
      serviceFixture({ id: 10, name: 'Consulta médica', slug: 'consulta-externa', scan_code: 'CON-EXT' }),
      serviceFixture({
        id: 11,
        name: 'Consulta médica',
        slug: 'consulta-emergencia',
        scan_code: 'CON-EME',
        category_id: emergencyCategory.id,
        area_id: emergencyArea.id,
        category: emergencyCategory,
        area: emergencyArea,
      }),
    ];
    await installCatalogMocks(page, { services: duplicateServices });

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/catalog');
    await expect(page.getByRole('heading', { name: /filtros del catálogo/i })).toBeVisible();
    await expect(page.getByText('Código CON-EXT', { exact: true })).toBeVisible();
    await expect(page.getByText('Código CON-EME', { exact: true })).toBeVisible();
    const desktopMetrics = await page.evaluate(() => ({
      tableTop: document.querySelector('[aria-label="Listado de servicios del catálogo"]')?.getBoundingClientRect().top ?? 9999,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      paginations: document.querySelectorAll('[data-slot="pagination"]').length,
    }));
    expect(desktopMetrics.tableTop).toBeLessThan(768);
    expect(desktopMetrics.overflow).toBe(0);
    expect(desktopMetrics.paginations).toBe(1);
    await settleForScreenshot(page);
    await page.screenshot({ path: operationalEvidencePath(testInfo, 'catalog-1366.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileList = page.getByRole('list', { name: /servicios del catálogo en móvil/i });
    await expect(mobileList).toBeVisible();
    await expect(mobileList.getByRole('listitem')).toHaveCount(2);
    await expect(mobileList.getByRole('listitem').nth(0)).toContainText(/Laboratorio.*Código CON-EXT/s);
    await expect(mobileList.getByRole('listitem').nth(1)).toContainText(/Emergencia.*Urgencias.*Código CON-EME/s);
    await expect(page.getByRole('table', { name: /listado de servicios/i })).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    await settleForScreenshot(page);
    await page.screenshot({ path: operationalEvidencePath(testInfo, 'catalog-390.png'), fullPage: true });
  });
});

async function installCatalogMocks(page: Page, options: {
  onDeleteService?: () => void;
  onPatchService?: (payload: Record<string, unknown>) => void;
  services?: Array<typeof baseService>;
} = {}) {
  const sourceServices = options.services ?? [glucoseService, hemogramService];
  await installCommonMocks(page, catalogAdminUser);
  await page.route(/\/api\/categories(?:[/?]|$)/, (route) => json(route, { data: [laboratoryCategory, emergencyCategory] }));
  await page.route(/\/api\/areas(?:[/?]|$)/, (route) => json(route, { data: [laboratoryArea, emergencyArea] }));
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
      return json(route, { message: 'DELETE is not supported for service deactivation.' }, 405);
    }

    if (request.method() === 'PATCH') {
      const payload = JSON.parse(request.postData() ?? '{}') as Record<string, unknown>;
      options.onPatchService?.(payload);
      return json(route, { data: { ...hemogramService, ...payload } });
    }

    if (request.method() === 'POST') {
      return json(route, { data: hemogramService });
    }

    const url = new URL(request.url());
    const search = url.searchParams.get('search')?.toLowerCase() ?? '';
    const services = search
      ? sourceServices.filter((service) => service.name.toLowerCase().includes(search))
      : sourceServices;

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

async function settleForScreenshot(page: Page) {
  await page.evaluate(() => new Promise<void>((resolveFrame) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
  }));
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
  await page.route('**/api/settings/logo', (route) => route.fulfill({ status: 200, contentType: 'image/png', body: '' }));
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
