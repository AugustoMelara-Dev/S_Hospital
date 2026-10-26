import { expect, test, type Page, type Route } from '@playwright/test';
import { assertStrictMockGuard, installStrictMockGuard } from './fixtures/strict-mock-guard';
import { installCashSessionOptions } from './fixtures/cash-options';
import {
  installAdminApi,
  json,
  openCashSessionFixture,
  type AdminTestUser,
} from './fixtures/admin-e2e';

/**
 * Recibos — historial, detalle y reimpresión con motivo sobre el producto nuevo.
 * Las facturas son fixtures sintéticos; el backend nunca se contacta.
 */

test.beforeEach(async ({ page }) => installStrictMockGuard(page));
test.afterEach(async ({ page }) => assertStrictMockGuard(page));

const ADMIN: AdminTestUser = {
  id: 81,
  name: 'Historial Admin',
  email: 'historial@hospital.local',
  username: 'historial.admin',
  active: true,
  roles: ['admin'],
  permissions: [
    'invoices.view',
    'invoices.void',
    'invoices.reverse',
    'invoices.operate_any',
    'payments.create',
    'receipts.view',
    'receipts.reprint',
    'receipts.reprint_any',
    'cash.view',
  ],
  must_change_password: false,
};

const INSTITUTIONAL_RECEIPT = {
  id: 700,
  receipt_number_full: 'REC-00000070',
  status: 'issued',
  issued_at: '2026-09-18T09:45:00-06:00',
  reprint_count: 1,
  has_print_events: true,
  print_events_count: 1,
};

const ISSUED_INVOICE = {
  id: 501,
  invoice_number: 'A-0001',
  patient_name: 'Maria Lopez',
  subtotal: '217.39',
  tax_amount: '32.61',
  discount_amount: '0.00',
  total: '250.00',
  paid_amount: '0.00',
  balance_due: '250.00',
  status: 'issued',
  payment_status: 'pending',
  issued_at: '2026-09-18T09:30:00-06:00',
  void_reason: null,
  voided_at: null,
  user_id: ADMIN.id,
  cash_session_id: 7,
  issuer: { id: ADMIN.id, name: ADMIN.name, username: ADMIN.username },
  voided_by: null,
  items: [],
  payments: [],
  institutional_receipt: null,
};

const PAID_INVOICE = {
  ...ISSUED_INVOICE,
  id: 502,
  invoice_number: 'A-0002',
  patient_name: 'Carlos Rivera',
  total: '180.00',
  paid_amount: '180.00',
  balance_due: '0.00',
  status: 'paid',
  payment_status: 'paid',
  institutional_receipt: INSTITUTIONAL_RECEIPT,
};

async function installRecibosMocks(
  page: Page,
  options: { onInstitutionalPdf?: () => void; onPrintEvent?: (payload: Record<string, unknown>, key: string | null) => void } = {},
): Promise<void> {
  await installAdminApi(page, { user: ADMIN, cashSession: openCashSessionFixture() });
  await installCashSessionOptions(page, () => [openCashSessionFixture({ status: 'closed', closed_at: '2026-09-18T16:00:00-06:00' })]);

  await page.route(/\/api\/invoices(?:\?.*)?$/, (route) => {
    const url = new URL(route.request().url());
    const patient = (url.searchParams.get('patient') ?? '').toLowerCase();
    const invoices = [ISSUED_INVOICE, PAID_INVOICE].filter(
      (invoice) => !patient || invoice.patient_name.toLowerCase().includes(patient),
    );

    return json(route, {
      data: invoices,
      meta: {
        current_page: 1,
        from: invoices.length ? 1 : null,
        last_page: 1,
        path: '/api/invoices',
        per_page: 10,
        to: invoices.length,
        total: invoices.length,
      },
    });
  });

  await page.route(/\/api\/invoices\/\d+(?:\?.*)?$/, (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/').at(-1));
    const invoice = id === PAID_INVOICE.id ? PAID_INVOICE : ISSUED_INVOICE;
    return json(route, { data: invoice });
  });

  await page.route(/\/api\/cash-sessions(?:\?.*)?$/, (route) =>
    json(route, {
      data: [openCashSessionFixture({ status: 'closed', closed_at: '2026-09-18T16:00:00-06:00' })],
      meta: { current_page: 1, per_page: 50, total: 1 },
    }),
  );

  await page.route(/\/api\/institutional-receipts\/\d+\/pdf(?:\?.*)?$/, (route) => {
    if (route.request().method() === 'POST') {
      // Reimpresión legacy por PDF: no-op aceptada.
      return route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-mocked' });
    }

    return route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html>
<html lang="es">
<head><meta charset="utf-8" /><title>Recibo REC-00000070</title></head>
<body>
  <section class="receipt-page">
    <header>
      <h1>Hospital General San Isidro</h1>
      <span class="chip">ORIGINAL</span>
      <span>REC-00000070</span>
    </header>
    <main>
      <p>Paciente: Carlos Rivera</p>
      <p>Total: L. 180.00</p>
    </main>
  </section>
</body>
</html>`,
    });
  });

  await page.route(/\/api\/institutional-receipts\/\d+\/print-events$/, async (route: Route) => {
    const payload = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    options.onPrintEvent?.(payload, route.request().headers()['idempotency-key'] ?? null);
    options.onInstitutionalPdf?.();
    return json(route, { data: { receipt: INSTITUTIONAL_RECEIPT } });
  });
}

test.describe('Recibos — historial, detalle y reimpresión', () => {
  test('muestra el historial con estado de pago y comprobante vinculado', async ({ page }) => {
    await installRecibosMocks(page);
    await page.goto('/recibos');

    await expect(page.getByRole('heading', { level: 1, name: /^recibos$/i })).toBeVisible();
    await expect(page.getByText('2 operaciones').first()).toBeVisible();

    const issued = page.getByRole('row', { name: /A-0001.*Maria Lopez/i });
    await expect(issued).toContainText('Pendiente de cobro');
    await expect(issued).toContainText('L. 250.00');

    const paid = page.getByRole('row', { name: /A-0002.*Carlos Rivera/i });
    await expect(paid).toContainText('Cobrada');
    await expect(paid).toContainText('REC-00000070');
  });

  test('abre el detalle de una operación en el panel lateral', async ({ page }) => {
    await installRecibosMocks(page);
    await page.goto('/recibos');

    await page.getByRole('button', { name: /ver detalle de la operación A-0001/i }).click();
    const detail = page.getByRole('complementary', { name: /detalle de la operación/i });
    await expect(detail).toBeVisible();
    // Composición nueva del detalle: micro-etiqueta «Operación» + número como título.
    await expect(detail.getByText('Operación', { exact: true })).toBeVisible();
    await expect(detail.getByRole('heading', { name: /A-0001/ })).toBeVisible();
    await expect(detail.getByText('Maria Lopez').first()).toBeVisible();
    await expect(detail.getByText(/esta operación no tiene pagos registrados/i)).toBeVisible();
    await expect(page).toHaveURL(/operacion=501/);
  });

  test('reimprime el recibo institucional exigiendo un motivo auditado', async ({ page }) => {
    const printEvents: Array<{ payload: Record<string, unknown>; key: string | null }> = [];
    await installRecibosMocks(page, {
      onPrintEvent: (payload, key) => printEvents.push({ payload, key }),
    });
    await page.goto('/recibos');

    await page
      .getByRole('row', { name: /A-0002/i })
      .getByRole('button', { name: /ver recibo/i })
      .click();
    const receiptDialog = page.getByRole('dialog', { name: /^comprobante A-0002$/i });
    await expect(receiptDialog).toBeVisible();
    await expect(receiptDialog.getByRole('region', { name: /vista previa del recibo/i }).locator('iframe')).toBeVisible();

    await receiptDialog.getByRole('button', { name: /^registrar reimpresión$/i }).click();
    const reprintDialog = page.getByRole('dialog', { name: /reimprimir A-0002/i });
    await expect(reprintDialog).toBeVisible();

    const confirm = reprintDialog.getByRole('button', { name: /^reimprimir$/i });
    await expect(confirm).toBeDisabled();
    await reprintDialog.getByLabel(/^motivo \*$/i).fill('Segunda copia solicitada por el paciente.');
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect.poll(() => printEvents.length).toBe(1);
    expect(printEvents[0].payload).toMatchObject({
      reason: 'Segunda copia solicitada por el paciente.',
    });
    expect(printEvents[0].key).toMatch(/\S/);
  });
});
