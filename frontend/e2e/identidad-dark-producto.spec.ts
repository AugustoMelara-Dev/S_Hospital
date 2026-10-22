import { expect, test, type Page, type Response } from '@playwright/test';
import {
  ADMIN,
  API_URL,
  CASHIER,
  fetchJson,
  login,
  logout,
  responseEvidence,
  saveDownload,
  writeEvidence,
  type ApiEvidence,
} from './identidad-dark-helpers';

/**
 * Suite de mutaciones del producto bajo la identidad dark institucional.
 * Renombrada desde `azul-blanco-producto.spec.ts`: mismas aserciones
 * funcionales (caja, cobro, EPO por línea, exportaciones, conciliación) contra
 * backend real preparado (sh_ai_lab_local). No hay aserciones de identidad
 * clara — el anclaje visual dark lo lleva `identidad-dark-capturas.spec.ts`.
 */

async function addCatalogItem(page: Page, query: string, useEnter = false): Promise<void> {
  const search = page.getByRole('searchbox', { name: /buscar servicio o producto/i });
  await expect(search).toBeVisible();
  await search.fill(query);

  const results = page.getByRole('list', { name: /resultados del catálogo/i });
  await expect(results).toBeVisible();
  const result = results.getByRole('button', { name: new RegExp(`^agregar\\s+${escapeRegex(query)}$`, 'i') });
  await expect(result).toBeVisible();

  if (useEnter) {
    await search.press('Enter');
  } else {
    await result.click();
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const allowMutations = (process.env.DARK_ALLOW_MUTATIONS ?? process.env.AZB_ALLOW_MUTATIONS) === '1';
const runId = process.env.DARK_RUN_ID ?? process.env.AZB_RUN_ID ?? `dark-${Date.now()}`;
const apiEvidence: ApiEvidence[] = [];

test.describe.configure({ mode: 'serial' });
test.skip(!allowMutations, 'Use DARK_ALLOW_MUTATIONS=1 únicamente contra sh_ai_lab_local preparado.');

test.beforeAll(async ({ request }) => {
  const health = await request.get(`${API_URL}/api/health`);
  expect(health.ok()).toBe(true);
});

test.afterAll(() => {
  writeEvidence('qa-api-ids.json', { run_id: runId, responses: apiEvidence });
});

test('caja: cierra el fixture y abre un turno nuevo desde la UI', async ({ page }) => {
  await login(page, CASHIER);
  await page.goto('/caja');

  const current = await fetchJson<{ data: null | Record<string, unknown> }>(page, '/api/cash-sessions/current');
  expect(current.status).toBe(200);
  const session = current.body.data;

  if (session?.status === 'open') {
    const expected = String(
      session.expected_cash_amount ?? session.expected_amount ?? session.opening_amount ?? '0.00',
    );
    await page.getByRole('tab', { name: 'Cierre' }).click();
    await page.getByLabel('Monto contado (L.)').fill(expected);
    await page.getByLabel('Nota de cierre').fill(`DARK-QA ${runId} cierre de preparación`);
    await page.getByRole('region', { name: /cerrar el turno/i }).getByRole('button', { name: /cerrar caja/i }).click();
    const dialog = page.getByRole('dialog', { name: /cierre de caja/i });
    const closeResponsePromise = page.waitForResponse((candidate) =>
      candidate.request().method() === 'POST' && /\/api\/cash-sessions\/\d+\/close$/.test(candidate.url()),
    );
    await dialog.getByRole('button', { name: /^cerrar caja$/i }).click();
    const closeResponse = await closeResponsePromise;
    expect(closeResponse.ok(), `close ${closeResponse.status()}`).toBe(true);
    apiEvidence.push(await responseEvidence(closeResponse));
    await expect(page.getByRole('heading', { name: /resumen de cierre confirmado/i })).toBeVisible();
  }

  const opening = page.getByRole('region', { name: /apertura de caja/i });
  await expect(opening).toBeVisible();
  const registerSelect = opening.getByLabel('Caja física');
  const azbRegisterValue = await registerSelect.locator('option').filter({ hasText: /Caja AZB QA/i }).getAttribute('value');
  expect(azbRegisterValue).toBeTruthy();
  await registerSelect.selectOption(azbRegisterValue!);
  await opening.getByLabel('Monto inicial (L.)').fill('100.00');
  await opening.getByRole('button', { name: /^abrir caja$/i }).click();
  const confirm = page.getByRole('dialog', { name: /confirmar apertura de caja/i });
  const openResponsePromise = page.waitForResponse((candidate) =>
    candidate.request().method() === 'POST' && /\/api\/cash-sessions\/open$/.test(candidate.url()),
  );
  await confirm.getByRole('button', { name: /^abrir caja$/i }).click();
  const openResponse = await openResponsePromise;
  expect(openResponse.ok(), `open ${openResponse.status()}`).toBe(true);
  apiEvidence.push(await responseEvidence(openResponse));

  const identity = page.getByRole('region', { name: /caja, usuario y sesión/i });
  await expect(identity).toContainText('AZB QA Caja');
  await expect(identity).toContainText(/caja abierta/i);
  await expect(identity).toContainText(/caja azb qa/i);
});

test('vista previa del comprobante usa backend real sin emitir factura, pago ni recibo', async ({ page }) => {
  await login(page, CASHIER);
  await page.goto('/cobrar');
  const patientName = `DARK-QA ${runId} BORRADOR`;
  const before = await fetchJson<{ data: unknown[]; meta?: { total?: number } }>(
    page,
    `/api/invoices?patient=${encodeURIComponent(patientName)}&per_page=10`,
  );
  expect(before.status).toBe(200);
  expect(before.body.meta?.total ?? before.body.data.length).toBe(0);

  await page.getByLabel(/nombre del paciente/i).fill(patientName);
  await addCatalogItem(page, 'Glucosa');
  const previewButton = page.getByRole('button', { name: /^vista previa$/i });
  await expect(previewButton).toBeEnabled();
  const documentResponsePromise = page.waitForResponse((candidate) =>
    candidate.request().method() === 'POST' && /\/api\/invoices\/receipt-preview$/.test(candidate.url()),
  );
  await previewButton.click();
  const documentResponse = await documentResponsePromise;
  expect(documentResponse.ok()).toBe(true);
  const documentBody = await documentResponse.json() as {
    data: {
      draft: boolean;
      watermark: string;
      reserved_number: boolean;
      html: string;
      document: { page_count: number; paper: { kind: string; orientation: string } };
    };
  };
  expect(documentBody.data.draft).toBe(true);
  expect(documentBody.data.reserved_number).toBe(false);
  expect(documentBody.data.watermark).toBe('BORRADOR - SIN VALIDEZ');
  expect(documentBody.data.document.page_count).toBeGreaterThan(0);
  // §4 papel: el borrador vive en documento sobre papel blanco; el watermark
  // institucional es la aserción, no el fondo de la pantalla.
  expect(documentBody.data.html).toContain('BORRADOR - SIN VALIDEZ');
  expect(JSON.stringify(documentBody)).not.toMatch(/"(?:invoice|payment|receipt)_id"\s*:/i);
  const dialog = page.getByRole('dialog', { name: /vista previa del comprobante/i });
  await expect(dialog.getByText('BORRADOR - SIN VALIDEZ', { exact: true })).toBeVisible();
  await expect(dialog.getByTitle(/vista previa del comprobante antes de emitir/i)).toBeVisible();

  const after = await fetchJson<{ data: unknown[]; meta?: { total?: number } }>(
    page,
    `/api/invoices?patient=${encodeURIComponent(patientName)}&per_page=10`,
  );
  expect(after.status).toBe(200);
  expect(after.body.meta?.total ?? after.body.data.length).toBe(0);
  apiEvidence.push(await responseEvidence(documentResponse));
});

test('cobrar: Enter agrega, >1000 se valora y doble envío crea una sola operación', async ({ page }) => {
  await login(page, CASHIER);
  await page.goto('/cobrar');
  await expect(page.getByLabel(/nombre del paciente/i)).toHaveValue('');
  await expect(page.getByText(/la cuenta está vacía/i)).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /receta de diálisis/i })).toHaveCount(0);

  let invoicePosts = 0;
  let paymentPosts = 0;
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (request.method() === 'POST' && pathname === '/api/invoices') invoicePosts += 1;
    if (request.method() === 'POST' && /\/api\/invoices\/\d+\/payments$/.test(pathname)) paymentPosts += 1;
  });

  const catalogResponsePromise = page.waitForResponse((candidate) =>
    candidate.request().method() === 'GET' && /\/api\/services\?/.test(candidate.url()) && candidate.url().toLowerCase().includes('glucosa'),
  );
  await addCatalogItem(page, 'Glucosa', true);
  const catalogResponse = await catalogResponsePromise;
  const catalog = await catalogResponse.json() as { data: Array<{ name: string; price: string }> };
  const catalogGlucose = catalog.data.find((service) => /glucosa/i.test(service.name));
  expect(catalogGlucose).toBeDefined();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(invoicePosts).toBe(0);

  await page.getByLabel(/nombre del paciente/i).fill(`DARK-QA ${runId} MIL UNO`);
  const quantity = page.getByLabel(/^cantidad de glucosa$/i);
  const previewResponsePromise = page.waitForResponse((candidate) =>
    candidate.request().method() === 'POST' && /\/api\/invoices\/preview$/.test(candidate.url()),
  );
  await quantity.fill('1001');
  const previewResponse = await previewResponsePromise;
  expect(previewResponse.ok()).toBe(true);
  const preview = await previewResponse.json() as {
    data: {
      tax: { rate_basis_points: number };
      totals: { subtotal_cents: number; tax_cents: number; total_cents: number };
      items: Array<{ service_name: string; quantity: string; unit_price_registered_cents: number; line_subtotal_cents: number }>;
    };
  };
  const unitCents = Math.round(Number(catalogGlucose?.price) * 100);
  const expectedSubtotal = unitCents * 1001;
  const expectedTax = Math.round((expectedSubtotal * preview.data.tax.rate_basis_points) / 10_000);
  expect(preview.data.items[0]).toMatchObject({
    quantity: '1001.00',
    unit_price_registered_cents: unitCents,
    line_subtotal_cents: expectedSubtotal,
  });
  expect(preview.data.totals).toMatchObject({
    subtotal_cents: expectedSubtotal,
    tax_cents: expectedTax,
    total_cents: expectedSubtotal + expectedTax,
  });

  await page.getByTestId('cobrar-primary-action').click();
  const dialog = page.getByRole('dialog', { name: /confirmar cobro/i });
  await dialog.getByRole('button', { name: /monto exacto/i }).click();
  const invoiceResponsePromise = page.waitForResponse((candidate) =>
    candidate.request().method() === 'POST' && new URL(candidate.url()).pathname === '/api/invoices',
  );
  const paymentResponsePromise = page.waitForResponse((candidate) =>
    candidate.request().method() === 'POST' && /\/api\/invoices\/\d+\/payments$/.test(candidate.url()),
  );
  await dialog.getByTestId('cobrar-confirm').evaluate((button: HTMLElement) => {
    button.click();
    button.click();
  });
  const [invoiceResponse, paymentResponse] = await Promise.all([invoiceResponsePromise, paymentResponsePromise]);
  expect(invoiceResponse.ok()).toBe(true);
  expect(paymentResponse.ok()).toBe(true);
  apiEvidence.push(await responseEvidence(invoiceResponse), await responseEvidence(paymentResponse));
  await expect(page.getByRole('heading', { name: /operación cobrada/i })).toBeVisible();
  expect(invoicePosts).toBe(1);
  expect(paymentPosts).toBe(1);

  const paymentEvidence = await responseEvidence(paymentResponse);
  const receiptId = paymentEvidence.receipt_id;
  expect(receiptId).toBeDefined();
  const pdfResponsePromise = page.waitForResponse((candidate) =>
    candidate.request().method() === 'GET' && new URL(candidate.url()).pathname === `/api/institutional-receipts/${receiptId}/pdf`,
  );
  const pdfDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /guardar pdf/i }).click();
  expect((await pdfResponsePromise).ok()).toBe(true);
  await saveDownload(await pdfDownloadPromise, 'qa-comprobante-mil-uno.pdf');

  const postCount = invoicePosts + paymentPosts;
  await page.route(/\/api\/institutional-receipts\/\d+\/pdf(?:\?|$)/, (route) => route.abort('failed'));
  await page.getByRole('button', { name: /guardar pdf/i }).click();
  await expect(page.getByText(/no se pudo|error|conexión/i).last()).toBeVisible();
  expect(invoicePosts + paymentPosts).toBe(postCount);
});

test('cobrar: EPO mixta solo bonifica la línea elegible y cero autorizado no crea pago', async ({ page }) => {
  await login(page, CASHIER);
  await page.goto('/cobrar');
  const patient = page.getByLabel(/nombre del paciente/i);
  await patient.fill(`DARK-QA ${runId} EPO MIXTA`);
  await addCatalogItem(page, 'Eritropoyetina');
  await addCatalogItem(page, 'Glucosa');
  const previewResponsePromise = page.waitForResponse((candidate) =>
    candidate.request().method() === 'POST'
      && /\/api\/invoices\/preview$/.test(candidate.url())
      && candidate.request().postDataJSON()?.dialysis_prescription === true
      && candidate.request().postDataJSON()?.items?.length === 2,
  );
  await page.getByRole('checkbox', { name: /paciente con receta de diálisis/i }).check();
  const previewResponse = await previewResponsePromise;
  const preview = await previewResponse.json() as {
    data: { totals: { total_cents: number }; items: Array<{ service_name: string; special_rule_applied: boolean; line_total_cents: number }> };
  };
  const epo = preview.data.items.find((item) => /eritropoyetina/i.test(item.service_name));
  const glucose = preview.data.items.find((item) => /glucosa/i.test(item.service_name));
  expect(epo).toMatchObject({ special_rule_applied: true, line_total_cents: 0 });
  expect(glucose?.special_rule_applied).toBe(false);
  expect(glucose?.line_total_cents).toBeGreaterThan(0);
  expect(preview.data.totals.total_cents).toBeGreaterThan(0);
  await expect(page.getByText(/sin cobro por receta/i).first()).toBeVisible();

  await payCurrentAccount(page);
  await expect(page.getByRole('heading', { name: /operación cobrada/i })).toBeVisible();
  await page.getByRole('button', { name: /nueva operación/i }).click();
  await expect(patient).toHaveValue('');
  await expect(page.getByText(/la cuenta está vacía/i)).toBeVisible();

  await patient.fill(`DARK-QA ${runId} EPO CERO`);
  await addCatalogItem(page, 'Eritropoyetina');
  const condition = page.getByRole('checkbox', { name: /paciente con receta de diálisis/i });
  await expect(condition).not.toBeChecked();
  await condition.check();
  await expect(page.getByTestId('cobrar-primary-action')).toHaveText(/emitir sin cobro/i);

  let paymentPosts = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/api\/invoices\/\d+\/payments$/.test(new URL(request.url()).pathname)) {
      paymentPosts += 1;
    }
  });
  await page.getByTestId('cobrar-primary-action').click();
  const zeroDialog = page.getByRole('dialog', { name: /confirmar emisión sin cobro/i });
  const invoiceResponsePromise = page.waitForResponse((candidate) =>
    candidate.request().method() === 'POST' && new URL(candidate.url()).pathname === '/api/invoices',
  );
  await zeroDialog.getByTestId('cobrar-confirm').evaluate((button: HTMLElement) => {
    button.click();
    button.click();
  });
  const invoiceResponse = await invoiceResponsePromise;
  expect(invoiceResponse.ok()).toBe(true);
  apiEvidence.push(await responseEvidence(invoiceResponse));
  await expect(page.getByRole('heading', { name: /operación emitida sin cobro/i })).toBeVisible();
  expect(paymentPosts).toBe(0);
});

test('error de valoración distingue error de cero y bloquea la acción', async ({ page }) => {
  await login(page, CASHIER);
  await page.route(/\/api\/invoices\/preview$/, (route) => route.abort('connectionfailed'));
  await page.goto('/cobrar');
  await page.getByLabel(/nombre del paciente/i).fill(`DARK-QA ${runId} ERROR`);
  await addCatalogItem(page, 'Glucosa');
  await expect(page.getByText(/no se pudo confirmar el total|no se pudo conectar/i).first()).toBeVisible();
  await expect(page.getByTestId('cobrar-primary-action')).toBeDisabled();
  const totalZone = page.getByRole('complementary', { name: /total y acción/i });
  await expect(totalZone).not.toContainText('L. 0.00');
});

test('recibos, navegación y exportaciones conservan el mismo filtro/API', async ({ page }) => {
  await login(page, CASHIER);
  for (const [label, path] of [
    ['Resumen', '/resumen'],
    ['Cobrar', '/cobrar'],
    ['Recibos', '/recibos'],
    ['Caja', '/caja'],
    ['Reportes', '/reportes'],
  ] as const) {
    await page.getByRole('navigation', { name: /navegación principal/i }).getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}(?:\\?|$)`));
    await expect(page.getByRole('heading', { level: 1, name: label })).toBeVisible();
  }

  await page.goto('/recibos');
  await page.getByRole('searchbox', { name: /paciente o número/i }).fill('DARK-QA');
  await page.getByRole('button', { name: /^buscar$/i }).click();
  await expect(page.getByRole('region', { name: /resultados del historial/i })).toContainText('DARK-QA');

  await logout(page);
  await login(page, ADMIN);
  await page.goto('/reportes');
  await page.getByRole('button', { name: /^hoy$/i }).click();
  const reportResponsePromise = page.waitForResponse((candidate) =>
    candidate.request().method() === 'GET' && /\/api\/reports\/executive\?/.test(candidate.url()),
  );
  await page.getByRole('button', { name: /^aplicar$/i }).click();
  const reportResponse = await reportResponsePromise;
  expect(reportResponse.ok()).toBe(true);
  const reportBody = await reportResponse.json() as Record<string, unknown>;
  const reportUrl = new URL(reportResponse.url());
  writeEvidence('qa-reporte-api-mismo-filtro.json', {
    run_id: runId,
    filters: Object.fromEntries(reportUrl.searchParams.entries()),
    response: reportBody,
  });

  const reportFilters = Object.fromEntries(reportUrl.searchParams.entries());
  const pdfResponsePromise = page.waitForResponse((candidate) => /\/api\/reports\/executive\/pdf\?/.test(candidate.url()));
  const pdfPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /exportar pdf/i }).click();
  const pdfResponse = await pdfResponsePromise;
  expect(pdfResponse.ok()).toBe(true);
  expect(Object.fromEntries(new URL(pdfResponse.url()).searchParams.entries())).toEqual(reportFilters);
  await saveDownload(await pdfPromise, 'qa-reporte-ejecutivo.pdf');
  const excelResponsePromise = page.waitForResponse((candidate) => /\/api\/reports\/executive\/excel\?/.test(candidate.url()));
  const excelPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /exportar excel/i }).click();
  const excelResponse = await excelResponsePromise;
  expect(excelResponse.ok()).toBe(true);
  expect(Object.fromEntries(new URL(excelResponse.url()).searchParams.entries())).toEqual(reportFilters);
  await saveDownload(await excelPromise, 'qa-reporte-ejecutivo.xlsx');
});

test('caja: arqueo final concilia los cobros creados y cierra el turno desde la UI', async ({ page }) => {
  await login(page, CASHIER);
  await page.goto('/caja');
  const current = await fetchJson<{ data: Record<string, unknown> }>(page, '/api/cash-sessions/current');
  expect(current.status).toBe(200);
  const session = current.body.data;
  expect(session.status).toBe('open');
  expect(Number(session.payments_count ?? 0)).toBeGreaterThan(0);
  const expectedCash = String(session.expected_cash_amount ?? session.expected_amount);

  await page.getByRole('tab', { name: 'Arqueo' }).click();
  await expect(page.getByRole('region', { name: /arqueo|conteo/i })).toBeVisible();
  await page.getByRole('tab', { name: 'Cierre' }).click();
  await page.getByLabel('Monto contado (L.)').fill(expectedCash);
  await page.getByLabel('Nota de cierre').fill(`DARK-QA ${runId} cierre conciliado final`);
  await page.getByRole('region', { name: /cerrar el turno/i }).getByRole('button', { name: /cerrar caja/i }).click();
  const dialog = page.getByRole('dialog', { name: /cierre de caja/i });
  const closeResponsePromise = page.waitForResponse((candidate) =>
    candidate.request().method() === 'POST' && /\/api\/cash-sessions\/\d+\/close$/.test(candidate.url()),
  );
  await dialog.getByRole('button', { name: /^cerrar caja$/i }).click();
  const closeResponse = await closeResponsePromise;
  expect(closeResponse.ok()).toBe(true);
  const closeBody = await closeResponse.json() as { data: Record<string, unknown> };
  expect(closeBody.data).toMatchObject({ status: 'closed', closing_amount: expectedCash, difference_amount: '0.00' });
  apiEvidence.push(await responseEvidence(closeResponse));
  writeEvidence('qa-cierre-conciliado.json', {
    run_id: runId,
    cash_session_id: session.id,
    expected_cash_amount: expectedCash,
    payments_count: session.payments_count,
    payments_total: session.payments_total,
    close: closeBody.data,
  });
  await expect(page.getByRole('heading', { name: /resumen de cierre confirmado/i })).toBeVisible();
});

async function payCurrentAccount(page: Page): Promise<void> {
  await page.getByTestId('cobrar-primary-action').click();
  const dialog = page.getByRole('dialog', { name: /confirmar cobro/i });
  await dialog.getByRole('button', { name: /monto exacto/i }).click();
  const responses: Promise<Response>[] = [
    page.waitForResponse((candidate) => candidate.request().method() === 'POST' && new URL(candidate.url()).pathname === '/api/invoices'),
    page.waitForResponse((candidate) => candidate.request().method() === 'POST' && /\/api\/invoices\/\d+\/payments$/.test(candidate.url())),
  ];
  await dialog.getByTestId('cobrar-confirm').click();
  for (const response of await Promise.all(responses)) {
    expect(response.ok()).toBe(true);
    apiEvidence.push(await responseEvidence(response));
  }
}
