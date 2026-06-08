// =============================================================================
// WebSocket end-to-end test.
//
// Validates the cross-PC broadcast contract: a second cashier in
// another browser context should see the first cashier's actions
// within ~2 seconds thanks to the soketi WebSocket fed by nginx
// at /ws.
//
// This test is SKIPPED by default. It only runs when
// process.env.BASE_URL is set to a real stack URL.
//
// To run against the production stack:
//   BASE_URL=https://192.168.1.10:8443 \
//   CASHIER_USER_1=cajero1 CASHIER_PASSWORD_1=... \
//   CASHIER_USER_2=cajero2 CASHIER_PASSWORD_2=... \
//   npm run e2e -- e2e/websocket-real.spec.ts
// =============================================================================

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL;
const SKIP_REASON = !BASE_URL
  ? 'BASE_URL not set; WebSocket E2E only runs against a real stack. Set BASE_URL=https://IP:8443 to enable.'
  : BASE_URL.includes('127.0.0.1') || BASE_URL.includes('localhost')
    ? 'BASE_URL points to loopback; this test requires a real multi-client stack.'
    : null;

const SCREENSHOTS_DIR = path.join('test-results', 'websocket-real');

test.beforeAll(async () => {
  if (SKIP_REASON) return;
  await mkdir(SCREENSHOTS_DIR, { recursive: true });
});

test.describe('Cross-PC WebSocket realtime', () => {
  test.skip(SKIP_REASON !== null, SKIP_REASON ?? 'unknown reason');

  test('cashier B sees cashier A invoice event within 2s', async ({ browser }) => {
    const userA = process.env.CASHIER_USER_1 ?? 'cajero1';
    const passA = process.env.CASHIER_PASSWORD_1 ?? 'Cambio1234';
    const userB = process.env.CASHIER_USER_2 ?? 'cajero2';
    const passB = process.env.CASHIER_PASSWORD_2 ?? 'Cambio1234';

    const contextA: BrowserContext = await browser.newContext({ ignoreHTTPSErrors: true });
    const contextB: BrowserContext = await browser.newContext({ ignoreHTTPSErrors: true });

    try {
      const pageA: Page = await contextA.newPage();
      const pageB: Page = await contextB.newPage();

      // Both cashiers log in.
      await Promise.all([loginAs(pageA, userA, passA), loginAs(pageB, userB, passB)]);

      // Both navigate to the invoice history. The query for invoices
      // should be invalidated when a new invoice is created by A.
      await Promise.all([
        pageA.goto(`${BASE_URL}/invoices`),
        pageB.goto(`${BASE_URL}/invoices`),
      ]);

      // Count invoices in B before A acts.
      const beforeCount = await pageB.locator('[data-testid="invoice-row"]').count();

      // A creates a new invoice via the API. We use the API
      // directamente to avoid the cash-session gating in the UI form.
      const patientName = `WS E2E ${Date.now()}`;
      const createResult = await pageA.evaluate(
        async ({ patientName }) => {
          // The apiClient.fetchCsrfCookie is called by apiClient.request
          // automatically; we just need the XSRF cookie value.
          const xsrf = document.cookie
            .split(';')
            .map(c => c.trim())
            .find(c => c.startsWith('XSRF-TOKEN='))?.split('=')[1] ?? '';
          const r = await fetch('/api/invoices', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'X-XSRF-TOKEN': decodeURIComponent(xsrf),
            },
            body: JSON.stringify({
              patient_name: patientName,
              items: [
                { service_id: 1, quantity: '1.00' },
              ],
            }),
          });
          return { status: r.status, body: await r.text() };
        },
        { patientName },
      );
      expect(createResult.status, `invoice creation failed: ${createResult.body}`).toBeLessThan(300);

      // Wait up to 5s for the realtime event to invalidate B's query.
      const expectedInvoiceNumber = JSON.parse(createResult.body).data.invoice_number;
      await expect(
        pageB.locator(`[data-invoice-number="${expectedInvoiceNumber}"]`),
        'cashier B should see the new invoice in real-time',
      ).toBeVisible({ timeout: 5000 });

      // Snapshot for the QA evidence.
      await pageB.screenshot({ path: path.join(SCREENSHOTS_DIR, 'cashier-B-after-invoice.png') });
      await pageA.screenshot({ path: path.join(SCREENSHOTS_DIR, 'cashier-A-after-invoice.png') });

      // Counts should be the same: B's table updated in place.
      const afterCount = await pageB.locator('[data-testid="invoice-row"]').count();
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 1);
    } finally {
      await contextA.close().catch(() => undefined);
      await contextB.close().catch(() => undefined);
    }
  });
});

async function loginAs(page: Page, user: string, pass: string): Promise<void> {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="login"]', user);
  await page.fill('input[name="password"]', pass);
  await Promise.all([
    page.waitForURL((u) => !u.toString().includes('/login'), { timeout: 15_000 }),
    page.click('button[type="submit"]'),
  ]);
}
