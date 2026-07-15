import { resolve } from 'node:path';
import { expect, test, type Page, type Route } from '@playwright/test';
import { assertStrictMockGuard, installStrictMockGuard } from './fixtures/strict-mock-guard';

test.beforeEach(async ({ page }) => installStrictMockGuard(page));
test.afterEach(async ({ page }) => assertStrictMockGuard(page));

const cashierUser = {
  id: 71,
  name: 'Caja Turno',
  email: 'caja@hospital.local',
  username: 'caja.turno',
  active: true,
  roles: ['cajero'],
  permissions: [
    'cash.view',
    'cash.open',
    'cash.close',
    'reports.cash_session.view',
    'invoices.view',
    'invoices.create',
    'catalog.view',
    'payments.create',
    'receipts.view',
  ],
  must_change_password: false,
};

const openSession = {
  id: 77,
  user_id: cashierUser.id,
  opened_by: cashierUser.id,
  opening_amount: '100.00',
  expected_cash_amount: '125.00',
  expected_amount: '125.00',
  cash_sales: '25.00',
  cash_refunds: '0.00',
  payments_total: '25.00',
  payments_count: 1,
  payments_by_method: {
    cash: '25.00',
    transfer: '0.00',
    card: '0.00',
    other: '0.00',
  },
  pending_invoice_count: 0,
  pending_amount: '0.00',
  missing_institutional_receipt_count: 0,
  reversed_payments_count: 0,
  reversed_payments_total: '0.00',
  status: 'open',
  opening_notes: null,
  closing_amount: null,
  closing_notes: null,
  opened_at: '2026-07-02T08:00:00-06:00',
  closed_at: null,
  created_at: '2026-07-02T08:00:00-06:00',
  updated_at: '2026-07-02T08:00:00-06:00',
  user: { id: cashierUser.id, name: cashierUser.name, username: cashierUser.username },
};

test.describe('Cash session - critical mocked e2e', () => {
  test('close with cash difference requires an explanatory note before posting', async ({ page }) => {
    let closePayload: Record<string, unknown> | null = null;
    await installCashboxMocks(page, {
      onClose: (payload) => {
        closePayload = payload;
      },
    });

    await page.goto('/cashbox');

    await expect(page.getByRole('heading', { level: 1, name: /^caja$/i })).toBeVisible();
    await expect(page.getByText(/caja abierta desde/i)).toBeVisible();
    await expect(page.getByRole('region', { name: /estado operativo de caja/i }).getByText('Efectivo esperado', { exact: true })).toBeVisible();

    await page.getByRole('tab', { name: /^cierre$/i }).click();
    await page.getByLabel(/monto contado/i).fill('100.00');
    await expect(page.getByRole('alert').filter({ hasText: /diferencia/i })).toBeVisible();
    await page.getByRole('button', { name: /^cerrar caja$/i }).click();

    const dialog = page.getByRole('dialog', { name: /cierre de caja/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/1\. resumen del turno/i)).toBeVisible();
    await expect(dialog.getByText(/2\. conteo de efectivo/i)).toBeVisible();
    await expect(dialog.getByText(/3\. confirmar cierre/i)).toBeVisible();
    await expect(dialog.getByText(/la nota es obligatoria.*al menos 5 caracteres.*diferencia/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /^cerrar caja$/i })).toBeDisabled();
    await expect.poll(() => closePayload).toBeNull();

    await dialog.getByLabel(/nota sobre la diferencia/i).fill('Faltante revisado y autorizado por administracion.');
    await expect(dialog.getByRole('button', { name: /^cerrar caja$/i })).toBeEnabled();
    await dialog.getByRole('button', { name: /^cerrar caja$/i }).click();

    await expect.poll(() => closePayload).not.toBeNull();
    expect(closePayload).toMatchObject({
      closing_amount: '100.00',
      notes: 'Faltante revisado y autorizado por administracion.',
    });
    await expect(page.getByRole('dialog', { name: /cierre de caja/i })).toHaveCount(0);
    await expect(page.getByRole('region', { name: /estado operativo de caja/i })).toContainText('Caja cerrada');
    const confirmedSummary = page.locator('[data-cash-close-print-root]');
    await expect(confirmedSummary).toContainText('Resumen de cierre confirmado');
    await expect(confirmedSummary).toContainText('Efectivo');
    await expect(confirmedSummary).toContainText('L 25.00');
  });

  test('blocks close before posting when a paid invoice is missing its receipt', async ({ page }) => {
    let closeRequests = 0;
    await installCashboxMocks(page, {
      initialSession: {
        ...openSession,
        missing_institutional_receipt_count: 1,
      },
      onClose: () => {
        closeRequests += 1;
      },
    });

    await page.goto('/cashbox');

    await page.getByRole('tab', { name: /^arqueo$/i }).click();
    await expect(page.getByRole('heading', { name: /control contable de caja/i })).toBeVisible();
    await expect(page.getByText(/1 recibo institucional pendiente/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /resolver en historial/i })).toHaveAttribute('href', '/invoices');
    await page.getByRole('tab', { name: /^cierre$/i }).click();
    await expect(page.getByRole('list', { name: /bloqueos del cierre/i }).getByRole('link', { name: /resolver en historial/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^cerrar caja$/i })).toBeDisabled();
    await expect.poll(() => closeRequests).toBe(0);
  });

  test('keeps the operational header, movement detail and blockers usable across viewports', async ({ page }) => {
    await installCashboxMocks(page, {
      initialSession: {
        ...openSession,
        pending_invoice_count: 1,
        pending_amount: '25.00',
        missing_institutional_receipt_count: 1,
      },
    });

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/cashbox');
    await expect(page.getByRole('region', { name: /estado operativo de caja/i })).toContainText('L 25.00');
    await expect(page.getByText(/caja lista para facturar/i)).toHaveCount(0);
    await expectNoPageOverflow(page);
    await settleForScreenshot(page);
    await page.screenshot({ path: resolve(process.cwd(), '..', 'qa', 'operational-ux', 'after', 'cashbox-1366.png'), fullPage: true });

    await page.getByRole('tab', { name: /^movimientos$/i }).click();
    await expect(page.getByRole('region', { name: /^movimientos de caja$/i }).last()).toBeVisible();
    await settleForScreenshot(page);
    await page.screenshot({ path: resolve(process.cwd(), '..', 'qa', 'operational-ux', 'after', 'cashbox-movements-1366.png'), fullPage: true });

    await page.setViewportSize({ width: 768, height: 1024 });
    await page.getByRole('tab', { name: /^cierre$/i }).click();
    const blockers = page.getByRole('list', { name: /bloqueos del cierre/i });
    await expect(blockers.getByRole('link', { name: /resolver en historial/i })).toHaveCount(2);
    await expectNoPageOverflow(page);
    await settleForScreenshot(page);
    await page.screenshot({ path: resolve(process.cwd(), '..', 'qa', 'operational-ux', 'after', 'cashbox-close-768.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: /^movimientos$/i }).click();
    const mobileMovements = page.getByRole('list', { name: /movimientos de caja en móvil/i });
    await expect(mobileMovements).toBeVisible();
    await expectNoPageOverflow(page);
    await settleForScreenshot(page);
    await page.screenshot({ path: resolve(process.cwd(), '..', 'qa', 'operational-ux', 'after', 'cashbox-movements-390.png'), fullPage: true });
    await mobileMovements.getByRole('button', { name: /ver detalle del movimiento 901/i }).click();
    const detail = page.getByRole('dialog', { name: /detalle del movimiento 901/i });
    await expect(detail).toContainText('000-001-01-00000045');
    await expect(detail).toContainText('Referencia completa para auditoría local');
    await expectNoPageOverflow(page);
    await settleForScreenshot(page);
    await page.screenshot({ path: resolve(process.cwd(), '..', 'qa', 'operational-ux', 'after', 'cashbox-movement-detail-390.png') });
  });
});

async function installCashboxMocks(
  page: Page,
  options: {
    initialSession?: typeof openSession;
    onClose?: (payload: Record<string, unknown>) => void;
  } = {},
) {
  let currentSession: typeof openSession | null = options.initialSession ?? openSession;

  await installCommonMocks(page, cashierUser);
  await page.route(/\/api\/reports\/cash-sessions\/\d+(?:[/?]|$)/, (route) => json(route, { data: cashSessionReport(currentSession ?? openSession) }));
  await page.route(/\/api\/cash-sessions\/current(?:[/?]|$)/, (route) => json(route, { data: currentSession }));
  await page.route(/\/api\/cash-sessions\/\d+\/close(?:[/?]|$)/, (route) => {
    const payload = JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>;
    options.onClose?.(payload);
    currentSession = null;

    return json(route, {
      data: {
        ...openSession,
        ...payload,
        status: 'closed',
        closed_at: '2026-07-02T16:30:00-06:00',
      },
    });
  });
}

function cashSessionReport(session: typeof openSession) {
  return {
    cash_session: session,
    totals_by_method: session.payments_by_method,
    total_cash: session.payments_by_method.cash,
    total_transfer: session.payments_by_method.transfer,
    total_card: session.payments_by_method.card,
    total_other: session.payments_by_method.other,
    payments_count: 1,
    payments_total: '25.00',
    expected_cash_amount: session.expected_cash_amount,
    pending_invoice_count: session.pending_invoice_count,
    pending_amount: session.pending_amount,
    missing_institutional_receipt_count: session.missing_institutional_receipt_count,
    reversed_payments_count: 0,
    reversed_payments_total: '0.00',
    payments: [{
      id: 301,
      invoice_id: 45,
      cash_session_id: session.id,
      user_id: cashierUser.id,
      method: 'cash',
      amount: '25.00',
      reference: null,
      status: 'posted',
      paid_at: '2026-07-02T09:15:00-06:00',
      invoice: {
        id: 45,
        invoice_number: '000-001-01-00000045',
        patient_name: 'Paciente de prueba',
        status: 'paid',
        total: '25.00',
        paid_amount: '25.00',
        balance_due: '0.00',
      },
    }],
    movements: [{
      id: 901,
      cash_session_id: session.id,
      payment_id: 301,
      user_id: cashierUser.id,
      type: 'payment',
      method: 'cash',
      amount: '25.00',
      notes: 'Referencia completa para auditoría local',
      occurred_at: '2026-07-02T09:15:00-06:00',
    }],
  };
}

async function expectNoPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
}

async function settleForScreenshot(page: Page) {
  await page.evaluate(() => new Promise<void>((resolveFrame) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolveFrame()));
  }));
}

async function installCommonMocks(page: Page, sessionUser: typeof cashierUser) {
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
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
