import { expect, test, type Page, type Route } from '@playwright/test';

const cashierUser = {
  id: 71,
  name: 'Caja Turno',
  email: 'caja@hospital.local',
  username: 'caja.turno',
  active: true,
  roles: ['cajero'],
  permissions: ['cash.view', 'cash.open', 'cash.close'],
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
    await expect(page.getByText('Efectivo esperado', { exact: true })).toBeVisible();

    await page.getByLabel(/monto contado/i).fill('100.00');
    await expect(page.getByRole('alert').filter({ hasText: /diferencia/i })).toBeVisible();
    await page.getByRole('button', { name: /^cerrar caja$/i }).click();

    const dialog = page.getByRole('alertdialog', { name: /cerrar caja/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/1\. resumen del turno/i)).toBeVisible();
    await expect(dialog.getByText(/2\. conteo de efectivo/i)).toBeVisible();
    await expect(dialog.getByText(/3\. confirmar cierre/i)).toBeVisible();
    await expect(dialog.getByText(/la nota es obligatoria cuando hay diferencia/i)).toBeVisible();
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
    await expect(page.getByRole('alertdialog', { name: /cerrar caja/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /^caja cerrada$/i })).toBeVisible();
  });
});

async function installCashboxMocks(
  page: Page,
  options: { onClose?: (payload: Record<string, unknown>) => void } = {},
) {
  let currentSession: typeof openSession | null = openSession;

  await installCommonMocks(page, cashierUser);
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
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
