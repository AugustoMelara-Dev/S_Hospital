import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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

    await expect(page.getByRole('heading', { level: 1, name: 'Recibos institucionales', exact: true })).toBeVisible();
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
    await expect(page.getByRole('tab', { name: /vista previa/i })).toBeVisible();
    await expect(page.getByText(/ajusta márgenes, fuente y escala automáticamente/i)).toBeVisible();
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
    const preview = page.locator('[data-testid="receipt-settings-preview"]:visible');
    await expect(preview).toBeVisible();
    await expect(page.getByRole('region', { name: /vista previa de recibo media carta/i })).toBeVisible();
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
      'show_copy_legend',
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

const printingArtifacts = join(process.cwd(), 'test-results', 'frontend-final', 'printing');

const certifiedPaperProfiles = [
  { code: 'letter', className: 'receipt-letter', widthPt: 792, heightPt: 612 },
  { code: 'half-letter', className: 'receipt-half-letter', widthPt: 612, heightPt: 396 },
  { code: 'a5', className: 'receipt-a5', widthPt: 595.28, heightPt: 419.53 },
  { code: '80mm', className: 'receipt-80mm', widthPt: 226.77, heightPt: 841.89, pdfWidth: '80mm', pdfHeight: '297mm' },
  { code: '58mm', className: 'receipt-58mm', widthPt: 164.41, heightPt: 841.89, pdfWidth: '58mm', pdfHeight: '297mm' },
  { code: 'custom-190x140', className: 'receipt-custom', widthPt: 538.58, heightPt: 396.85 },
] as const;

const certifiedCopies = [
  { code: 'original', label: 'Original' },
  { code: 'first-copy', label: 'Primera copia' },
  { code: 'second-copy', label: 'Segunda copia' },
] as const;

test.describe.serial('Print profiles - browser PDF certification', () => {
  const evidence: Array<Record<string, unknown>> = [];

  test.beforeAll(async () => {
    await rm(printingArtifacts, { recursive: true, force: true });
    await mkdir(printingArtifacts, { recursive: true });
  });

  test.afterAll(async () => {
    await writeFile(
      join(printingArtifacts, 'printing-evidence.json'),
      `${JSON.stringify(evidence, null, 2)}\n`,
      'utf8',
    );
  });

  for (const paper of certifiedPaperProfiles) {
    for (const copy of certifiedCopies) {
      test(`${paper.code} - ${copy.label}`, async ({ page }) => {
        await page.route('**/api/**', (route) => json(route, { data: null }));
        await page.goto('/login');
        const printCss = await readFile(join(process.cwd(), 'src', 'printing', 'styles', 'receipt-print.css'), 'utf8');
        await installPrintableReceiptFixture(page, paper.className, copy.label, printCss);
        await page.emulateMedia({ media: 'print' });

        const inspection = await page.evaluate(() => {
          const receipt = document.querySelector<HTMLElement>('[data-receipt-print-root]');
          const shell = document.querySelector<HTMLElement>('[data-testid="print-shell"]');
          const actions = document.querySelector<HTMLElement>('[data-testid="print-actions"]');
          if (!receipt || !shell || !actions) throw new Error('Print fixture incompleto');
          const receiptStyle = getComputedStyle(receipt);
          return {
            actionsDisplay: getComputedStyle(actions).display,
            boxShadow: receiptStyle.boxShadow,
            content: receipt.textContent ?? '',
            fontsLocal: performance.getEntriesByType('resource')
              .filter((entry) => /\.(?:woff2?|ttf|otf)(?:\?|$)/i.test(entry.name))
              .every((entry) => new URL(entry.name).origin === location.origin),
            overflow: receipt.scrollWidth <= receipt.clientWidth + 1,
            position: receiptStyle.position,
            shellDisplay: getComputedStyle(shell).display,
          };
        });

        expect(inspection.shellDisplay).toBe('none');
        expect(inspection.actionsDisplay).toBe('none');
        expect(inspection.boxShadow).toBe('none');
        expect(inspection.position).toBe('static');
        expect(inspection.overflow).toBe(true);
        expect(inspection.fontsLocal).toBe(true);
        for (const requiredText of [
          'Hospital San Isidro',
          'RTN: 08011999123456',
          'REC-A-00000005',
          'L 1,250.00',
          'MIL DOSCIENTOS CINCUENTA LEMPIRAS EXACTOS',
          'Firma y sello',
          'Original: Oficina Recaudadora',
          copy.label,
        ]) {
          expect(inspection.content).toContain(requiredText);
        }

        const pdfPath = join(printingArtifacts, `${paper.code}-${copy.code}.pdf`);
        const thermalPdfOptions = 'pdfWidth' in paper
          ? { preferCSSPageSize: false, width: paper.pdfWidth, height: paper.pdfHeight }
          : { preferCSSPageSize: true };
        await page.pdf({
          path: pdfPath,
          printBackground: true,
          tagged: true,
          ...thermalPdfOptions,
        });

        const pdf = await readFile(pdfPath);
        expect(pdf.subarray(0, 5).toString('ascii')).toBe('%PDF-');
        expect(pdf.byteLength).toBeGreaterThan(5_000);
        const pageCount = pdf.toString('latin1').match(/\/Type\s*\/Page(?!s)\b/g)?.length ?? 0;
        expect(pageCount).toBe(1);
        const mediaBox = pdf.toString('latin1').match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/);
        expect(mediaBox, 'El PDF debe declarar MediaBox').not.toBeNull();
        const widthPt = Number(mediaBox?.[1]);
        const heightPt = Number(mediaBox?.[2]);
        expect(Math.abs(widthPt - paper.widthPt)).toBeLessThanOrEqual(1);
        if ('heightPt' in paper) expect(Math.abs(heightPt - paper.heightPt)).toBeLessThanOrEqual(1);

        evidence.push({
          copy: copy.label,
          file: pdfPath,
          heightPt,
          paper: paper.code,
          validations: inspection,
          widthPt,
        });
      });
    }
  }
});

async function installPrintableReceiptFixture(page: Page, paperClass: string, copyLabel: string, printCss: string) {
  await page.evaluate(({ paperClass, copyLabel, printCss }) => {
    const printStyles = document.createElement('style');
    printStyles.textContent = printCss;
    document.head.append(printStyles);
    document.head.insertAdjacentHTML('beforeend', `
      <style>
        @media print { .institutional-receipt.receipt-custom { box-sizing: border-box; page: receipt-custom; width: 174mm; min-height: 124mm; padding: 4mm; font-size: 9px; line-height: 1.2; } }
        @page receipt-custom { size: 190mm 140mm; margin: 8mm; }
      </style>
    `);
    document.body.dataset.printingReceipt = 'true';
    document.body.innerHTML = `
      <aside class="print-hidden" data-testid="print-shell">Navegación y sesión</aside>
      <div class="no-print" data-testid="print-actions">Imprimir | Nueva factura</div>
      <main class="institutional-receipt ${paperClass}" data-receipt-print-root>
        <header class="receipt-header">
          <span>Gobierno de Honduras</span>
          <span>Secretaría de Salud</span>
          <strong class="hospital-name">Hospital San Isidro</strong>
          <span>Tocoa, Colón</span>
          <span>RTN: 08011999123456</span>
        </header>
        <div class="receipt-rule"></div>
        <div class="receipt-title-row"><h1 class="receipt-title">RECIBO INSTITUCIONAL</h1><span>${copyLabel}</span></div>
        <table class="receipt-meta-table"><tbody>
          <tr><th>Serie / No.</th><td>REC-A-00000005</td><th>Fecha</th><td>13/07/2026</td></tr>
          <tr><th>Paciente / enterante</th><td>Paciente Validación</td><th>Estado</th><td>Pagada</td></tr>
        </tbody></table>
        <div class="receipt-rule"></div>
        <table class="receipt-items-table">
          <caption>Detalle de servicios</caption>
          <thead><tr><th>Concepto / servicio</th><th>Cant.</th><th>Precio</th><th>ISV</th><th>Importe</th></tr></thead>
          <tbody><tr><td>Servicio hospitalario institucional con descripción extensa para certificar saltos y ausencia de overflow</td><td>1</td><td>L 1,250.00</td><td>L 0.00</td><td>L 1,250.00</td></tr></tbody>
        </table>
        <table class="receipt-totals-table"><tbody><tr class="strong"><th>TOTAL</th><td>L 1,250.00</td></tr></tbody></table>
        <p>MIL DOSCIENTOS CINCUENTA LEMPIRAS EXACTOS</p>
        <footer class="receipt-footer">
          <div class="receipt-signature-line"></div>
          <span>Firma y sello</span>
          <span>Original: Oficina Recaudadora</span>
        </footer>
      </main>
    `;
  }, { paperClass, copyLabel, printCss });
}
