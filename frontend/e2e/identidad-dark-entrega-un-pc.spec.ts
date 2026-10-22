import { expect, test, type Locator, type Page, type Response } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  ADMIN,
  BASE_URL,
  CASHIER,
  EVIDENCE_ROOT,
  addCatalogItem,
  fetchJson,
  login,
  logout,
  responseEvidence,
  safeFilePart,
  saveDownload,
  writeEvidence,
  type ApiEvidence,
} from './identidad-dark-helpers';

/**
 * Recorrido de entrega en una computadora bajo la identidad dark
 * (renombrado desde `azul-blanco-entrega-un-pc.spec.ts`). Toda la batería es
 * funcional (catálogo, snapshot de precio, respaldos, papel carta 2 copias);
 * ninguna aserción de identidad clara queda vigente.
 */

const allowMutations = (process.env.DARK_ALLOW_MUTATIONS ?? process.env.AZB_ALLOW_MUTATIONS) === '1';
const runId = process.env.DARK_RUN_ID ?? process.env.AZB_RUN_ID ?? `eupc-${Date.now()}`;
const categoryName = `EUPC-${runId}`;
const serviceName = `EUPC ${runId} concepto`;
const patientName = `EUPC ${runId} SNAPSHOT`;
const priceSeed = 13_700 + (numericSuffix(runId) % 700);
const initialPrice = centsToInput(priceSeed);
const updatedPrice = centsToInput(priceSeed + 111);
const priceReason = `EUPC ${runId} ajuste autorizado`;
const deactivationReason = `EUPC ${runId} cierre de prueba`;
const apiEvidence: ApiEvidence[] = [];
const captures: Array<{ file: string; width: number; height: number }> = [];
const blockedExternalRequests: Array<{ origin: string; pathname: string; resource_type: string }> = [];
const resumeServiceId = Number(process.env.DARK_RESUME_SERVICE_ID ?? process.env.AZB_RESUME_SERVICE_ID ?? 0) || undefined;
const resumeCategoryId = Number(process.env.DARK_RESUME_CATEGORY_ID ?? process.env.AZB_RESUME_CATEGORY_ID ?? 0) || undefined;
const resumeAfterPrice = (process.env.DARK_RESUME_AFTER_PRICE ?? process.env.AZB_RESUME_AFTER_PRICE) === '1';
let backupDownloadFile: string | null = null;
const twoCopyReceiptFile = 'qa-comprobante-carta-vertical-dos-ejemplares.pdf';

type CatalogState = {
  categoryId?: number;
  serviceId?: number;
  invoiceId?: number;
  paymentId?: number;
  receiptId?: number;
  initialPriceCents: number;
  updatedPriceCents: number;
};

const state: CatalogState = {
  initialPriceCents: priceSeed,
  updatedPriceCents: priceSeed + 111,
};

test.skip(!allowMutations, 'Use DARK_ALLOW_MUTATIONS=1 únicamente contra sh_ai_lab_local preparado.');
test.use({ actionTimeout: 15_000 });

test.beforeEach(async ({ context }) => {
  await context.route(/^https?:\/\//, async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1') {
      await route.continue();
      return;
    }
    blockedExternalRequests.push({
      origin: url.origin,
      pathname: url.pathname,
      resource_type: route.request().resourceType(),
    });
    await route.abort('blockedbyclient');
  });
});

test.afterEach(() => {
  expect(blockedExternalRequests, 'La operación local no debe solicitar recursos de Internet.').toEqual([]);
});

test.afterAll(() => {
  writeEvidence('qa-entrega-un-pc-ids.json', {
    run_id: runId,
    category_name: categoryName,
    service_name: serviceName,
    patient_name: patientName,
    ...state,
    responses: apiEvidence,
  });
  writeEvidence('qa-entrega-un-pc-capturas.json', {
    run_id: runId,
    base_url: BASE_URL,
    files: captures.map((capture) => capture.file),
    captures,
  });
  writeEvidence('qa-entrega-un-pc-origen-artefactos.json', {
    run_id: runId,
    ui_downloads: [
      'qa-comprobante-mil-uno.pdf',
      twoCopyReceiptFile,
      'qa-reporte-ejecutivo.pdf',
      'qa-reporte-ejecutivo.xlsx',
      ...(backupDownloadFile ? [backupDownloadFile] : []),
    ],
    note: 'Estos archivos se descargan desde botones de la aplicación en identidad-dark-producto.spec.ts. Los renders de inspección se guardan con nombres distintos.',
  });
  writeEvidence('qa-entrega-un-pc-red-externa.json', {
    run_id: runId,
    policy: 'Se permitieron únicamente localhost, 127.0.0.1 y ::1; todo origen externo habría sido bloqueado y habría fallado la prueba.',
    blocked_requests: blockedExternalRequests,
  });
});

test('acceso y ayuda comunican capacidades sin depender de Internet', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/login');
  await page.getByRole('button', { name: /olvidó su contraseña/i }).click();
  await expect(page.getByText(/otro administrador.*administración.*usuarios/i)).toBeVisible();
  await expect(page.getByText(/recuperar acceso a s_hospital.*inicio de windows/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /recuperar acceso/i })).toHaveCount(0);
  await settledScreenshot(page, 'login-recuperacion-desktop-1366x768.png');

  await login(page, ADMIN);
  await page.goto('/administracion/ayuda');
  await expect(page.getByRole('heading', { level: 1, name: /administración/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /ayuda por tarea/i })).toBeVisible();
  const reprintHelp = page.locator('li').filter({ hasText: 'Buscar o reimprimir' });
  await reprintHelp.getByText(/cómo hacerlo/i).click();
  await expect(reprintHelp.getByText(/si la impresión falla.*no cobre otra vez/i)).toBeVisible();
  await settledScreenshot(page, 'ayuda-desktop-1366x768.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await settledScreenshot(page, 'ayuda-mobile-390x844.png');

  await page.setViewportSize({ width: 1366, height: 768 });
  await configureLetterTwoCopies(page);
});

test('respaldo creado desde la UI comunica integridad y restauración con honestidad', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await login(page, ADMIN);
  const backupsResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'GET' && /\/api\/backups(?:\?|$)/.test(response.url())
  ));
  await page.goto('/administracion/mantenimiento/respaldos');
  const backupsResponse = await backupsResponsePromise;
  expect(backupsResponse.ok(), `backups ${backupsResponse.status()}`).toBe(true);
  const backupsBody = await backupsResponse.json() as {
    data: Array<{ id: number; status?: string; verify_status?: string; verification_scope?: string | null; restore_tested?: boolean }>;
  };
  const explicitIntegrity = backupsBody.data.find((backup) => backup.verification_scope === 'encrypted_file_integrity');
  if (explicitIntegrity) {
    expect(explicitIntegrity.verify_status).toBe('verified');
    expect(explicitIntegrity.restore_tested).toBe(false);
    await expect(page.getByRole('status', { name: /salud del respaldo/i })).toContainText(/integridad verificada/i);
  } else {
    await expect(page.getByRole('status', { name: /salud del respaldo/i })).toContainText(/sin verificar|requiere prueba|error/i);
  }
  await expect(page.getByText(/restauración no probada en este equipo/i).first()).toBeVisible();
  await expect(page.getByText(/restauración probada en este equipo/i)).toHaveCount(0);
  await expect(page.getByRole('group', { name: /historial de respaldos locales/i }).first()).toBeVisible();
  await settledScreenshot(page, 'respaldos-desktop-1366x768.png');

  const completedAfterUiCreation = backupsBody.data.find((backup) => backup.status === 'success');
  expect(completedAfterUiCreation, 'El respaldo creado previamente desde la UI debe estar procesado.').toBeDefined();
  writeEvidence('qa-entrega-un-pc-respaldo-final.json', {
    run_id: runId,
    backup_id: completedAfterUiCreation!.id,
    status: completedAfterUiCreation!.status,
    verification_scope: completedAfterUiCreation!.verification_scope,
    restore_tested: completedAfterUiCreation!.restore_tested,
  });
  expect(completedAfterUiCreation!.restore_tested).toBe(false);
  const refresh = page.getByRole('button', { name: /actualizar respaldos y estado operativo/i });
  await expect(refresh).toBeEnabled();
  await refresh.click();
  const backupDownloadButton = page.getByRole('button', { name: /descargar respaldo del/i }).first();
  await expect(backupDownloadButton).toBeVisible({ timeout: 20_000 });
  await expect(backupDownloadButton).toBeVisible();
  await backupDownloadButton.click();
  const downloadDialog = page.getByRole('dialog', { name: /descargar respaldo/i });
  await expect(downloadDialog).toContainText(/acción queda auditada/i);
  const backupDownloadPromise = page.waitForEvent('download');
  await downloadDialog.getByRole('button', { name: /^descargar$/i }).click();
  const backupDownload = await backupDownloadPromise;
  backupDownloadFile = `qa-respaldo-ui-${safeFilePart(backupDownload.suggestedFilename())}`;
  await saveDownload(backupDownload, backupDownloadFile);

  await page.setViewportSize({ width: 390, height: 844 });
  await settledScreenshot(page, 'respaldos-mobile-390x844.png');
});

test('catálogo real conserva el precio histórico y audita el cambio y la desactivación', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await login(page, ADMIN);
  await configureLetterTwoCopies(page);
  await openSettledCatalog(page);

  if (resumeServiceId && resumeCategoryId) {
    state.serviceId = resumeServiceId;
    state.categoryId = resumeCategoryId;
  } else {
    await page.getByRole('button', { name: /crear nueva categoría/i }).click();
    const categoryDialog = page.getByRole('dialog', { name: /nueva categoría/i });
    await categoryDialog.getByLabel(/nombre/i).fill(categoryName);
    await categoryDialog.getByLabel(/^orden$/i).fill('90');
    const createCategoryResponsePromise = page.waitForResponse(isCategoryCreateResponse);
    await categoryDialog.getByRole('button', { name: /crear categoría/i }).click();
    const createCategoryResponse = await createCategoryResponsePromise;
    expect(createCategoryResponse.ok(), `category create ${createCategoryResponse.status()}`).toBe(true);
    const category = await responseData(createCategoryResponse);
    state.categoryId = numberId(category.id, 'category');
    apiEvidence.push(await responseEvidence(createCategoryResponse));

    await page.getByRole('button', { name: /crear nuevo producto o servicio/i }).click();
    const serviceDialog = page.getByRole('dialog', { name: /nuevo producto o servicio/i });
    await serviceDialog.getByLabel(/nombre/i).fill(serviceName);
    await serviceDialog.getByLabel(/categoría/i).selectOption({ label: categoryName });
    await selectFirstRealOption(serviceDialog.getByLabel(/área/i));
    await expect(serviceDialog.getByLabel(/nombre/i)).toHaveValue(serviceName);
    await serviceDialog.getByLabel(/precio/i).fill(initialPrice);
    const createServiceResponsePromise = page.waitForResponse(isServiceCreateResponse);
    await serviceDialog.getByRole('button', { name: /^crear$/i }).click();
    const createServiceResponse = await createServiceResponsePromise;
    expect(createServiceResponse.ok(), `service create ${createServiceResponse.status()}`).toBe(true);
    const createdService = await responseData(createServiceResponse);
    state.serviceId = numberId(createdService.id, 'service');
    expect(moneyToCents(createdService.price)).toBe(state.initialPriceCents);
    apiEvidence.push(await responseEvidence(createServiceResponse));
  }

  if (!resumeAfterPrice) {
  await filterCatalog(page, serviceName);
  await expect(page.getByText(serviceName, { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: /listado de productos y servicios/i })).toContainText(initialPrice);
  await settledScreenshot(page, 'catalogo-concepto-inicial-desktop-1366x768.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await settledScreenshot(page, 'catalogo-concepto-inicial-mobile-390x844.png');
  await page.setViewportSize({ width: 1366, height: 768 });

  await logout(page);
  await login(page, CASHIER);
  await ensureCashSessionOpen(page);
  await page.goto('/cobrar');
  await page.getByLabel(/nombre del paciente/i).fill(patientName);
  const previewPromise = waitForCurrentPreview(page, state.serviceId);
  await addExactCatalogItem(page, serviceName);
  const preview = await previewPromise;
  expect(preview.item.unit_price_registered_cents).toBe(state.initialPriceCents);
  const paid = await payCurrentAccount(page);
  state.invoiceId = paid.invoiceId;
  state.paymentId = paid.paymentId;
  state.receiptId = paid.receiptId;
  apiEvidence.push(...paid.responses);

  const receiptPdfResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'GET'
      && new URL(response.url()).pathname === `/api/institutional-receipts/${paid.receiptId}/pdf`
  ));
  const receiptPdfDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /guardar pdf/i }).click();
  const receiptPdfResponse = await receiptPdfResponsePromise;
  expect(receiptPdfResponse.ok(), `receipt pdf ${receiptPdfResponse.status()}`).toBe(true);
  await saveDownload(await receiptPdfDownloadPromise, twoCopyReceiptFile);

  const snapshotBefore = await invoiceSnapshot(page, paid.invoiceId, state.serviceId);
  expect(snapshotBefore.unit_price_registered_cents).toBe(state.initialPriceCents);
  writeEvidence('qa-entrega-un-pc-snapshot-antes.json', { run_id: runId, invoice_id: paid.invoiceId, item: snapshotBefore });

  await logout(page);
  await login(page, ADMIN);
  await openSettledCatalog(page);
  await filterCatalog(page, serviceName);
  await openServiceAction(page, serviceName, /editar/i);
  const editDialog = page.getByRole('dialog', { name: /editar producto o servicio/i });
  await editDialog.getByLabel(/precio/i).fill(updatedPrice);
  await editDialog.getByLabel(/motivo del cambio de precio/i).fill(priceReason);
  const updateServiceResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'PATCH'
      && new URL(response.url()).pathname === `/api/services/${state.serviceId}`
  ));
  await editDialog.getByRole('button', { name: /actualizar/i }).click();
  const updateServiceResponse = await updateServiceResponsePromise;
  expect(updateServiceResponse.ok(), `service update ${updateServiceResponse.status()}`).toBe(true);
  const updatedService = await responseData(updateServiceResponse);
  expect(moneyToCents(updatedService.price)).toBe(state.updatedPriceCents);
  apiEvidence.push(await responseEvidence(updateServiceResponse));

  const snapshotAfter = await invoiceSnapshot(page, paid.invoiceId, state.serviceId);
  expect(snapshotAfter.unit_price_registered_cents).toBe(state.initialPriceCents);
  writeEvidence('qa-entrega-un-pc-snapshot-despues.json', {
    run_id: runId,
    invoice_id: paid.invoiceId,
    current_service_price_cents: state.updatedPriceCents,
    historical_item: snapshotAfter,
  });

  await logout(page);
  await login(page, CASHIER);
  await page.goto('/cobrar');
  await page.getByLabel(/nombre del paciente/i).fill(`EUPC ${runId} PRECIO NUEVO`);
  const currentPreviewPromise = waitForCurrentPreview(page, state.serviceId);
  await addExactCatalogItem(page, serviceName);
  const currentPreview = await currentPreviewPromise;
  expect(currentPreview.item.unit_price_registered_cents).toBe(state.updatedPriceCents);
  }

  await logout(page);
  await login(page, ADMIN);
  await openSettledCatalog(page);
  await filterCatalog(page, serviceName);
  const historyResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'GET'
      && new URL(response.url()).pathname === `/api/services/${state.serviceId}/history`
  ));
  await openServiceAction(page, serviceName, /ver historial/i);
  const historyResponse = await historyResponsePromise;
  expect(historyResponse.ok(), `history ${historyResponse.status()}`).toBe(true);
  const historyBody = await historyResponse.json() as { data: Array<{ reason?: string | null; changes?: Array<{ field: string }> }> };
  expect(historyBody.data.some((entry) => entry.reason === priceReason && entry.changes?.some((change) => change.field === 'price'))).toBe(true);
  const historyDialog = page.getByRole('dialog', { name: new RegExp(`historial de ${escapeRegex(serviceName)}`, 'i') });
  await expect(historyDialog).toContainText(priceReason);
  await settledScreenshot(page, 'catalogo-historial-precio-desktop-1366x768.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await settledScreenshot(page, 'catalogo-historial-precio-mobile-390x844.png');
  await page.setViewportSize({ width: 1366, height: 768 });
  await historyDialog.getByRole('button', { name: /^cerrar$/i }).first().click();

  await page.getByRole('button', { name: /categorías del catálogo/i }).click();
  await page.getByRole('button', { name: new RegExp(`editar categoría ${escapeRegex(categoryName)}`, 'i') }).click();
  const categoryEditDialog = page.getByRole('dialog', { name: /editar categoría/i });
  await categoryEditDialog.getByRole('checkbox', { name: /categoría activa/i }).uncheck();
  await expect(categoryEditDialog.getByText(/1 producto\(s\) o servicio\(s\) activo\(s\).*dejarán de estar disponibles/i)).toBeVisible();
  await categoryEditDialog.getByLabel(/motivo del cambio de disponibilidad/i).fill(deactivationReason);
  const deactivateCategoryResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'PATCH'
      && new URL(response.url()).pathname === `/api/categories/${state.categoryId}`
  ));
  await categoryEditDialog.getByRole('button', { name: /desactivar categoría/i }).click();
  const deactivateCategoryResponse = await deactivateCategoryResponsePromise;
  expect(deactivateCategoryResponse.ok(), `category deactivate ${deactivateCategoryResponse.status()}`).toBe(true);
  apiEvidence.push(await responseEvidence(deactivateCategoryResponse));

  await logout(page);
  await login(page, CASHIER);
  await page.goto('/cobrar');
  const search = page.getByRole('searchbox', { name: /buscar servicio o producto/i });
  const searchResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'GET'
      && /\/api\/services\?/.test(response.url())
      && new URL(response.url()).searchParams.get('search') === serviceName
  ));
  await search.fill(serviceName);
  const searchResponse = await searchResponsePromise;
  expect(searchResponse.ok()).toBe(true);
  const searchBody = await searchResponse.json() as { data: Array<{ id: number }> };
  expect(searchBody.data.some((service) => service.id === state.serviceId)).toBe(false);
  await expect(page.getByRole('button', { name: new RegExp(`agregar resultado.*${escapeRegex(serviceName)}`, 'i') })).toHaveCount(0);
});

test('capturas directas de Cobrar y error de valoración en escritorio y móvil', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await login(page, CASHIER);
  await page.goto('/cobrar');
  await expect(page.getByRole('heading', { level: 1, name: /cobrar/i })).toBeVisible();
  await expect(page.getByText(/la cuenta está vacía/i)).toBeVisible();
  await settledScreenshot(page, 'cobrar-vacio-desktop-1366x768.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await settledScreenshot(page, 'cobrar-vacio-mobile-390x844.png');

  const search = page.getByRole('searchbox', { name: /buscar servicio o producto/i });
  await search.focus();
  await expect(search).toBeFocused();
  await settledScreenshot(page, 'cobrar-busqueda-focus-mobile-390x844.png');
  const valuedPreviewPromise = page.waitForResponse((response) => (
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/invoices/preview'
  ));
  await addCatalogItem(page, 'Glucosa');
  expect((await valuedPreviewPromise).ok()).toBe(true);
  await expect(page.getByText(/calculando/i)).toHaveCount(0);
  const totalZone = page.getByRole('complementary', { name: /total y acción/i });
  await expect(totalZone).toContainText(/L\.\s*[\d,.]+/);
  await settledScreenshot(page, 'cobrar-cuenta-total-mobile-390x844.png');

  const ledger = page.getByRole('group', { name: /líneas de la cuenta/i });
  const scrollEvidence = await ledger.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
    return { scroll_left: element.scrollLeft, scroll_width: element.scrollWidth, client_width: element.clientWidth };
  });
  expect(scrollEvidence.scroll_left).toBeGreaterThan(0);
  await expect(ledger.getByRole('columnheader', { name: /importe/i })).toBeVisible();
  await expect(totalZone).toBeVisible();
  writeEvidence('qa-entrega-un-pc-scroll-mobile.json', { run_id: runId, ...scrollEvidence });
  await settledScreenshot(page, 'cobrar-cuenta-scroll-importe-mobile-390x844.png');

  await page.route(/\/api\/invoices\/preview$/, (route) => route.abort('connectionfailed'));
  await page.getByRole('button', { name: /quitar glucosa/i }).click();
  await page.getByLabel(/nombre del paciente/i).fill(`EUPC ${runId} ERROR`);
  await addCatalogItem(page, 'Glucosa');
  await expect(page.getByText(/no se pudo confirmar el total|no se pudo conectar/i).first()).toBeVisible();
  await expect(page.getByTestId('cobrar-primary-action')).toBeDisabled();
  await settledScreenshot(page, 'cobrar-error-mobile-390x844.png');
  await page.setViewportSize({ width: 1366, height: 768 });
  await settledScreenshot(page, 'cobrar-error-desktop-1366x768.png');
});

test('el concepto desactivado deja de ofrecerse en Cobrar', async ({ page }) => {
  test.skip(!resumeServiceId, 'Continuación focal requiere el ID sintético ya creado.');
  await page.setViewportSize({ width: 1366, height: 768 });
  await login(page, CASHIER);
  await page.goto('/cobrar');
  const search = page.getByRole('searchbox', { name: /buscar servicio o producto/i });
  const searchResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'GET'
      && /\/api\/services\?/.test(response.url())
      && new URL(response.url()).searchParams.get('search') === serviceName
  ));
  await search.fill(serviceName);
  const searchResponse = await searchResponsePromise;
  expect(searchResponse.ok()).toBe(true);
  const searchBody = await searchResponse.json() as { data: Array<{ id: number }> };
  expect(searchBody.data.some((service) => service.id === resumeServiceId)).toBe(false);
  await expect(page.getByRole('button', { name: new RegExp(`agregar\\s+${escapeRegex(serviceName)}`, 'i') })).toHaveCount(0);
  await settledScreenshot(page, 'catalogo-concepto-desactivado-cobrar-desktop-1366x768.png');
});

test('captura final poblada valida 1001, error recuperable y una sola acción móvil', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await login(page, CASHIER);
  await page.goto('/cobrar');
  await page.getByLabel(/nombre del paciente/i).fill(`EUPC ${runId} CAPTURA 1001`);
  await addCatalogItem(page, 'Glucosa');
  const quantity = page.getByLabel(/^cantidad de glucosa$/i);
  const preview1001 = page.waitForResponse((response) => (
    response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/api/invoices/preview'
      && response.request().postData()?.includes('1001') === true
  ));
  await quantity.fill('1001');
  expect((await preview1001).ok()).toBe(true);
  await expect(page.getByText(/calculando/i)).toHaveCount(0);
  await expect(quantity).toHaveValue('1001');
  await settledScreenshot(page, 'cobrar-poblado-1001-desktop-1366x768.png');

  await page.route(/\/api\/invoices\/preview$/, (route) => route.abort('connectionfailed'));
  await quantity.fill('1002');
  await expect(page.getByText(/no se pudo confirmar el total|no se pudo conectar/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /reintentar/i })).toBeVisible();
  await settledScreenshot(page, 'cobrar-error-reintentable-desktop-1366x768.png');
  await page.unroute(/\/api\/invoices\/preview$/);
  const recoveryResponse = page.waitForResponse((response) => (
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/invoices/preview'
  ));
  await page.getByRole('button', { name: /reintentar/i }).click();
  expect((await recoveryResponse).ok()).toBe(true);
  await expect(page.getByText(/no se pudo confirmar el total|no se pudo conectar/i)).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const summary = page.getByRole('complementary', { name: /total y acción/i });
  await summary.scrollIntoViewIfNeeded();
  await expect(summary).toBeVisible();
  await expect(page.getByTestId('cobrar-primary-action')).toBeVisible();
  await expect(page.getByTestId('cobrar-mobile-action')).toHaveCount(0);
  await settledScreenshot(page, 'cobrar-poblado-total-integrado-mobile-390x844.png');
  const mobileSearch = page.getByRole('searchbox', { name: /buscar servicio o producto/i });
  await mobileSearch.scrollIntoViewIfNeeded();
  await mobileSearch.focus();
  await expect(mobileSearch).toBeFocused();
  await settledScreenshot(page, 'cobrar-busqueda-foco-mobile-390x844.png');
  const ledger = page.getByRole('group', { name: /líneas de la cuenta/i });
  const scroll = await ledger.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
    return { scroll_left: element.scrollLeft, scroll_width: element.scrollWidth, client_width: element.clientWidth };
  });
  expect(scroll.scroll_left).toBeGreaterThan(0);
  writeEvidence('qa-cobrar-scroll-final.json', { run_id: runId, ...scroll });
  await settledScreenshot(page, 'cobrar-scroll-importe-mobile-390x844.png');

  await page.setViewportSize({ width: 390, height: 520 });
  await mobileSearch.scrollIntoViewIfNeeded();
  await expect(page.getByTestId('cobrar-mobile-action')).toBeVisible();
  writeEvidence('qa-cobrar-teclado-limitacion.json', {
    run_id: runId,
    viewport: { width: 390, height: 520 },
    scope: 'Proxy de espacio vertical reducido; no certifica teclado virtual nativo.',
  });
  await settledScreenshot(page, 'cobrar-poblado-accion-fija-proxy-390x520.png');
});

test('redescarga únicamente el PDF ejecutivo corregido con el mismo filtro API', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await login(page, ADMIN);
  const initialReport = page.waitForResponse((response) => (
    response.request().method() === 'GET' && /\/api\/reports\/executive\?/.test(response.url())
  ));
  await page.goto('/reportes');
  expect((await initialReport).ok()).toBe(true);
  await page.getByRole('button', { name: /^hoy$/i }).click();
  const dateFrom = await page.getByLabel(/^desde$/i).inputValue();
  const dateTo = await page.getByLabel(/^hasta$/i).inputValue();
  expect(dateFrom).toBe(dateTo);
  const reportResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'GET'
      && /\/api\/reports\/executive\?/.test(response.url())
      && new URL(response.url()).searchParams.get('date_from') === dateFrom
      && new URL(response.url()).searchParams.get('date_to') === dateTo
  ));
  await page.getByRole('button', { name: /^aplicar$/i }).click();
  const reportResponse = await reportResponsePromise;
  expect(reportResponse.ok()).toBe(true);
  const filters = Object.fromEntries(new URL(reportResponse.url()).searchParams.entries());
  writeEvidence('qa-reporte-api-paginacion-final.json', {
    run_id: runId,
    filters,
    response: await reportResponse.json(),
  });
  const pdfResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'GET' && /\/api\/reports\/executive\/pdf\?/.test(response.url())
  ));
  const pdfDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /exportar pdf/i }).click();
  const pdfResponse = await pdfResponsePromise;
  expect(pdfResponse.ok()).toBe(true);
  expect(Object.fromEntries(new URL(pdfResponse.url()).searchParams.entries())).toEqual(filters);
  await saveDownload(await pdfDownloadPromise, 'qa-reporte-ejecutivo-paginacion-final.pdf');
});

test('redescarga únicamente el Excel final con el mismo filtro API', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await login(page, ADMIN);
  const initialReport = page.waitForResponse((response) => (
    response.request().method() === 'GET' && /\/api\/reports\/executive\?/.test(response.url())
  ));
  await page.goto('/reportes');
  expect((await initialReport).ok()).toBe(true);
  await page.getByRole('button', { name: /^hoy$/i }).click();
  const dateFrom = await page.getByLabel(/^desde$/i).inputValue();
  const dateTo = await page.getByLabel(/^hasta$/i).inputValue();
  expect(dateFrom).toBe(dateTo);
  const reportResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'GET'
      && /\/api\/reports\/executive\?/.test(response.url())
      && new URL(response.url()).searchParams.get('date_from') === dateFrom
      && new URL(response.url()).searchParams.get('date_to') === dateTo
  ));
  await page.getByRole('button', { name: /^aplicar$/i }).click();
  const reportResponse = await reportResponsePromise;
  expect(reportResponse.ok()).toBe(true);
  const filters = Object.fromEntries(new URL(reportResponse.url()).searchParams.entries());
  writeEvidence('qa-reporte-api-excel-final.json', {
    run_id: runId,
    filters,
    response: await reportResponse.json(),
  });
  const excelResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'GET' && /\/api\/reports\/executive\/excel\?/.test(response.url())
  ));
  const excelDownloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /exportar excel/i }).click();
  const excelResponse = await excelResponsePromise;
  expect(excelResponse.ok()).toBe(true);
  expect(Object.fromEntries(new URL(excelResponse.url()).searchParams.entries())).toEqual(filters);
  await saveDownload(await excelDownloadPromise, 'qa-reporte-ejecutivo-final.xlsx');
});

async function openSettledCatalog(page: Page): Promise<void> {
  await page.goto('/administracion/catalogo');
  await expect(page.getByRole('heading', { name: /catálogo de productos y servicios/i })).toBeVisible();
  await expect(page.getByRole('status', { name: /cargando productos y servicios/i })).toHaveCount(0);
  await expect(page.getByRole('region', { name: /listado de productos y servicios/i }).or(page.getByText(/no hay productos ni servicios/i))).toBeVisible();
}

async function configureLetterTwoCopies(page: Page): Promise<void> {
  const before = await fetchJson<{ data: { resolved_profile: Record<string, unknown> | null } }>(page, '/api/settings/institutional-receipts');
  expect(before.status, 'receipt settings GET').toBe(200);
  if (isRequiredReceiptProfile(before.body.data.resolved_profile)) {
    writeReceiptProfileEvidence(before.body.data.resolved_profile!, 'already_persisted');
    return;
  }
  await page.goto('/administracion/ajustes?panel=papel');
  await expect(page.getByRole('heading', { name: /recibos institucionales/i })).toBeVisible();
  await page.getByRole('tab', { name: /papel y copias/i }).click();
  const portrait = page.getByRole('radio', { name: /^carta vertical\b/i });
  await expect(portrait).toBeEnabled();
  await portrait.check();
  const copies = page.getByRole('combobox', { name: /copias/i });
  await copies.selectOption('original_first');
  const saveResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'PATCH'
      && /\/api\/settings\/institutional-receipts\/print-profiles\/\d+$/.test(new URL(response.url()).pathname)
  ), { timeout: 20_000 });
  await page.getByRole('button', { name: /guardar perfil/i }).click();
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.ok(), `receipt profile ${saveResponse.status()}`).toBe(true);
  const profile = await responseData(saveResponse);
  expect(profile).toMatchObject({ code: 'carta_vertical', copies_mode: 'original_first', active: true, is_global_default: true });
  apiEvidence.push(await responseEvidence(saveResponse));
  const after = await fetchJson<{ data: { resolved_profile: Record<string, unknown> | null } }>(page, '/api/settings/institutional-receipts');
  expect(after.status, 'receipt settings persisted GET').toBe(200);
  expect(isRequiredReceiptProfile(after.body.data.resolved_profile)).toBe(true);
  writeReceiptProfileEvidence(after.body.data.resolved_profile!, 'saved_and_confirmed');
  await expect(page.getByTestId('receipt-copies-metric')).toContainText(/^Copias\s*2\b/i);
}

function isRequiredReceiptProfile(profile: Record<string, unknown> | null): boolean {
  return profile?.code === 'carta_vertical'
    && profile.copies_mode === 'original_first'
    && profile.active === true
    && profile.is_global_default === true;
}

function writeReceiptProfileEvidence(profile: Record<string, unknown>, source: string): void {
  writeEvidence('qa-entrega-un-pc-perfil-recibo.json', {
    run_id: runId,
    source,
    profile_id: profile.id,
    code: profile.code,
    paper_kind: profile.paper_kind,
    copies_mode: profile.copies_mode,
    active: profile.active,
    is_global_default: profile.is_global_default,
  });
}

async function filterCatalog(page: Page, query: string): Promise<void> {
  const search = page.getByLabel(/buscar producto o servicio/i);
  const responsePromise = page.waitForResponse((response) => (
    response.request().method() === 'GET'
      && /\/api\/services\?/.test(response.url())
      && new URL(response.url()).searchParams.get('search') === query
  ));
  await search.fill(query);
  const response = await responsePromise;
  expect(response.ok(), `catalog search ${response.status()}`).toBe(true);
  await expect(page.getByRole('status', { name: /cargando productos y servicios/i })).toHaveCount(0);
}

async function addExactCatalogItem(page: Page, query: string): Promise<void> {
  const search = page.getByRole('searchbox', { name: /buscar servicio o producto/i });
  await search.fill(query);
  const result = page.getByRole('button', { name: new RegExp(`^agregar\\s+${escapeRegex(query)}$`, 'i') });
  await expect(result).toBeVisible();
  await result.click();
}

async function openServiceAction(page: Page, name: string, action: RegExp): Promise<void> {
  await page.getByRole('button', { name: new RegExp(`acciones de servicio ${escapeRegex(name)}`, 'i') }).click();
  await page.getByRole('menuitem', { name: action }).click();
}

async function ensureCashSessionOpen(page: Page): Promise<void> {
  const current = await fetchJson<{ data: null | { status?: string } }>(page, '/api/cash-sessions/current');
  expect(current.status).toBe(200);
  if (current.body.data?.status === 'open') return;

  await page.goto('/caja');
  const opening = page.getByRole('region', { name: /apertura de caja/i });
  await expect(opening).toBeVisible();
  const registerSelect = opening.getByLabel(/caja física/i);
  const registerOption = registerSelect.locator('option').filter({ hasText: /Caja AZB QA/i });
  await expect(registerOption).toHaveCount(1);
  const registerValue = await registerOption.getAttribute('value');
  expect(registerValue).toBeTruthy();
  await registerSelect.selectOption(registerValue!);
  await opening.getByLabel(/monto inicial/i).fill('100.00');
  await opening.getByRole('button', { name: /^abrir caja$/i }).click();
  const dialog = page.getByRole('dialog', { name: /confirmar apertura/i });
  const responsePromise = page.waitForResponse((response) => (
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/cash-sessions/open'
  ));
  await dialog.getByRole('button', { name: /^abrir caja$/i }).click();
  const response = await responsePromise;
  expect(response.ok(), `cash open ${response.status()}`).toBe(true);
  apiEvidence.push(await responseEvidence(response));
}

async function waitForCurrentPreview(page: Page, serviceId?: number): Promise<{ item: Record<string, unknown> }> {
  const response = await page.waitForResponse((candidate) => {
    if (candidate.request().method() !== 'POST' || new URL(candidate.url()).pathname !== '/api/invoices/preview') return false;
    const payload = candidate.request().postDataJSON() as { items?: Array<{ service_id?: number }> } | null;
    return Boolean(payload?.items?.some((item) => item.service_id === serviceId));
  });
  expect(response.ok(), `preview ${response.status()}`).toBe(true);
  const body = await response.json() as { data: { items: Array<Record<string, unknown>> } };
  const item = body.data.items.find((candidate) => candidate.service_id === serviceId);
  expect(item).toBeDefined();
  return { item: item! };
}

async function payCurrentAccount(page: Page): Promise<{
  invoiceId: number;
  paymentId: number;
  receiptId: number;
  responses: ApiEvidence[];
}> {
  await page.getByTestId('cobrar-primary-action').click();
  const dialog = page.getByRole('dialog', { name: /confirmar cobro/i });
  await dialog.getByRole('button', { name: /monto exacto/i }).click();
  const invoiceResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/invoices'
  ));
  const paymentResponsePromise = page.waitForResponse((response) => (
    response.request().method() === 'POST' && /\/api\/invoices\/\d+\/payments$/.test(new URL(response.url()).pathname)
  ));
  await dialog.getByTestId('cobrar-confirm').click();
  const [invoiceResponse, paymentResponse] = await Promise.all([invoiceResponsePromise, paymentResponsePromise]);
  expect(invoiceResponse.ok(), `invoice ${invoiceResponse.status()}`).toBe(true);
  expect(paymentResponse.ok(), `payment ${paymentResponse.status()}`).toBe(true);
  const invoice = await responseData(invoiceResponse);
  const paymentEnvelope = await responseData(paymentResponse);
  const payment = (paymentEnvelope.payment ?? {}) as Record<string, unknown>;
  const receipt = (paymentEnvelope.institutional_receipt ?? paymentEnvelope.receipt ?? {}) as Record<string, unknown>;
  const invoiceId = numberId(invoice.id, 'invoice');
  const paymentId = numberId(payment.id, 'payment');
  const receiptId = numberId(receipt.id, 'receipt');
  await expect(page.getByRole('heading', { name: /operación cobrada/i })).toBeVisible();
  return {
    invoiceId,
    paymentId,
    receiptId,
    responses: [await responseEvidence(invoiceResponse), await responseEvidence(paymentResponse)],
  };
}

async function invoiceSnapshot(page: Page, invoiceId: number, serviceId?: number): Promise<Record<string, unknown>> {
  const response = await fetchJson<{ data: { items?: Array<Record<string, unknown>> } }>(page, `/api/invoices/${invoiceId}`);
  expect(response.status).toBe(200);
  const item = response.body.data.items?.find((candidate) => candidate.service_id === serviceId);
  expect(item).toBeDefined();
  return item!;
}

async function selectFirstRealOption(select: Locator): Promise<void> {
  const value = await select.locator('option').evaluateAll((options) => (
    options.map((option) => (option as HTMLOptionElement).value).find((candidate) => candidate !== '' && candidate !== '0') ?? null
  ));
  expect(value).toBeTruthy();
  await select.selectOption(value!);
}

async function settledScreenshot(page: Page, filename: string): Promise<void> {
  const targetDirectory = resolve(EVIDENCE_ROOT, 'capturas');
  mkdirSync(targetDirectory, { recursive: true });
  await expect(page.locator('main')).toBeVisible();
  const viewport = page.viewportSize();
  expect(viewport).toBeTruthy();
  await page.screenshot({ path: resolve(targetDirectory, filename), fullPage: false });
  captures.push({ file: filename, width: viewport!.width, height: viewport!.height });
}

async function responseData(response: Response): Promise<Record<string, unknown>> {
  const body = await response.json() as { data?: Record<string, unknown> };
  expect(body.data).toBeTruthy();
  return body.data!;
}

function isCategoryCreateResponse(response: Response): boolean {
  return response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/categories';
}

function isServiceCreateResponse(response: Response): boolean {
  return response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/services';
}

function numberId(value: unknown, label: string): number {
  expect(typeof value, `${label} id`).toBe('number');
  return value as number;
}

function moneyToCents(value: unknown): number {
  expect(typeof value).toBe('string');
  const normalized = String(value);
  expect(normalized).toMatch(/^\d+(?:\.\d{1,2})?$/);
  const [units, decimals = ''] = normalized.split('.');
  return Number(units) * 100 + Number(decimals.padEnd(2, '0'));
}

function centsToInput(cents: number): string {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

function numericSuffix(value: string): number {
  const digits = value.replace(/\D/g, '').slice(-6);
  return Number(digits || '0');
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
