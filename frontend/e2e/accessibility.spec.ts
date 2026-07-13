import { expect, test, type Page, type Route } from '@playwright/test';
import axeCore from 'axe-core';

const today = '2026-07-02';
const issuedAt = `${today}T08:00:00-06:00`;
const paidAt = `${today}T08:15:00-06:00`;

const adminUser = {
  id: 91,
  name: 'Administradora Accesibilidad',
  email: 'accesibilidad@hospital.local',
  username: 'admin.a11y',
  active: true,
  roles: ['admin'],
  permissions: [
    'settings.fiscal.view',
    'settings.fiscal.update',
    'receipt_settings.view',
    'receipt_settings.update',
    'catalog.view',
    'catalog.manage',
    'cash.view',
    'cash.open',
    'cash.close',
    'cash.close_any',
    'invoices.view',
    'invoices.create',
    'invoices.void',
    'invoices.reverse',
    'payments.create',
    'payments.view',
    'payments.void',
    'receipts.view',
    'receipts.reprint',
    'receipts.reprint_any',
    'reports.view',
    'reports.managerial.view',
    'reports.cash_session.view',
    'reports.export',
    'backups.view',
    'backups.create',
    'backups.download',
    'users.view',
    'users.create',
    'users.update',
    'users.disable',
    'users.assign_admin_role',
    'system.status.view',
    'patients.mark_dialysis_prescription',
  ],
  must_change_password: false,
};

const category = { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 };
const service = {
  id: 11,
  category_id: category.id,
  area_id: null,
  name: 'Glucosa basal',
  slug: 'glucosa-basal',
  aliases: null,
  scan_code: 'GLU-001',
  barcode: null,
  qr_code: null,
  description: null,
  internal_code: null,
  price: '15.00',
  taxable: true,
  active: true,
  visible_in_billing: true,
  is_billable: true,
  special_rule_code: null,
  category,
  area: null,
};

const cashSession = {
  id: 7,
  user_id: adminUser.id,
  user: { id: adminUser.id, name: adminUser.name, username: adminUser.username },
  opening_amount: '500.00',
  closing_amount: null,
  expected_amount: '517.25',
  expected_cash_amount: '517.25',
  difference_amount: null,
  status: 'open',
  opening_notes: null,
  closing_notes: null,
  opened_at: issuedAt,
  closed_at: null,
  payments_count: 1,
  payments_total: '17.25',
  pending_invoice_count: 0,
  pending_amount: '0.00',
  payments_by_method: { cash: '17.25', transfer: '0.00', card: '0.00', other: '0.00' },
};

const invoice = {
  id: 100,
  invoice_number: '000-001-01-00000100',
  patient_name: 'Paciente Accesibilidad',
  subtotal: '15.00',
  tax_amount: '2.25',
  discount_amount: '0.00',
  total: '17.25',
  paid_amount: '17.25',
  balance_due: '0.00',
  status: 'paid',
  issued_at: issuedAt,
  items: [{
    id: 1,
    service_id: service.id,
    service_name: service.name,
    category_id: category.id,
    category_name: category.name,
    area_id: null,
    area_name: null,
    quantity: '1.00',
    unit_price: '15.00',
    tax_rate: '15.00',
    tax_amount: '2.25',
    line_subtotal: '15.00',
    line_total: '17.25',
    special_rule_code: null,
    special_rule_applied: false,
    notes: null,
  }],
  payments: [{
    id: 50,
    invoice_id: 100,
    cash_session_id: cashSession.id,
    user_id: adminUser.id,
    method: 'cash',
    amount: '17.25',
    reference: null,
    status: 'posted',
    paid_at: paidAt,
  }],
  issuer: { id: adminUser.id, name: adminUser.name, username: adminUser.username },
};

const backup = {
  id: 1,
  filename: 'hospital-backup-20260702-080000.sql.enc',
  size_bytes: 3145728,
  checksum_sha256: 'a'.repeat(64),
  status: 'success',
  type: 'manual',
  created_by: adminUser.id,
  completed_at: paidAt,
  created_at: issuedAt,
  updated_at: paidAt,
  error_message: null,
  creator: { id: adminUser.id, name: adminUser.name, username: adminUser.username },
};

const routeExpectations = [
  { path: '/dashboard', heading: /centro de mando/i },
  { path: '/billing/new', heading: /nueva factura/i },
  { path: '/cashbox', heading: /^caja$/i },
  { path: '/catalog', heading: /catalogo|cat.logo/i },
  { path: '/invoices', heading: /historial/i },
  { path: '/reports/executive', heading: /control ejecutivo/i },
  { path: '/backups', heading: /respaldos|backups/i },
  { path: '/settings/fiscal', heading: /configuracion|configuraci.n/i },
  { path: '/admin/users', heading: /usuarios/i },
] as const;

test.describe('Accessibility - critical mocked e2e (WCAG AA)', () => {
  test('institutional shell reports no color contrast violations', async ({ page }) => {
    await installAccessibilityMocks(page, { authenticated: true });
    await page.goto('/dashboard');
    await waitForScreen(page, /continuar operaci.n/i);

    await expect(await shellContrastViolations(page), 'institutional shell contrast details').toEqual([]);
  });

  test('all supported branding themes keep the shell contrast-safe', async ({ page }, testInfo) => {
    await installAccessibilityMocks(page, { authenticated: true });
    await page.goto('/dashboard');

    for (const color of ['teal', 'blue', 'green', 'indigo', 'rose', 'invalid-low-contrast']) {
      for (const mode of ['light', 'dark']) {
        await page.evaluate(({ color, mode }) => {
          localStorage.setItem('hospital-billing-color-theme', color);
          localStorage.setItem('hospital-billing-theme', mode);
        }, { color, mode });
        await page.reload();
        await waitForScreen(page, /continuar operaci.n/i);
        await expect(
          await shellContrastViolations(page),
          `${color} ${mode} shell contrast details`,
        ).toEqual([]);
        if (color === 'teal') {
          await testInfo.attach(`shell-teal-${mode}`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: 'image/png',
          });
        }
      }
    }
  });

  test('real shell overlays remain accessible, flat and keyboard operable', async ({ page }) => {
    await installAccessibilityMocks(page, { authenticated: true });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/dashboard');
    await waitForScreen(page, /continuar operaci.n/i);

    const rail = page.locator('[data-testid="institutional-rail"], [data-testid="clinical-rail"]');
    await expect(rail).toHaveAttribute('data-collapsed', 'false');
    await expectFlatSurface(rail);

    await page.keyboard.press('Tab');
    const focusedFromKeyboard = page.locator(':focus');
    await expect(focusedFromKeyboard).toBeVisible();
    await expect.poll(async () => focusedFromKeyboard.evaluate((element) => {
      const style = getComputedStyle(element);
      return style.outlineStyle !== 'none' || style.boxShadow !== 'none';
    }), { message: 'keyboard focus must have a visible outline or ring' }).toBe(true);

    const collapseButton = page.getByRole('button', { name: 'Reducir navegación' });
    await collapseButton.click();
    await expect(rail).toHaveAttribute('data-collapsed', 'true');
    await expect(await seriousShellAxeViolations(page), 'collapsed rail axe').toEqual([]);

    const userMenuButton = page.getByRole('button', { name: 'Abrir menu de usuario' });
    await userMenuButton.click();
    const userMenu = page.getByRole('menu');
    await expect(userMenu).toBeVisible();
    await expectFlatSurface(page.locator('.ant-dropdown'));
    await expect(await seriousShellAxeViolations(page), 'user menu axe').toEqual([]);
    await page.keyboard.press('Escape');
    await expect(userMenuButton).toBeFocused();

    const commandButton = page.getByRole('button', { name: 'Abrir comandos' });
    await commandButton.click();
    const commandDialog = page.getByRole('dialog', { name: 'Comandos' });
    await expect(commandDialog).toBeVisible();
    await expectFlatSurface(commandDialog);
    await expect(await seriousShellAxeViolations(page), 'command palette axe').toEqual([]);
    await page.keyboard.press('Escape');
    await expect(commandButton).toBeFocused();

    const shortcutsButton = page.getByRole('button', { name: /atajos de teclado/i });
    await shortcutsButton.hover();
    const tooltip = page.getByRole('tooltip', { name: /atajos/i });
    await expect(tooltip).toBeVisible();
    await expectFlatSurface(tooltip);
    await page.keyboard.press('Escape');

    const helpButton = page.getByRole('button', { name: /abrir ayuda/i });
    await helpButton.click();
    const guideDialog = page.getByRole('dialog', { name: /gu.a r.pida del sistema/i });
    await expect(guideDialog).toBeVisible();
    await expectFlatSurface(guideDialog);
    await expectFlatSurface(page.getByTestId('guided-tour-step'));
    await expect(await seriousShellAxeViolations(page), 'guided tour axe').toEqual([]);
    await page.keyboard.press('Escape');
    await expect(helpButton).toBeFocused();
  });

  test('mobile navigation and responsive zoom keep the shell usable', async ({ page }, testInfo) => {
    await installAccessibilityMocks(page, { authenticated: true });

    for (const viewport of [
      { width: 390, height: 844, zoom: 1 },
      { width: 1366, height: 768, zoom: 1.25 },
      { width: 1920, height: 1080, zoom: 1 },
    ]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/dashboard');
      await waitForScreen(page, /continuar operaci.n/i);
      await page.evaluate((zoom) => { document.documentElement.style.zoom = String(zoom); }, viewport.zoom);

      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      await expect(await seriousShellAxeViolations(page), `${viewport.width}x${viewport.height} axe`).toEqual([]);
      await testInfo.attach(`shell-${viewport.width}x${viewport.height}-zoom-${viewport.zoom}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      if (viewport.width === 390) {
        const moreButton = page.getByRole('button', { name: 'Más destinos' });
        await moreButton.click();
        const drawer = page.getByRole('dialog', { name: 'Más destinos' });
        await expect(drawer).toBeVisible();
        await expectFlatSurface(drawer);
        await expect(await seriousShellAxeViolations(page), 'mobile navigation open axe').toEqual([]);
        await testInfo.attach('shell-mobile-navigation-open', {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
        await page.keyboard.press('Escape');
        await expect(moreButton).toBeFocused();
      }
    }
  });

  test('login page exposes a single h1, labeled controls and no serious axe issues', async ({ page }) => {
    await installAccessibilityMocks(page, { authenticated: false });

    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1, name: /hospital san isidro/i })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByLabel(/usuario o correo/i)).toBeVisible();
    await expect(page.getByLabel(/^contrase/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /mostrar contrase/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /iniciar sesi.n/i })).toBeVisible();

    await expect(await seriousAxeViolations(page), 'login serious axe violations').toEqual([]);
    await expect(await visibleUnnamedControls(page), 'login unnamed controls').toEqual([]);
  });

  test('critical protected routes expose one main landmark, one h1 and named controls', async ({ page }) => {
    await installAccessibilityMocks(page, { authenticated: true });

    for (const route of routeExpectations) {
      await page.goto(route.path);
      await waitForScreen(page, route.heading);

      await expect(page.getByRole('main'), `${route.path} main landmark`).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 }), `${route.path} h1 count`).toHaveCount(1);
      await expect(await visibleUnnamedControls(page), `${route.path} unnamed controls`).toEqual([]);
      await expect(await seriousAxeViolations(page), `${route.path} serious axe violations`).toEqual([]);
    }
  });
});

async function shellContrastViolations(page: Page) {
  await page.addScriptTag({ content: axeCore.source });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: 'rule', values: ['color-contrast'] },
    });

    return result.violations.flatMap((violation) => violation.nodes.map((node) => {
      const element = document.querySelector(node.target.join(' '));
      const style = element ? window.getComputedStyle(element) : null;
      return {
        selector: node.target,
        html: node.html,
        foreground: style?.color ?? null,
        background: style?.backgroundColor ?? null,
        failure: node.failureSummary,
      };
    }));
  });
}

async function seriousShellAxeViolations(page: Page) {
  await page.addScriptTag({ content: axeCore.source });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      },
    });
    return result.violations
      .filter((violation) => ['critical', 'serious'].includes(String(violation.impact)))
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.slice(0, 5).map((node) => ({ target: node.target, failure: node.failureSummary })),
      }));
  });
}

async function expectFlatSurface(locator: ReturnType<Page['locator']>) {
  await expect(locator).toBeVisible();
  const style = await locator.evaluate((element) => {
    const computed = window.getComputedStyle(element);
    return {
      borderTopLeftRadius: computed.borderTopLeftRadius,
      borderTopRightRadius: computed.borderTopRightRadius,
      borderBottomLeftRadius: computed.borderBottomLeftRadius,
      borderBottomRightRadius: computed.borderBottomRightRadius,
      hasVisibleBoxShadow: computed.boxShadow !== 'none'
        && !computed.boxShadow.split(/,\s*(?=rgba\()/).every((shadow) => /rgba\([^)]+,\s*0\)\s/.test(shadow)),
      backgroundImage: computed.backgroundImage,
    };
  });
  expect(style).toEqual({
    borderTopLeftRadius: '0px',
    borderTopRightRadius: '0px',
    borderBottomLeftRadius: '0px',
    borderBottomRightRadius: '0px',
    hasVisibleBoxShadow: false,
    backgroundImage: 'none',
  });
}

async function installAccessibilityMocks(page: Page, options: { authenticated: boolean }) {
  let authenticated = options.authenticated;

  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204 }));
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();

    if (path === '/api/auth/login' && method === 'POST') {
      authenticated = true;
      return json(route, { data: adminUser });
    }
    if (path === '/api/auth/logout') {
      authenticated = false;
      return json(route, { ok: true });
    }
    if (path === '/api/auth/session' || path === '/api/auth/me') {
      return authenticated ? json(route, { data: adminUser }) : json(route, { message: 'Unauthenticated.' }, 401);
    }
    if (path === '/api/settings/branding' || path === '/api/public/branding') {
      return json(route, { data: branding() });
    }
    if (path === '/api/settings/logo') {
      return route.fulfill({ status: 404, body: '' });
    }
    if (path === '/api/settings/fiscal' || path === '/api/settings/operational') {
      return json(route, { data: fiscalSettings() });
    }
    if (path === '/api/fiscal-sequences') {
      return json(route, { data: [fiscalSequence()] });
    }
    if (path === '/api/categories') {
      return json(route, { data: [category], meta: { current_page: 1, per_page: 50, total: 1 } });
    }
    if (path === '/api/areas' || path === '/api/service-areas') {
      return json(route, { data: [] });
    }
    if (path === '/api/services') {
      return json(route, { data: [service], meta: { current_page: 1, per_page: 24, total: 1 } });
    }
    if (path === '/api/cash-sessions/current') {
      return json(route, { data: cashSession });
    }
    if (path === '/api/cash-sessions') {
      return json(route, { data: [cashSession], meta: { current_page: 1, per_page: 50, total: 1 } });
    }
    if (path === '/api/invoices') {
      return json(route, { data: [invoice], meta: { current_page: 1, per_page: 10, total: 1 } });
    }
    if (path === '/api/invoices/100') {
      return json(route, { data: invoice });
    }
    if (path === '/api/reports/dashboard') {
      return json(route, { data: dashboardReport() });
    }
    if (path === '/api/reports/today') {
      return json(route, { data: todayReport() });
    }
    if (path === '/api/reports/executive') {
      return json(route, { data: executiveReport() });
    }
    if (path.startsWith('/api/reports/cash-sessions/')) {
      return json(route, { data: cashSessionReport() });
    }
    if (path === '/api/backups') {
      return json(route, { data: [backup], meta: { current_page: 1, per_page: 15, total: 1 } });
    }
    if (path.endsWith('/download')) {
      return route.fulfill({ status: 200, contentType: 'application/octet-stream', body: 'backup' });
    }
    if (path === '/api/system/health') {
      return json(route, { ok: true });
    }
    if (path === '/api/system/echo-config') {
      return json(route, {
        data: { enabled: false, broadcaster: 'log', key: null, ws_host: null, ws_port: null, force_tls: false },
      });
    }
    if (path === '/api/system/status' || path === '/api/system/status-summary') {
      return json(route, { data: systemStatus() });
    }
    if (path === '/api/admin/users') {
      return json(route, { data: [adminUser] });
    }
    if (path === '/api/admin/roles') {
      return json(route, { data: roles(), permission_catalog: permissionCatalog() });
    }
    if (path.startsWith('/api/admin/users/') || path.startsWith('/api/admin/roles/')) {
      return json(route, { data: adminUser });
    }

    return json(route, { data: null });
  });
}

async function waitForScreen(page: Page, heading: RegExp) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 15_000 });
}

async function seriousAxeViolations(page: Page) {
  await page.addScriptTag({ content: axeCore.source });
  return page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      },
      rules: {
        'color-contrast': { enabled: false },
      },
    });
    return result.violations
      .filter((violation) => ['critical', 'serious'].includes(String(violation.impact)))
      .map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.slice(0, 3).map((node) => node.target),
      }));
  });
}

async function visibleUnnamedControls(page: Page) {
  return page.locator([
    'button',
    'a[href]',
    'input:not([type="hidden"])',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[role="menuitem"]',
    '[role="tab"]',
    '[role="checkbox"]',
    '[role="combobox"]',
  ].join(',')).evaluateAll((elements) => {
    function isVisible(element: Element) {
      const html = element as HTMLElement;
      const style = window.getComputedStyle(html);
      const rect = html.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && !html.closest('[aria-hidden="true"]');
    }

    function byIdText(ids: string | null) {
      return (ids ?? '')
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
        .join(' ')
        .trim();
    }

    function associatedLabelText(element: Element) {
      if (!(element instanceof HTMLInputElement)
        && !(element instanceof HTMLSelectElement)
        && !(element instanceof HTMLTextAreaElement)) {
        return '';
      }

      return Array.from(element.labels ?? [])
        .map((label) => label.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ');
    }

    function accessibleName(element: Element) {
      const html = element as HTMLElement;
      return [
        html.getAttribute('aria-label'),
        byIdText(html.getAttribute('aria-labelledby')),
        associatedLabelText(html),
        html.getAttribute('title'),
        html.textContent,
        html.getAttribute('placeholder'),
      ].find((value) => value && value.trim().length > 0)?.trim() ?? '';
    }

    return elements
      .filter(isVisible)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute('role'),
        id: element.id,
        className: element.getAttribute('class'),
        name: accessibleName(element),
      }))
      .filter((control) => control.name.length === 0);
  });
}

function branding() {
  return {
    hospital_name: 'Hospital San Isidro',
    primary_color: 'indigo',
    slogan: 'Sistema LAN',
    government_line: null,
    secretariat_line: null,
    receipt_location: 'Tocoa',
  };
}

function fiscalSettings() {
  return {
    ...branding(),
    rtn: '08011999123456',
    address: 'Tocoa, Colon',
    scanner_enabled: true,
    partial_payments_enabled: true,
    default_tax_rate: '15.00',
    receipt_paper_size: 'half_letter',
    receipt_template_mode: 'institutional',
  };
}

function fiscalSequence() {
  return {
    id: 1,
    document_type: 'invoice',
    prefix: '000-001-01',
    min_number: 1,
    max_number: 99999999,
    current_number: 100,
    cai: 'VALIDACION-CAI',
    valid_until: '2027-06-19',
    active: true,
  };
}

function dashboardReport() {
  return {
    current_month: { total_billed: '17.25', total_collected: '17.25', invoice_count: 1, payment_count: 1 },
    last_7_days: [{ date: today, total_billed: '17.25', total_collected: '17.25', invoice_count: 1, payment_count: 1 }],
    payments_by_method: { cash: '17.25', transfer: '0.00', card: '0.00', other: '0.00' },
    top_services: [{ service_name: service.name, category_name: category.name, quantity: '1.00', total: '17.25' }],
    cashiers_summary: [{ user_id: adminUser.id, name: adminUser.name, username: adminUser.username, payment_count: 1, total_collected: '17.25' }],
  };
}

function todayReport() {
  return {
    date: today,
    timezone: 'America/Tegucigalpa',
    server_time: issuedAt,
    cash_session_open: true,
    cash_session_id: cashSession.id,
    cash_session_opened_at: cashSession.opened_at,
    cash_session_opening_amount: cashSession.opening_amount,
    issued_count: 1,
    collected_count: 1,
    billed: '17.25',
    collected: '17.25',
    pending: '0.00',
    voided_count: 0,
    voided_amount: '0.00',
    reversal_count: 0,
    pending_invoice_count: 0,
    pending_invoice_amount: '0.00',
    payments_by_method: cashSession.payments_by_method,
    payments_count_by_method: { cash: 1, transfer: 0, card: 0, other: 0 },
    backup_pending: false,
    backup_pending_age_hours: null,
  };
}

function executiveReport() {
  return {
    period: { from: today, to: today, days: 1, timezone: 'America/Tegucigalpa' },
    filters: { cash_session_id: null, user_id: null, category_id: null, area_id: null, method: null, status: null },
    comparison: {
      billed: { current: '17.25', previous: '0.00', delta_cents: 1725, delta_percentage: null },
      collected: { current: '17.25', previous: '0.00', delta_cents: 1725, delta_percentage: null },
      previous_period: { from: today, to: today },
    },
    summary: {
      billed_total: '17.25',
      collected_total: '17.25',
      collected_total_cents: 1725,
      pending_total: '0.00',
      voided_total: '0.00',
      reversed_total: '0.00',
      invoice_count: 1,
      receipt_count: 1,
      paid_count: 1,
      partial_count: 0,
      pending_count: 0,
      voided_count: 0,
      average_ticket: '17.25',
    },
    payment_methods: [
      { method: 'cash', label: 'Efectivo', amount: '17.25', count: 1, percentage: 100 },
      { method: 'transfer', label: 'Transferencia', amount: '0.00', count: 0, percentage: 0 },
      { method: 'card', label: 'Tarjeta', amount: '0.00', count: 0, percentage: 0 },
      { method: 'other', label: 'Otro', amount: '0.00', count: 0, percentage: 0 },
    ],
    daily_trend: [{ date: today, billed: '17.25', collected: '17.25', pending: '0.00', voided_count: 0, invoice_count: 1 }],
    services: {
      top_by_amount: [{ service: service.name, category: category.name, item_count: 1, quantity: '1.00', total: '17.25', collected: '17.25' }],
      top_by_quantity: [{ service: service.name, category: category.name, item_count: 1, quantity: '1.00', total: '17.25' }],
      by_category: [{ category: category.name, quantity: '1.00', total: '17.25', collected: '17.25', item_count: 1 }],
      by_area: [],
    },
    cashiers: [{ user_id: adminUser.id, name: adminUser.name, username: adminUser.username, invoice_count: 1, payment_count: 1, collected: '17.25', cash: '17.25', transfer: '0.00', card: '0.00', other: '0.00', voided_count: 0, difference_total: '0.00' }],
    cash_sessions: [{ id: cashSession.id, cashier: adminUser.name, opened_at: issuedAt, closed_at: null, opening_amount: '500.00', expected_cash: '517.25', counted_cash: null, difference: null, status: 'open', closure_note: null }],
    pending_aging: { '0_7_days': { count: 0, amount: '0.00' }, '8_30_days': { count: 0, amount: '0.00' }, '31_plus_days': { count: 0, amount: '0.00' }, items: [] },
    voids_and_reversals: [],
    audit_summary: { critical_events: 0, reprints: 1, fiscal_changes: 0, cash_differences: 0, backup_events: 1 },
  };
}

function cashSessionReport() {
  return {
    cash_session: cashSession,
    totals_by_method: cashSession.payments_by_method,
    total_cash: '17.25',
    total_transfer: '0.00',
    total_card: '0.00',
    total_other: '0.00',
    payments_count: 1,
    payments_total: '17.25',
    expected_cash_amount: '517.25',
    pending_invoice_count: 0,
    pending_amount: '0.00',
    payments: invoice.payments.map((payment) => ({ ...payment, invoice, user: adminUser })),
    movements: [],
  };
}

function systemStatus() {
  return {
    summary: { severity: 'ok', problem_count: 0, label: 'Listo', action: 'Sin acciones pendientes' },
    checks: [],
    advanced_available: true,
    app: { env: 'local', debug: false },
    database: { connected: true, connection: 'mysql', driver: 'mysql', is_mysql_family: true },
    queue: { failed_jobs_count: 0 },
    backups: {
      last_success_at: paidAt,
      pending_count: 0,
      worker_recently_active: true,
      last_success_filename: backup.filename,
      last_failure_at: null,
      last_failure_message: null,
      dump_binary: { configured: true, available: true, name: 'mariadb-dump' },
      storage: { writable: true, free_bytes: 2147483648 },
      queue: {
        connection: 'database',
        jobs_table_available: true,
        failed_jobs_table_available: true,
        failed_jobs_count: 0,
        pending_backup_jobs: 0,
        worker_command: 'php artisan queue:work --queue=backups',
        scheduler_command: 'php artisan schedule:run',
      },
    },
    environment: {
      app_env: 'local',
      app_debug: false,
      app_url: 'http://192.168.1.10',
      queue_connection: 'database',
      filesystem_disk: 'local',
      app_version: '1.0.0',
      php_version: '8.3.0',
      server_time: issuedAt,
      timezone: 'America/Tegucigalpa',
    },
    frontend: { dist_index_exists: true, assets_present: true, assets_count: 8, entry_label: 'frontend/dist/index.html' },
    network: { configured_host: '192.168.1.10', host_type: 'lan', lan_ready: true, client_url: 'http://192.168.1.10', guidance: 'Clientes entran por IP local.' },
    runtime: {
      logs_writable: true,
      cache_writable: true,
      laravel_log: { exists: true, size_bytes: 1024, modified_at: paidAt },
      backup_automation_log: { exists: true, size_bytes: 1024, modified_at: paidAt },
      frontend_build: { available: true, modified_at: paidAt },
      installed_version: '1.0.0',
      latest_migration: '2026_07_02_000000_ready',
      migration_count: 55,
      pending_migration_count: 0,
      pending_migrations: [],
    },
    readiness: { state: 'PRODUCTION_CANDIDATE', production_ready: true, blockers: [] },
    preflight: { production_checks: [], public_routes: [], physical_proofs: [], commands: { preflight: 'scripts/preflight.ps1', backup_worker: 'php artisan queue:work', scheduler: 'php artisan schedule:run' } },
  };
}

function roles() {
  const permissions = permissionCatalog().flatMap((group) => group.permissions.map((permission) => ({
    ...permission,
    module: group.module,
  })));
  return [{ id: 1, name: 'admin', label: 'Admin', protected: true, permissions }];
}

function permissionCatalog() {
  return [
    { module: 'Facturacion', permissions: [{ name: 'invoices.create', label: 'Crear facturas' }, { name: 'invoices.view', label: 'Ver historial' }] },
    { module: 'Caja', permissions: [{ name: 'cash.view', label: 'Ver caja' }, { name: 'payments.create', label: 'Registrar pagos' }] },
    { module: 'Usuarios', permissions: [{ name: 'users.view', label: 'Ver usuarios' }, { name: 'users.assign_admin_role', label: 'Gestionar administradores' }] },
  ];
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}
