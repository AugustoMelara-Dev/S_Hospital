import { expect, test, type Page, type Route } from '@playwright/test';

const adminUser = {
  id: 1,
  name: 'Administradora Hospital',
  email: 'admin.validacion@hospital.local',
  username: 'admin.validacion',
  active: true,
  roles: ['admin'],
  permissions: [
    'settings.fiscal.view',
    'receipts.view',
    'receipt_settings.view',
    'receipt_settings.update',
  ],
  must_change_password: false,
};

const profiles = [
  profile(1, 'media_carta_horizontal', 'Media carta horizontal', 'half_letter_landscape', true),
  profile(2, 'a5_horizontal', 'A5 horizontal', 'a5_landscape', false),
  profile(3, 'carta_horizontal', 'Carta horizontal', 'letter_landscape', false),
  profile(4, 'thermal_80mm', 'Ticket 80mm', 'thermal_80mm', false),
  profile(5, 'thermal_58mm', 'Ticket 58mm', 'thermal_58mm', false),
];

test.describe('Print profiles - normal flow', () => {
  test('normal receipt settings only expose paper, copies, logo, seal, test print, save and preview', async ({ page }) => {
    await installReceiptSettingsMocks(page);

    await page.goto('/settings/institutional-receipts');

    await expect(page.getByRole('heading', { name: /recibos institucionales/i })).toBeVisible();
    await page.getByRole('tab', { name: /papel y copias/i }).click();

    await expect(page.getByRole('radiogroup', { name: /tipo de papel del recibo/i })).toBeVisible();
    for (const paper of [/^Carta\b/i, /^Media carta\b/i, /^A5\b/i]) {
      await expect(page.getByRole('radio', { name: paper })).toBeVisible();
    }
    await expect(page.getByRole('radio', { name: /^Ticket 80 mm\b/i })).toHaveCount(0);
    await expect(page.getByRole('radio', { name: /^Ticket 58 mm\b/i })).toHaveCount(0);

    await expect(page.getByLabel(/^copias$/i)).toBeVisible();
    await expect(page.getByLabel(/mostrar logo autorizado/i)).toBeVisible();
    await expect(page.getByLabel(/espacio para sello\/firma/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /imprimir prueba/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /guardar perfil/i })).toBeVisible();
    await expect(page.getByText(/vista previa/i)).toBeVisible();
    await expect(page.getByText(/m.rgenes se calculan autom.ticamente/i)).toBeVisible();
    await expect(page.getByText(/fuente|layout/i)).toHaveCount(0);

    for (const label of [
      'Ancho mm',
      'Alto mm',
      'Fuente',
      'Escala',
      'Margen sup. (mm)',
      'Margen der. (mm)',
      'Margen inf. (mm)',
      'Margen izq. (mm)',
    ]) {
      await expect(page.getByLabel(label)).toHaveCount(0);
    }

    await expect(page.getByText('receipt_settings.advanced')).toHaveCount(0);
    await expect(page.getByText(/ajustes avanzados restringidos|modo soporte t.cnico/i)).toHaveCount(0);
  });

  test('receipt settings preview remains contained at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await installReceiptSettingsMocks(page);

    await page.goto('/settings/institutional-receipts');
    await page.getByRole('tab', { name: /papel y copias/i }).click();

    await expect(page.getByRole('radio', { name: /^Media carta\b/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /^Carta\b/i })).toBeVisible();
    await expect(page.getByRole('radio', { name: /^A5\b/i })).toBeVisible();
    await expectNoHorizontalPageOverflow(page);

    await page.getByRole('tab', { name: /vista previa/i }).click();
    const preview = page.getByTestId('receipt-settings-preview');
    await expect(preview).toBeVisible();
    await expect(page.getByRole('region', { name: /vista previa original del recibo institucional/i })).toBeVisible();
    await expectNoHorizontalPageOverflow(page);

    const previewBox = await preview.boundingBox();
    expect(previewBox?.x ?? 0).toBeGreaterThanOrEqual(0);
    expect((previewBox?.x ?? 0) + (previewBox?.width ?? 0)).toBeLessThanOrEqual(320);
  });

  test('normal paper profile saves and test-prints without advanced layout fields', async ({ page }) => {
    const testPrintPayloads: Array<Record<string, unknown>> = [];
    const profilePatchPayloads: Array<Record<string, unknown>> = [];
    const profilePatchPaths: string[] = [];
    await installReceiptSettingsMocks(page, {
      onTestPrint(payload) {
        testPrintPayloads.push(payload);
      },
      onProfilePatch(path, payload) {
        profilePatchPaths.push(path);
        profilePatchPayloads.push(payload);
      },
    });

    await page.goto('/settings/institutional-receipts');
    await page.getByRole('tab', { name: /papel y copias/i }).click();
    await page.getByRole('radio', { name: /^A5\b/i }).click();

    await page.getByRole('button', { name: /imprimir prueba/i }).click();
    await expect.poll(() => testPrintPayloads.length).toBe(1);
    expect(testPrintPayloads[0]).toMatchObject({
      profile_code: 'a5_horizontal',
      payer_name: 'Paciente de prueba',
      concept: 'Servicios hospitalarios de prueba',
      amount: '25.00',
    });

    await page.getByRole('button', { name: /guardar perfil/i }).click();
    await expect.poll(() => profilePatchPayloads.length).toBe(1);

    expect(profilePatchPaths[0]).toBe('/api/settings/institutional-receipts/print-profiles/2');
    expect(profilePatchPayloads[0]).toMatchObject({
      active: true,
      is_global_default: true,
      template_code: 'institutional_classic',
      copies_mode: 'original_only',
      show_copy_legend: true,
      show_physical_seal_space: true,
      use_logo: true,
    });

    for (const field of [
      'paper_kind',
      'orientation',
      'width_mm',
      'height_mm',
      'margin_top_mm',
      'margin_right_mm',
      'margin_bottom_mm',
      'margin_left_mm',
      'font_family',
      'font_scale',
      'show_technical_fields',
      'support_reason',
    ]) {
      expect(profilePatchPayloads[0]).not.toHaveProperty(field);
      expect(testPrintPayloads[0]).not.toHaveProperty(field);
    }
  });
});

async function installReceiptSettingsMocks(
  page: Page,
  hooks: {
    onTestPrint?: (payload: Record<string, unknown>) => void;
    onProfilePatch?: (path: string, payload: Record<string, unknown>) => void;
  } = {},
) {
  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204 }));
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method().toUpperCase();

    if (path === '/api/auth/session' || path === '/api/auth/me') {
      return json(route, { data: adminUser });
    }

    if (path === '/api/auth/logout') {
      return json(route, { ok: true });
    }

    if (path === '/api/settings/logo') {
      return json(route, { logo_url: null });
    }

    if (path === '/api/public/branding' || path === '/api/settings/branding') {
      return json(route, { data: institution() });
    }

    if (path === '/api/cash-sessions/current') {
      return json(route, { data: null });
    }

    if (path === '/api/settings/institutional-receipts') {
      return json(route, {
        data: {
          institution: institution(),
          active_series: activeSeries(),
          series: [activeSeries()],
          print_profiles: profiles,
          assignments: [],
          resolved_profile: profiles[0],
        },
      });
    }

    if (path === '/api/settings/institutional-receipts/test-print') {
      hooks.onTestPrint?.(request.postDataJSON() as Record<string, unknown>);
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-test' });
    }

    if (path.startsWith('/api/settings/institutional-receipts/print-profiles/') && method === 'PATCH') {
      hooks.onProfilePatch?.(path, request.postDataJSON() as Record<string, unknown>);
      return json(route, { data: profiles[0] });
    }

    if (path === '/api/system/client-errors') {
      return route.fulfill({ status: 204 });
    }

    return json(route, { data: null });
  });
}

async function expectNoHorizontalPageOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

function profile(
  id: number,
  code: string,
  name: string,
  paperKind: string,
  isGlobalDefault: boolean,
) {
  return {
    id,
    code,
    name,
    paper_kind: paperKind,
    width_mm: paperKind === 'letter_landscape' ? '279.40' : '215.90',
    height_mm: paperKind === 'letter_landscape' ? '215.90' : '139.70',
    margin_top_mm: '6.00',
    margin_right_mm: '6.00',
    margin_bottom_mm: '6.00',
    margin_left_mm: '6.00',
    orientation: paperKind.startsWith('thermal') ? 'portrait' : 'landscape',
    template_code: 'institutional_classic',
    font_family: 'Arial, sans-serif',
    font_scale: '1.00',
    copies_mode: 'original_only',
    show_copy_legend: true,
    show_physical_seal_space: true,
    use_logo: true,
    show_technical_fields: false,
    active: true,
    is_global_default: isGlobalDefault,
  };
}

function institution() {
  return {
    id: 1,
    hospital_name: 'Hospital San Isidro',
    rtn: '08011999123456',
    default_tax_rate: '15.00',
    primary_color: 'indigo',
    address: 'Tocoa, Colon',
    slogan: 'Servicio publico',
    scanner_enabled: false,
    partial_payments_enabled: false,
    receipt_template_mode: 'institutional',
    receipt_paper_size: 'half_letter',
    government_line: 'Gobierno de Honduras',
    secretariat_line: 'Secretaria de Salud',
    receipt_location: 'Tocoa, Colon',
    receipt_footer_text: 'Original: Oficina Recaudadora',
  };
}

function activeSeries() {
  return {
    id: 1,
    document_type: 'institutional_receipt',
    series: 'REC-A',
    prefix: 'RA',
    number_format: '{series}-{number:08}',
    min_number: 1,
    max_number: 99999999,
    current_number: 4,
    range_authorization: 'AUT-REC',
    legal_text: 'CERTIFICA haber enterado en esta oficina la suma de',
    receipt_number_color: '#b91c1c',
    active: true,
    reprint_behavior: 'audit_only',
    void_behavior: 'permission_reason_audit',
  };
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
