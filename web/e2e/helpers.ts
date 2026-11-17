import { expect, request as pwRequest, type APIRequestContext, type Page, type Response } from '@playwright/test';

export const PASSWORD = 'Hospital#2026';
export type DemoUser = 'admin' | 'supervisor' | 'cajero' | 'auditor';

/** Logs in through the real login form and waits for the app shell. */
export async function login(page: Page, user: string, password = PASSWORD): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Usuario o correo').fill(user);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** API client authenticated as a demo user (same origin as the web app, via the Vite proxy). */
export async function apiAs(baseURL: string, user: string, password = PASSWORD): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL, extraHTTPHeaders: { 'X-Requested-With': 'shospital' } });
  const res = await ctx.post('/api/auth/login', { data: { login: user, password } });
  expect(res.status(), await res.text()).toBe(200);
  return ctx;
}

let keySeq = 0;
/** Unique Idempotency-Key for API helpers. */
export function idemKey(): string {
  keySeq += 1;
  return `00000000-0000-4000-8000-${String(Date.now() % 1e9).padStart(9, '0')}${String(keySeq).padStart(3, '0')}`;
}

/** Opens a cash session for the logged user if it has none (API helper). */
export async function ensureCashOpen(api: APIRequestContext, openingCents = 50_000): Promise<number> {
  const cur = await api.get('/api/cash-sessions/current');
  const body = (await cur.json()) as { id: number } | null;
  if (body) return body.id;
  const res = await api.post('/api/cash-sessions/open', {
    data: { opening_cents: openingCents },
    headers: { 'Idempotency-Key': idemKey() },
  });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { id: number }).id;
}

export async function serviceId(api: APIRequestContext, name: string): Promise<number> {
  const res = await api.get('/api/services', { params: { search: name, billing: '1', per_page: '30' } });
  const items = ((await res.json()) as { items: Array<{ id: number; name: string }> }).items;
  const hit = items.find((s) => s.name === name) ?? items[0];
  if (!hit) throw new Error(`Servicio no encontrado: ${name}`);
  return hit.id;
}

/** Issues an invoice without paying it (stays "Pendiente de cobro"). */
export async function createUnpaidInvoice(api: APIRequestContext, patient: string, serviceName = 'Glucosa'): Promise<{ id: number; number: string }> {
  const id = await serviceId(api, serviceName);
  const res = await api.post('/api/invoices', {
    data: { patient_name: patient, items: [{ service_id: id, quantity_hundredths: 100 }], dialysis_prescription: false },
    headers: { 'Idempotency-Key': idemKey() },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as { id: number; number: string };
}

/** Waits for a response whose URL matches and asserts its content type. */
export async function expectResponseType(page: Page, url: RegExp, contentType: RegExp, action: () => Promise<unknown>): Promise<Response> {
  const [res] = await Promise.all([page.waitForResponse((r) => url.test(r.url())), action()]);
  expect(res.status(), `${res.url()} → ${res.status()}`).toBeLessThan(300);
  expect(res.headers()['content-type'] ?? '').toMatch(contentType);
  return res;
}

/** Collects console errors and uncaught page errors (ignores expected 4xx network noise). */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/Failed to load resource: the server responded with a status of 4\d\d/.test(text)) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

/** Fails if the visible text contains broken placeholders. */
export async function expectNoBrokenText(page: Page): Promise<void> {
  const text = await page.locator('main').innerText();
  expect(text).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]|Invalid Date/);
}

/** Closes popups opened by PDF viewers so they do not pile up. */
export async function closePopups(page: Page): Promise<void> {
  for (const p of page.context().pages()) if (p !== page) await p.close();
}
