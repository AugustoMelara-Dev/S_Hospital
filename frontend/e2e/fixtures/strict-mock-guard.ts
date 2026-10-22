import { expect, type Page } from '@playwright/test';

type GuardState = { issues: string[]; navigating: boolean };

/** Textos de cancelación de petición por navegador (ver `requestfailed`). */
const CANCELLED_REQUEST_MARKERS = [
  'ERR_ABORTED',
  'NS_BINDING_ABORTED',
  'Load request cancelled',
  'NS_ERROR_ABORT',
];

const guardStates = new WeakMap<Page, GuardState>();

export async function installStrictMockGuard(page: Page): Promise<void> {
  const state: GuardState = { issues: [], navigating: false };
  guardStates.set(page, state);

  page.on('console', (message) => {
    const text = message.text();
    // Playwright init scripts are intentionally refused by the receipt preview's
    // sandboxed srcdoc frame. This browser diagnostic confirms the security
    // boundary; it is not an application console failure.
    if (message.type() === 'error' && /Blocked script execution in 'about:srcdoc'.*sandboxed.*allow-scripts/i.test(text)) return;
    if (message.type() === 'error') state.issues.push(`console.error: ${text}`);
  });
  page.on('pageerror', (error) => state.issues.push(`pageerror: ${error.message}`));
  page.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) state.navigating = true;
  });
  page.on('load', () => { state.navigating = false; });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? '';
    const pathname = new URL(request.url()).pathname;
    // TanStack Query aborts stale GET requests when filters, URL state or
    // responsive views change. Missing API mocks are still recorded by the
    // catch-all route below, so an intentional client cancellation is not a
    // network failure for this guard.
    //
    // T-QA-06: los navegadores reportan la cancelación con textos distintos —
    // Chromium `net::ERR_ABORTED`, Firefox `NS_BINDING_ABORTED`, WebKit
    // `Load request cancelled` —; la intención documentada arriba aplica a los
    // tres, no sólo a Chromium. No se relaja ninguna otra comprobación.
    const cancelled = CANCELLED_REQUEST_MARKERS.some((marker) => failure.includes(marker));
    if (cancelled && request.method() === 'GET') return;
    if (cancelled && (!pathname.startsWith('/api/') || state.navigating)) return;
    state.issues.push(`requestfailed: ${request.method()} ${request.url()} ${failure}`.trim());
  });
  page.on('response', (response) => {
    if (response.status() >= 500) {
      state.issues.push(`http.${response.status()}: ${response.request().method()} ${response.url()}`);
    }
  });

  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    state.issues.push(`unexpected-api: ${request.method()} ${new URL(request.url()).pathname}${new URL(request.url()).search}`);
    await route.fulfill({ status: 418, contentType: 'application/json', body: JSON.stringify({ message: 'Unexpected mocked E2E request' }) });
  });
}

export function assertStrictMockGuard(page: Page): void {
  const issues = guardStates.get(page)?.issues ?? ['strict mock guard was not installed'];
  expect(issues, issues.join('\n')).toEqual([]);
}
