import { expect, test, type Page, type Response } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// This flow is opt-in because it mutates a prepared disposable native stack.
const native = process.env.E2E_RELEASE_NATIVE_WORKFLOW === '1';
const password = process.env.E2E_RELEASE_PASSWORD ?? '';
const baseURL = process.env.E2E_RELEASE_BASE_URL;
const evidence = resolve(process.env.E2E_RELEASE_EVIDENCE_DIR ?? '../hospital-ai/evidencia/ENTREGA-20261021/F3');
const runId = process.env.E2E_RELEASE_RUN_ID ?? `f3-${Date.now()}`;
const outcomes: Record<string, unknown>[] = [];
const issues: string[] = [];
type Data = Record<string, unknown>;
type Envelope = { data: Data };

test.skip(!native, 'Native F3 requires E2E_RELEASE_NATIVE_WORKFLOW=1 on the prepared MariaDB laboratory.');
test.describe.configure({ mode: 'serial' });
test.afterAll(() => {
  mkdirSync(evidence, { recursive: true });
  writeFileSync(resolve(evidence, 'workflow-results.json'), JSON.stringify({ run_id: runId, stack: process.env.E2E_RELEASE_STACK, outcomes, issues }, null, 2));
});

test('F3 role matrix and native production UI', async ({ browser }) => {
  test.setTimeout(300_000);
  for (const role of ['admin', 'supervisor', 'cajero']) {
    const page = await browser.newPage({ baseURL, viewport: { width: 1366, height: 768 } });
    try {
      await login(page, `${role}.e2e`);
      const session = await get(page, '/api/auth/session');
      expect(session.data.roles).toContain(role);
      const nav = page.getByRole('navigation', { name: /navegación principal/i });
      for (const label of ['Cobrar', 'Recibos', 'Caja', 'Reportes']) {
        await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
      }
      await capture(page, `roles/${role}.png`);
      const userStatus = await page.evaluate(async () => (await fetch('/api/admin/users', { headers: { Accept: 'application/json' } })).status);
      expect(userStatus).toBe(role === 'admin' ? 200 : 403);
      await page.goto('/administracion/usuarios');
      await expect(page.getByRole('heading', { level: 1, name: role === 'admin' ? /usuarios y roles/i : /sin permisos/i })).toBeVisible();
      outcomes.push({ role, users_api: userStatus, users_route: role === 'admin' ? 'allowed' : 'denied', primary_navigation: ['Cobrar', 'Recibos', 'Caja', 'Reportes'] });
    } finally { await page.close(); }
  }
});

test('F3 institutional paper is saved without requiring hidden technical fields', async ({ page }) => {
  await page.goto('/login');
  await capture(page, 'capturas/login.png');
  await login(page, 'admin.e2e');
  await page.goto('/administracion/ajustes?panel=impuestos');
  await expect(page.getByRole('heading', { name: /impuestos/i }).first()).toBeVisible();
  await capture(page, 'capturas/ajustes-impuestos.png');
  await page.goto('/administracion/ajustes?panel=impresion');
  const paper = page.getByRole('radio', { name: 'A5', exact: true });
  await expect(paper).toBeEnabled();
  await paper.check();
  const saved = page.waitForResponse((response) => response.request().method() === 'PATCH' && /\/print-profiles\/\d+$/.test(new URL(response.url()).pathname));
  await page.getByRole('button', { name: /guardar perfil/i }).click();
  const response = await saved;
  expect(response.ok(), await response.text()).toBe(true);
  const profile = await response.json() as Envelope;
  expect(profile.data.paper_kind).toBe('a5_landscape');
  expect(response.request().postDataJSON()).not.toHaveProperty('support_reason');
  expect(response.request().postDataJSON()).not.toHaveProperty('width_mm');
  await capture(page, 'capturas/ajustes-impresion.png');
  outcomes.push({ name: 'institutional_profile', profile: profile.data });
});

test('F3 daily flow: cash, transfer, mixed taxes, EPO, reprint, supervisor void, reports, backup and close', async ({ page, browser }) => {
  test.setTimeout(900_000);
  page.on('pageerror', (error) => issues.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) && !['127.0.0.1', 'localhost'].includes(url.hostname)) issues.push(`external: ${url.origin}${url.pathname}`);
  });
  await login(page, 'cajero.e2e');
  await page.goto('/caja');
  await closeCurrent(page, 'Preparación F3: cierre del fixture H07');
  const opening = page.getByRole('region', { name: /apertura de caja/i });
  const register = opening.getByLabel('Caja física');
  await expect(register).toBeVisible();
  const registerValue = await register.locator('option').evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value).find((value) => value !== '') ?? null);
  expect(registerValue).toBeTruthy();
  await register.selectOption(registerValue!);
  await opening.getByLabel('Monto inicial (L.)').fill('100.00');
  await opening.getByRole('button', { name: /^abrir caja$/i }).click();
  const openResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/cash-sessions/open');
  await page.getByRole('dialog', { name: /confirmar apertura de caja/i }).getByRole('button', { name: /^abrir caja$/i }).click();
  expect((await openResponse).ok()).toBe(true);
  await expect(page.getByRole('region', { name: /caja, usuario y sesión/i })).toContainText(/caja abierta/i);
  await expect(page.getByText(/no se pudo confirmar el trabajo pendiente/i)).toHaveCount(0);

  // The real backend values each line. UI checks fixed synthetic fixtures only.
  await account(page, 'EFECTIVO', ['F3 concepto 0']);
  const cash = await pay(page, 'cash');
  expect(cash.invoice.total).toBe('100.00');
  await account(page, 'TRANSFERENCIA', ['F3 concepto 0']);
  const transfer = await pay(page, 'transfer');
  expect(transfer.payment.method).toBe('transfer');
  await account(page, 'MIXTA', ['F3 concepto 15', 'F3 concepto 18', 'F3 concepto 0', 'Eritropoyetina']);
  const previewPromise = page.waitForResponse((response) => response.request().method() === 'POST' && /\/invoices\/preview$/.test(new URL(response.url()).pathname) && response.request().postDataJSON()?.dialysis_prescription === true);
  await page.getByRole('checkbox', { name: /paciente con receta de diálisis/i }).check();
  const preview = await (await previewPromise).json() as { data: { totals: { total_cents: number }; items: Array<{ service_name: string; special_rule_applied: boolean; line_total_cents: number }> } };
  expect(preview.data.totals.total_cents).toBe(33300);
  expect(preview.data.items.find((item) => /eritropoyetina/i.test(item.service_name))).toMatchObject({ special_rule_applied: true, line_total_cents: 0 });
  await expect(page.getByText(/sin cobro por receta/i).first()).toBeVisible();
  await capture(page, 'capturas/cobrar.png');
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, 'capturas/cobrar-mobile.png');
  await page.setViewportSize({ width: 1366, height: 768 });
  const mixed = await pay(page, 'cash');
  expect(mixed.invoice.total).toBe('333.00');
  await account(page, 'EPO CERO', ['Eritropoyetina']);
  await page.getByRole('checkbox', { name: /paciente con receta de diálisis/i }).check();
  await expect(page.getByTestId('cobrar-primary-action')).toHaveText(/emitir sin cobro/i);
  let zeroPayments = 0;
  const countPayment = (response: Response) => { if (response.request().method() === 'POST' && /\/invoices\/\d+\/payments$/.test(new URL(response.url()).pathname)) zeroPayments++; };
  page.on('response', countPayment);
  await page.getByTestId('cobrar-primary-action').click();
  await page.getByRole('dialog', { name: /confirmar emisión sin cobro/i }).getByTestId('cobrar-confirm').click();
  await expect(page.getByRole('heading', { name: /operación emitida sin cobro/i })).toBeVisible();
  expect(zeroPayments).toBe(0);
  page.off('response', countPayment);

  await page.goto(`/recibos?operacion=${cash.invoice.id}`);
  const receiptDetail = page.getByRole('complementary', { name: /detalle de la operación/i });
  await expect(receiptDetail).toBeVisible();
  // La primera entrega registra print; la segunda registra reprint con motivo.
  for (const reason of ['F3: entrega inicial del comprobante.', 'F3: segunda copia sintética solicitada.']) {
    await receiptDetail.getByRole('button', { name: /^reimprimir con motivo$/i }).click();
    const reprint = page.getByRole('dialog', { name: /^reimprimir /i });
    await reprint.getByLabel(/^motivo \*$/i).fill(reason);
    const printResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/institutional-receipts\/\d+\/print-events$/.test(new URL(response.url()).pathname));
    await reprint.getByRole('button', { name: /^reimprimir$/i }).click();
    expect((await printResponse).ok()).toBe(true);
    await expect(reprint).toBeHidden();
  }
  const invoiceAfter = await get(page, `/api/invoices/${cash.invoice.id}`);
  expect(invoiceAfter.data.paid_amount).toBe(cash.invoice.paid_amount);
  expect((invoiceAfter.data.institutional_receipt as Data).reprint_count).toBe(1);

  // A pending synthetic invoice can be voided without falsifying a payment.
  const pending = await mutate(page, '/api/invoices', { patient_name: `E2E Release Gate F3 ${runId} ANULAR`, items: [{ service_id: await serviceId(page, 'F3 concepto 0'), quantity: '1' }] });
  const supervisor = await browser.newPage({ baseURL });
  try {
    await login(supervisor, 'supervisor.e2e');
    await supervisor.goto(`/recibos?operacion=${pending.data.id}`);
    const voidButton = supervisor.getByRole('button', { name: /anular/i }).first();
    await voidButton.click();
    const dialog = supervisor.getByRole('dialog', { name: /anular/i });
    await dialog.getByLabel(/motivo de anulación/i).fill('F3: anulación sintética autorizada por supervisor.');
    const voidResponse = supervisor.waitForResponse((response) => response.request().method() === 'POST' && /\/invoices\/\d+\/void$/.test(new URL(response.url()).pathname));
    await dialog.getByRole('button', { name: /anular/i }).click();
    expect((await voidResponse).ok()).toBe(true);
    await capture(supervisor, 'capturas/supervisor-anulacion.png');
  } finally { await supervisor.close(); }

  const admin = await browser.newPage({ baseURL });
  try {
    await login(admin, 'admin.e2e');
    const reportPromise = admin.waitForResponse((response) => /\/api\/reports\/executive\?/.test(response.url()));
    await admin.goto('/reportes');
    const reportResponse = await reportPromise;
    const filters = new URL(reportResponse.url()).search;
    const report = await reportResponse.json() as { data: { summary: { invoice_count: number } } };
    expect(report.data.summary.invoice_count, 'H-07 must measure at least 100 actual invoices').toBeGreaterThanOrEqual(100);
    const durations = [];
    for (let index = 0; index < 3; index++) {
      const started = performance.now();
      const excel = await admin.request.get(`/api/reports/executive/excel${filters}`);
      expect(excel.ok(), await excel.text()).toBe(true);
      expect((await excel.body()).subarray(0, 2).toString()).toBe('PK');
      durations.push(Math.round(performance.now() - started));
    }
    const pdf = await admin.request.get(`/api/reports/executive/pdf${filters}`);
    expect(pdf.ok()).toBe(true);
    expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
    await capture(admin, 'capturas/reportes.png');
    outcomes.push({ name: 'reports_h07', filter: filters, report, excel_ms: durations, criterion_ms: 3000, all_under_3s: durations.every((duration) => duration <= 3000) });
    await admin.goto('/administracion/mantenimiento/respaldos');
    await admin.getByRole('button', { name: /^crear respaldo$/i }).first().click();
    const backupResponse = admin.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/backups', { timeout: 120_000 });
    await admin.getByRole('dialog', { name: /crear respaldo local/i }).getByRole('button', { name: /^crear respaldo$/i }).click();
    const createdBackupResponse = await backupResponse;
    expect(createdBackupResponse.ok()).toBe(true);
    const createdBackup = await createdBackupResponse.json() as Envelope;
    await expect(admin.getByRole('dialog', { name: /crear respaldo local/i })).toBeHidden();
    let completedBackup: Data | undefined;
    await expect.poll(async () => {
      const list = await (await admin.request.get('/api/backups')).json() as { data: Data[] };
      completedBackup = list.data.find((backup) => backup.id === createdBackup.data.id);
      return completedBackup?.status;
    }, { timeout: 120_000 }).toBe('success');
    // Crear/descargar no certifica una revisión ni una restauración: la revisión
    // cifrada se ejecuta por separado con hospital:verify-backup.
    expect(completedBackup).toMatchObject({ status: 'success', restore_tested: false });
    const download = admin.getByRole('button', { name: /descargar respaldo del/i }).first();
    await expect(download).toBeEnabled({ timeout: 120_000 });
    await download.click();
    const saved = admin.waitForEvent('download');
    await admin.getByRole('dialog', { name: /descargar respaldo/i }).getByRole('button', { name: /^descargar$/i }).click();
    const downloaded = await saved;
    expect(await downloaded.failure()).toBeNull();
    outcomes.push({ name: 'backup', backup: completedBackup, download_error: await downloaded.failure() });
    await capture(admin, 'capturas/respaldos.png');
  } finally { await admin.close(); }

  await page.goto('/caja');
  await page.getByRole('tab', { name: 'Arqueo' }).click();
  await capture(page, 'capturas/arqueo.png');
  await closeCurrent(page, 'F3: cierre conciliado final');
  await capture(page, 'capturas/cierre.png');
  expect(issues).toEqual([]);
  outcomes.push({ name: 'daily_flow', cash, transfer, mixed, zero_payments: zeroPayments, supervisor_void_invoice_id: pending.data.id, issues });
});

async function login(page: Page, username: string) {
  await page.goto('/login');
  await page.locator('#login-input').fill(username);
  await page.locator('#password-input').fill(password);
  await page.getByRole('button', { name: /iniciar sesión/i }).click();
  await expect(page.getByRole('button', { name: /^salir$/i })).toBeVisible({ timeout: 30_000 });
}
async function capture(page: Page, filename: string) {
  const target = resolve(evidence, filename);
  mkdirSync(resolve(target, '..'), { recursive: true });
  await page.screenshot({ path: target, fullPage: true, animations: 'disabled' });
}
async function get(page: Page, path: string): Promise<Envelope> {
  const response = await page.request.get(path);
  expect(response.ok(), await response.text()).toBe(true);
  return response.json() as Promise<Envelope>;
}
async function mutate(page: Page, path: string, data: Data): Promise<Envelope> {
  return page.evaluate(async ({ path, data }) => {
    const token = decodeURIComponent(document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='))?.slice(11) ?? '');
    const response = await fetch(path, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': token, 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(data) });
    if (!response.ok) throw new Error(`${path} ${response.status}: ${await response.text()}`);
    return response.json();
  }, { path, data }) as Promise<Envelope>;
}
async function serviceId(page: Page, name: string): Promise<number> {
  const response = await page.request.get(`/api/services?search=${encodeURIComponent(name)}&per_page=100`);
  const body = await response.json() as { data: Array<{ id: number; name: string }> };
  const service = body.data.find((item) => item.name === name);
  expect(service).toBeTruthy();
  return service!.id;
}
async function account(page: Page, label: string, services: string[]) {
  await page.goto('/cobrar');
  await page.getByLabel(/nombre del paciente/i).fill(`E2E Release Gate F3 ${runId} ${label}`);
  for (const service of services) {
    await page.getByRole('searchbox', { name: /buscar servicio o producto/i }).fill(service);
    await page.getByRole('button', { name: `Agregar resultado: ${service}`, exact: true }).click();
  }
  await expect(page.getByTestId('cobrar-primary-action')).toBeEnabled();
}
async function pay(page: Page, method: 'cash' | 'transfer') {
  await page.getByTestId('cobrar-primary-action').click();
  const dialog = page.getByRole('dialog', { name: /confirmar cobro/i });
  if (method === 'transfer') {
    await dialog.getByRole('radio', { name: 'Transferencia', exact: true }).click();
    await dialog.getByLabel(/referencia/i).fill(`F3-${runId}`);
  } else await dialog.getByRole('button', { name: /monto exacto/i }).click();
  const paymentResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/invoices\/\d+\/payments$/.test(new URL(response.url()).pathname));
  await dialog.getByTestId('cobrar-confirm').click();
  const response = await paymentResponse;
  expect(response.ok(), await response.text()).toBe(true);
  const body = await response.json() as { data: { invoice: Data; payment: Data; institutional_receipt: Data } };
  await expect(page.getByRole('heading', { name: /operación cobrada/i })).toBeVisible();
  return body.data;
}
async function closeCurrent(page: Page, note: string) {
  const current = await get(page, '/api/cash-sessions/current');
  if (!current.data) return;
  const expected = String(current.data.expected_cash_amount ?? current.data.expected_amount ?? current.data.opening_amount);
  await page.getByRole('tab', { name: 'Cierre' }).click();
  await page.getByLabel('Monto contado (L.)').fill(expected);
  await page.getByLabel('Nota de cierre').fill(note);
  await page.getByRole('region', { name: /cerrar el turno/i }).getByRole('button', { name: /cerrar caja/i }).click();
  const closeResponse = page.waitForResponse((response) => response.request().method() === 'POST' && /\/cash-sessions\/\d+\/close$/.test(new URL(response.url()).pathname));
  await page.getByRole('dialog', { name: /cierre de caja/i }).getByRole('button', { name: /^cerrar caja$/i }).click();
  const response = await closeResponse;
  expect(response.ok(), await response.text()).toBe(true);
  const closed = await response.json() as Envelope;
  expect(closed.data).toMatchObject({ status: 'closed', difference_amount: '0.00' });
  await expect(page.getByRole('heading', { name: /resumen de cierre confirmado/i })).toBeVisible();
  outcomes.push({ name: 'cash_close', note, data: closed.data });
}
