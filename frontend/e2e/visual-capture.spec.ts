import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { installAdminApi } from './fixtures/admin-e2e';
import {
  VISUAL_USER,
  addService,
  getUnexpectedApis,
  installCajaMocks,
  installCatalogAdminMocks,
  installCobrarMocks,
  installFallback,
  installLoginSurface,
  installRecibosMocks,
  installReportesMocks,
  installResumenMocks,
  layoutMetrics,
  prepareMixedCart,
  prepareZeroCart,
} from './fixtures/visual-surfaces';

/**
 * T-QA-03 / T-QA-05 — Captura visual (NO aprueba diseño).
 *
 * Genera PNG reales, full-page, de las superficies nuevas del producto con el
 * mock E2E (sin backend, datos sintéticos). Los handlers de mock viven en
 * `e2e/fixtures/visual-surfaces.ts` (compartidos con T-QA-06 `a11y-audit`).
 *
 * Salida: `hospital-ai/evidencia/VISUAL/*.png` + `MANIFEST.json`.
 * Este spec NO se registra en `scripts/mock-e2e-plan.mjs`: no altera los 13
 * tests existentes ni el job CI `e2e-mocked`.
 *
 * T-QA-05 amplía con los estados que faltaban para la revisión del
 * coordinador: diálogo de recibo institucional de Recibos, cambio de
 * contraseña, emisión sin cobro (EPO con receta), resultado tras cobro y la
 * pestaña Arqueo de Caja. Sigue siendo mock, sintético y sin backend.
 */

// `VISUAL_EVIDENCE_DIR` permite redirigir las capturas (T-QA-06 cross-browser)
// sin sobrescribir la evidencia de T-QA-03/T-QA-05 en `evidencia/VISUAL/`.
const OUTPUT_DIR = process.env.VISUAL_EVIDENCE_DIR
  ? resolve(process.env.VISUAL_EVIDENCE_DIR)
  : resolve(process.cwd(), '..', 'hospital-ai', 'evidencia', 'VISUAL');
mkdirSync(OUTPUT_DIR, { recursive: true });

const DESKTOP_VIEWPORT = { width: 1366, height: 768 };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

type ManifestEntry = {
  file: string;
  surface: string;
  viewport: string;
  state: string;
  width: number;
  height: number;
  captured_at: string;
  notes?: string;
};

const manifest: ManifestEntry[] = [];

function pngDimensions(buffer: Buffer): { width: number; height: number } {
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

async function capture(
  page: Page,
  entry: { file: string; surface: string; viewport: string; state: string; notes?: string },
): Promise<void> {
  await page.waitForTimeout(250);
  const absolute = resolve(OUTPUT_DIR, entry.file);
  const buffer = await page.screenshot({ path: absolute, fullPage: true });
  const { width, height } = pngDimensions(buffer);
  manifest.push({ ...entry, width, height, captured_at: new Date().toISOString() });
}

/**
 * T-UI-22: el conteo por denominaciones debe leerse. Ninguna etiqueta por
 * debajo de 60 px de ancho ni con texto recortado/desbordado, y la sección no
 * puede desbordar horizontalmente.
 */
type DenominationLabelMetric = {
  text: string;
  width: number;
  scrollWidth: number;
  clientWidth: number;
  rowWidth: number;
  inputWidth: number;
};

async function denominationCounterMetrics(page: Page): Promise<{
  labels: DenominationLabelMetric[];
  sectionScrollWidth: number;
  sectionClientWidth: number;
}> {
  return page.evaluate(() => {
    const section = document.querySelector<HTMLElement>(
      '[aria-labelledby="cash-denomination-counter-title"]',
    );
    const labels = Array.from(
      document.querySelectorAll<HTMLLabelElement>(
        'label[for^="cash-denomination-"]:not([for="cash-denomination-other"])',
      ),
    ).map((label) => {
      const row = label.parentElement;
      const input = row?.querySelector<HTMLInputElement>('input');

      return {
        text: (label.textContent ?? '').trim(),
        width: Math.round(label.getBoundingClientRect().width),
        scrollWidth: label.scrollWidth,
        clientWidth: label.clientWidth,
        rowWidth: Math.round(row?.getBoundingClientRect().width ?? 0),
        inputWidth: Math.round(input?.getBoundingClientRect().width ?? 0),
      };
    });

    return {
      labels,
      sectionScrollWidth: section?.scrollWidth ?? 0,
      sectionClientWidth: section?.clientWidth ?? 0,
    };
  });
}

function expectDenominationCounterLegible(metrics: {
  labels: DenominationLabelMetric[];
  sectionScrollWidth: number;
  sectionClientWidth: number;
}): void {
  expect(metrics.labels).toHaveLength(9);
  for (const label of metrics.labels) {
    expect(label.width, `Etiqueta "${label.text}" demasiado estrecha`).toBeGreaterThanOrEqual(60);
    expect(
      label.scrollWidth,
      `Etiqueta "${label.text}" recorta su texto`,
    ).toBeLessThanOrEqual(label.clientWidth);
  }
  expect(metrics.sectionScrollWidth).toBeLessThanOrEqual(metrics.sectionClientWidth);
}

test.use({ viewport: DESKTOP_VIEWPORT });

test.describe('VISUAL — escritorio 1366x768', () => {
  test('01 login sin sesión', async ({ page }) => {
    await installLoginSurface(page);
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /^iniciar sesión$/i })).toBeVisible();
    await capture(page, {
      file: '01-login-1366x768.png',
      surface: 'Login (/login, sin sesión)',
      viewport: '1366x768',
      state: 'formulario de acceso listo',
    });
  });

  test('02 resumen', async ({ page }) => {
    await installResumenMocks(page);
    await page.goto('/resumen');
    await expect(page.getByRole('heading', { level: 1, name: /^resumen$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /operaciones recientes/i })).toBeVisible();
    await capture(page, {
      file: '02-resumen-1366x768.png',
      surface: 'Resumen (/resumen)',
      viewport: '1366x768',
      state: 'corte del día + caja abierta + operaciones recientes',
    });
  });

  test('03 cobrar carrito mixto EPO + producto (línea gratuita)', async ({ page }) => {
    await installCobrarMocks(page);
    await prepareMixedCart(page);
    // A >= lg la acción vive en el panel; la barra fija móvil no se muestra.
    await expect(page.getByTestId('cobrar-primary-action')).toBeVisible();
    await expect(page.getByTestId('cobrar-mobile-action')).toBeHidden();
    await capture(page, {
      file: '03-cobrar-mixto-1366x768.png',
      surface: 'Cobrar (/cobrar)',
      viewport: '1366x768',
      state: 'carrito mixto EPO+glucosa con receta: línea gratuita visible, total valorado L. 17.25',
    });
  });

  test('04 cobrar diálogo de confirmación abierto', async ({ page }) => {
    await installCobrarMocks(page);
    await prepareMixedCart(page);
    await page.getByTestId('cobrar-primary-action').click();
    const dialog = page.getByRole('dialog', { name: /confirmar cobro/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Maria Lopez');
    await capture(page, {
      file: '04-cobrar-confirmacion-1366x768.png',
      surface: 'Cobrar (/cobrar) — diálogo',
      viewport: '1366x768',
      state: 'diálogo "Confirmar cobro" abierto sobre la cuenta valorada',
    });
  });

  test('05 recibos con detalle abierto', async ({ page }) => {
    await installRecibosMocks(page);
    await page.goto('/recibos?operacion=501');
    const detail = page.getByRole('complementary', { name: /detalle de la operación/i });
    await expect(detail).toBeVisible();
    // Composición nueva del detalle: micro-etiqueta «Operación» + número como título.
    await expect(detail.getByText('Operación', { exact: true })).toBeVisible();
    await expect(detail.getByRole('heading', { name: /A-0001/ })).toBeVisible();
    // T-UI-15: el detalle debe listar las líneas de `items`, no contradecir sus
    // totales con un vacío. Guarda el mock contra volver a omitir `items`.
    const lines = detail.getByRole('table', { name: /líneas de la operación/i });
    await expect(lines).toContainText('Glucosa basal');
    await expect(lines).toContainText('Eritropoyetina');
    await expect(lines).toContainText('L. 158.00');
    await expect(detail.getByText(/no tiene líneas registradas/i)).toHaveCount(0);
    await capture(page, {
      file: '05-recibos-detalle-1366x768.png',
      surface: 'Recibos (/recibos?operacion=501)',
      viewport: '1366x768',
      state: 'historial + panel lateral de detalle de A-0001 abierto',
    });
  });

  test('06 caja con sesión abierta', async ({ page }) => {
    await installCajaMocks(page);
    await page.goto('/caja');
    await expect(page.getByRole('heading', { level: 1, name: /^caja$/i })).toBeVisible();
    await expect(page.getByText('Caja abierta').first()).toBeVisible({ timeout: 10_000 });
    await capture(page, {
      file: '06-caja-1366x768.png',
      surface: 'Caja (/caja)',
      viewport: '1366x768',
      state: 'sesión #7 abierta con conciliación',
    });
  });

  test('07 reportes', async ({ page }) => {
    await installReportesMocks(page);
    await page.goto('/reportes');
    await expect(page.getByRole('heading', { level: 1, name: /^reportes$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /resumen del período/i })).toBeVisible();
    await capture(page, {
      file: '07-reportes-1366x768.png',
      surface: 'Reportes (/reportes)',
      viewport: '1366x768',
      state: 'reporte ejecutivo del período',
    });
  });

  test('08 administración catálogo', async ({ page }) => {
    await installCatalogAdminMocks(page);
    await page.goto('/administracion/catalogo');
    await expect(page.getByRole('heading', { level: 1, name: /^administración$/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /catálogo institucional/i }).first()).toBeVisible();
    await capture(page, {
      file: '08-administracion-catalogo-1366x768.png',
      surface: 'Administración — Catálogo (/administracion/catalogo)',
      viewport: '1366x768',
      state: 'catálogo de servicios con categoría y acciones',
    });
  });

  // --- T-QA-05: estados faltantes para la revisión visual -------------------

  test('11 cobrar emisión sin cobro (EPO con receta, total L. 0.00)', async ({ page }) => {
    await installCobrarMocks(page, { invoiceTotal: '0.00' });
    await prepareZeroCart(page);

    const primary = page.getByTestId('cobrar-primary-action');
    await expect(primary).toHaveText(/emitir sin cobro/i);
    await primary.click();

    const dialog = page.getByRole('dialog', { name: /confirmar emisión sin cobro/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/no se registrará pago/i)).toBeVisible();
    await expect(dialog.getByText(/método de pago/i)).toHaveCount(0);

    await capture(page, {
      file: '11-cobrar-emision-sin-cobro-confirmacion-1366x768.png',
      surface: 'Cobrar (/cobrar) — diálogo',
      viewport: '1366x768',
      state: 'confirmación de emisión válida sin cobro: EPO sola con receta, total L. 0.00 y sin método de pago',
    });
  });

  test('12 cobrar resultado tras emisión sin cobro', async ({ page }) => {
    await installCobrarMocks(page, { invoiceTotal: '0.00' });
    await prepareZeroCart(page);

    await page.getByTestId('cobrar-primary-action').click();
    await page.getByTestId('cobrar-confirm').click();

    await expect(page.getByRole('heading', { name: /operación emitida sin cobro/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /nueva operación/i })).toBeVisible();

    await capture(page, {
      file: '12-cobrar-resultado-sin-cobro-1366x768.png',
      surface: 'Cobrar (/cobrar) — resultado',
      viewport: '1366x768',
      state: 'posemisión sin cobro: documento, paciente, total L. 0.00 y acciones de comprobante',
    });
  });

  test('13 cobrar resultado tras cobro (estado pagado)', async ({ page }) => {
    await installCobrarMocks(page);
    await page.goto('/cobrar');
    await expect(page.getByRole('heading', { level: 1, name: /^cobrar$/i })).toBeVisible();
    await page.getByLabel(/nombre del paciente/i).fill('Carlos Rivera');
    await addService(page, 'Glucosa basal');

    const totalZone = page.getByRole('complementary', { name: /total y acción/i });
    await expect(totalZone.getByText('L. 17.25', { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.getByTestId('cobrar-primary-action').click();
    await expect(page.getByRole('dialog', { name: /confirmar cobro/i })).toBeVisible();
    await page.getByTestId('cobrar-confirm').click();

    await expect(page.getByRole('heading', { name: /operación cobrada/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^imprimir$/i })).toBeEnabled();
    await expect(page.getByRole('button', { name: /guardar pdf/i })).toBeEnabled();
    await expect(page.getByRole('button', { name: /nueva operación/i })).toBeVisible();

    await capture(page, {
      file: '13-cobrar-resultado-cobrado-1366x768.png',
      surface: 'Cobrar (/cobrar) — resultado',
      viewport: '1366x768',
      state: 'poscobro: estado cobrado con acciones Imprimir / Guardar PDF / Nueva operación',
    });
  });

  test('14 recibos diálogo de recibo institucional', async ({ page }) => {
    await installRecibosMocks(page);
    await page.goto('/recibos');

    await page
      .getByRole('row', { name: /A-0002/i })
      .getByRole('button', { name: /ver recibo/i })
      .click();

    const dialog = page.getByRole('dialog', { name: /comprobante de factura - A-0002/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTitle(/vista previa del recibo institucional REC-00000070/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /guardar pdf/i })).toBeVisible();

    await capture(page, {
      file: '14-recibos-recibo-institucional-1366x768.png',
      surface: 'Recibos (/recibos) — diálogo',
      viewport: '1366x768',
      state: 'comprobante institucional REC-00000070 listo: vista previa, Guardar PDF y Reimprimir',
    });
  });

  test('15 cambio obligatorio de contraseña', async ({ page }) => {
    await installFallback(page, 'password-change');
    await installAdminApi(page, {
      user: { ...VISUAL_USER, must_change_password: true },
    });
    await page.goto('/resumen');

    await expect(page.getByRole('heading', { name: /cambio obligatorio de contraseña/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /actualizar contraseña/i })).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    await capture(page, {
      file: '15-cambio-contrasena-1366x768.png',
      surface: 'Cambio obligatorio de contraseña (PasswordChangeView)',
      viewport: '1366x768',
      state: 'formulario con requisitos de clave, tres campos y acción primaria única',
    });
  });

  test('16 caja pestaña Arqueo', async ({ page }) => {
    await installCajaMocks(page);
    await page.goto('/caja');
    await expect(page.getByText('Caja abierta').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: /^arqueo$/i }).click();
    await expect(page.getByRole('heading', { name: /(?:control contable de caja|control del cierre)/i })).toBeVisible();

    // T-UI-23: un arqueo sin conteo ingresado no puede leerse como importe
    // monetario implícito; el fallback vigente es "Pendiente".
    const countedTotal = page.getByRole('status', { name: /total contado por denominaciones/i });
    await expect(countedTotal).toContainText('Pendiente');
    await expect(countedTotal).not.toContainText('L. 0.00');

    // T-UI-22: composición legible del conteo por denominaciones.
    const denominationMetrics = await denominationCounterMetrics(page);
    expectDenominationCounterLegible(denominationMetrics);
    const layout = await layoutMetrics(page);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);

    await capture(page, {
      file: '16-caja-arqueo-1366x768.png',
      surface: 'Caja (/caja) — pestaña Arqueo',
      viewport: '1366x768',
      state: 'arqueo: resumen de sesión, conteo de denominaciones y Control contable de caja',
      notes: `conteo: etiquetas=${JSON.stringify(denominationMetrics.labels)}; doc scrollWidth=${layout.scrollWidth}px clientWidth=${layout.clientWidth}px`,
    });
  });
});

test.describe('VISUAL — móvil 390x844', () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test('09 cobrar móvil', async ({ page }) => {
    await installCobrarMocks(page);
    await prepareMixedCart(page);
    const layout = await layoutMetrics(page);
    // T-UI-13: las tres zonas se apilan en una columna y no desbordan el viewport.
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    // Una sola acción "Cobrar": la aporta la barra fija, no el panel.
    await expect(page.getByTestId('cobrar-mobile-action')).toBeVisible();
    await expect(page.getByTestId('cobrar-primary-action')).toBeHidden();
    await capture(page, {
      file: '09-cobrar-390x844.png',
      surface: 'Cobrar (/cobrar)',
      viewport: '390x844',
      state: 'carrito mixto con receta en columna estrecha',
      notes: `documentElement.scrollWidth=${layout.scrollWidth}px clientWidth=${layout.clientWidth}px`,
    });
  });

  test('10 resumen móvil', async ({ page }) => {
    await installResumenMocks(page);
    await page.goto('/resumen');
    await expect(page.getByRole('heading', { level: 1, name: /^resumen$/i })).toBeVisible();
    const layout = await layoutMetrics(page);
    await capture(page, {
      file: '10-resumen-390x844.png',
      surface: 'Resumen (/resumen)',
      viewport: '390x844',
      state: 'corte del día en columna estrecha',
      notes: `documentElement.scrollWidth=${layout.scrollWidth}px clientWidth=${layout.clientWidth}px`,
    });
  });

  test('16 caja Arqueo legible sin desbordes en columna estrecha', async ({ page }) => {
    await installCajaMocks(page);
    await page.goto('/caja');
    await expect(page.getByText('Caja abierta').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('tab', { name: /^arqueo$/i }).click();
    await expect(page.getByRole('heading', { name: /(?:control contable de caja|control del cierre)/i })).toBeVisible();

    // T-UI-22: misma garantía de lectura a 390 px, sin captura adicional.
    expectDenominationCounterLegible(await denominationCounterMetrics(page));
    const layout = await layoutMetrics(page);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
  });
});

test.afterAll(() => {
  const payload = {
    task_id: 'T-QA-05',
    previous_task_id: 'T-QA-03',
    generated_at: new Date().toISOString(),
    base_url: 'http://127.0.0.1:4173 (Vite dev + mocks Playwright; sin backend)',
    viewports: {
      desktop: DESKTOP_VIEWPORT,
      mobile: MOBILE_VIEWPORT,
    },
    note: 'Capturas full-page. NO representan aprobación visual; el coordinador las inspecciona.',
    captures: manifest,
    unexpected_api_requests: getUnexpectedApis(),
  };
  writeFileSync(resolve(OUTPUT_DIR, 'MANIFEST.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
});
