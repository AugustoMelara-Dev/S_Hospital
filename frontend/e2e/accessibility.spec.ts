import { expect, test, type Page, type Route, type TestInfo } from '@playwright/test';
import axeCore from 'axe-core';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertStrictMockGuard, installStrictMockGuard } from './fixtures/strict-mock-guard';

test.beforeEach(async ({ page }) => installStrictMockGuard(page));
test.afterEach(async ({ page }) => assertStrictMockGuard(page));

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
const passwordChangeUser = { ...adminUser, must_change_password: true };

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
  { path: '/dashboard', heading: /continuar operaci.n/i },
  { path: '/billing/new', heading: /nueva factura/i },
  { path: '/cashbox', heading: /^caja$/i },
  { path: '/catalog', heading: /catalogo|cat.logo/i },
  { path: '/invoices', heading: /historial/i },
  { path: '/reports/executive', heading: /control ejecutivo/i },
  { path: '/backups', heading: /respaldos|backups/i },
  { path: '/settings/fiscal', heading: /configuracion|configuraci.n/i },
  { path: '/settings/institutional-receipts', heading: /recibos institucionales/i },
  { path: '/admin/users', heading: /usuarios/i },
  { path: '/help', heading: /ayuda institucional/i },
  { path: '/support', heading: /asistencia operativa/i },
  { path: '/about', heading: /informacion del sistema/i },
  { path: '/ruta-no-existente', heading: /ruta no encontrada/i },
] as const;

const visualMatrix = [
  { id: 'light-1366x768', mode: 'light', width: 1366, height: 768, zoom: 1 },
  { id: 'dark-1366x768', mode: 'dark', width: 1366, height: 768, zoom: 1 },
  { id: 'light-1920x1080', mode: 'light', width: 1920, height: 1080, zoom: 1 },
  { id: 'dark-1920x1080', mode: 'dark', width: 1920, height: 1080, zoom: 1 },
  { id: 'light-390x844', mode: 'light', width: 390, height: 844, zoom: 1 },
  { id: 'dark-390x844', mode: 'dark', width: 390, height: 844, zoom: 1 },
  { id: 'light-1366x768-zoom-125', mode: 'light', width: 1366, height: 768, zoom: 1.25 },
] as const;

const modernSurfaceSelectors = [
  '[data-slot="button"]', '[data-slot="input"]', '[data-slot="select-trigger"]',
  '[data-slot="dialog-content"]', '[data-slot="sheet-content"]',
  '[data-slot="dropdown-menu-content"]', '[data-slot="alert"]', '[data-slot="table"]',
  '[data-slot="skeleton"]', '[data-slot="progress"]',
] as const;

test.describe('Accessibility - critical mocked e2e (WCAG AA)', () => {
  test('institutional shell reports no color contrast violations', async ({ page }, testInfo) => {
    await installAccessibilityMocks(page, { authenticated: true });
    await page.goto('/dashboard');
    await waitForScreen(page, /continuar operaci.n/i);

    await expect(await shellContrastViolations(page), 'institutional shell contrast details').toEqual([]);
    await expectShellAxeReport(page, 'shell-normal-light', testInfo);
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
        await expect(await shellContrastViolations(page), `${color} ${mode} shell contrast details`).toEqual([]);
        await expectShellAxeReport(page, `shell-brand-${color}-${mode}`, testInfo);
        if (color === 'teal') {
          await testInfo.attach(`shell-teal-${mode}`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: 'image/png',
          });
        }
      }
    }
  });

  test('real shell overlays remain accessible, modern and keyboard operable', async ({ page }, testInfo) => {
    await installAccessibilityMocks(page, { authenticated: true });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/dashboard');
    await waitForScreen(page, /continuar operaci.n/i);

    const rail = page.locator('[data-testid="institutional-rail"], [data-testid="clinical-rail"]');
    await expect(rail).toHaveAttribute('data-collapsed', 'false');
    await expectModernSurface(rail);

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
    await expectShellAxeReport(page, 'shell-sidebar-collapsed', testInfo);

    const userMenuButton = page.getByRole('button', { name: /abrir men. de usuario/i });
    await userMenuButton.click();
    const userMenu = page.getByRole('menu');
    await expect(userMenu).toBeVisible();
    await expectModernSurface(page.locator('[data-slot="dropdown-menu-content"]'));
    await expectShellAxeReport(page, 'shell-user-menu-open', testInfo, false, '[data-slot="dropdown-menu-content"]');
    await page.keyboard.press('Escape');
    await expect(userMenuButton).toBeFocused();

    const commandButton = page.getByRole('button', { name: 'Abrir comandos' });
    await commandButton.click();
    const commandDialog = page.getByRole('dialog', { name: 'Comandos' });
    await expect(commandDialog).toBeVisible();
    await expectModernSurface(commandDialog);
    await expectShellAxeReport(page, 'shell-command-palette-open', testInfo, false, '[data-slot="dialog-content"]');
    await page.keyboard.press('Escape');
    await expect(commandButton).toBeFocused();

    await page.keyboard.press('?');
    const shortcutsDialog = page.getByRole('dialog', { name: /atajos de teclado/i });
    await expect(shortcutsDialog).toBeVisible();
    await expectModernSurface(shortcutsDialog);
    await expectShellAxeReport(page, 'shell-shortcuts-open', testInfo, false, '[data-slot="dialog-content"]');
    await page.keyboard.press('Escape');
    await expect(commandButton).toBeFocused();

    const helpButton = page.getByRole('button', { name: /abrir ayuda/i });
    await helpButton.click();
    const guideDialog = page.getByRole('dialog', { name: /gu.a r.pida del sistema/i });
    await expect(guideDialog).toBeVisible();
    await expectModernSurface(guideDialog);
    await expectModernSurface(page.getByTestId('guided-tour-step'));
    await expectShellAxeReport(page, 'shell-guided-tour-open', testInfo, false, '[data-slot="dialog-content"]');
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
      await expectShellAxeReport(page, `shell-${viewport.width}x${viewport.height}-zoom-${viewport.zoom}`, testInfo);
      await testInfo.attach(`shell-${viewport.width}x${viewport.height}-zoom-${viewport.zoom}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      if (viewport.width === 390) {
        const moreButton = page.getByRole('button', { name: 'Más destinos' });
        await moreButton.click();
        const drawer = page.getByRole('dialog', { name: 'Más destinos' });
        await expect(drawer).toBeVisible();
        await expectModernSurface(drawer);
        await expectShellAxeReport(page, 'shell-mobile-navigation-open', testInfo, false, '[data-slot="sheet-content"]');
        await testInfo.attach('shell-mobile-navigation-open', {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        });
        await page.keyboard.press('Escape');
        await expect(moreButton).toBeFocused();
      }
    }
  });

  test('required hospital viewports and zoom-equivalent CSS widths reflow without page overflow', async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    await installAccessibilityMocks(page, { authenticated: true });

    const requiredViewports = [
      { id: '1920x1080', width: 1920, height: 1080 },
      { id: '1600x900', width: 1600, height: 900 },
      { id: '1366x768', width: 1366, height: 768 },
      { id: '1280x720', width: 1280, height: 720 },
      { id: '1024x768', width: 1024, height: 768 },
      { id: '768x1024', width: 768, height: 1024 },
      { id: '390x844', width: 390, height: 844 },
      { id: 'zoom-125-equivalent', width: 1024, height: 576 },
      { id: 'zoom-200-equivalent', width: 640, height: 360 },
      { id: 'reflow-320-css-px', width: 320, height: 720 },
    ] as const;

    for (const viewport of requiredViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/dashboard');
      await waitForScreen(page, /continuar operaci.n/i);

      const geometry = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(geometry.scrollWidth, `${viewport.id} page overflow`).toBeLessThanOrEqual(geometry.clientWidth + 1);
      await expectShellAxeReport(page, `required-${viewport.id}`, testInfo);
      await testInfo.attach(`required-${viewport.id}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
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

  test('critical protected routes satisfy the complete visual and axe matrix', async ({ page }, testInfo) => {
    test.setTimeout(1_200_000);
    await installAccessibilityMocks(page, { authenticated: true });
    const requestedRoutes = process.env.A11Y_ROUTES?.split(',').map((route) => route.trim()).filter(Boolean);
    const requestedMatrices = process.env.A11Y_MATRICES?.split(',').map((matrix) => matrix.trim()).filter(Boolean);
    const selectedRoutes = requestedRoutes?.length
      ? routeExpectations.filter((route) => requestedRoutes.includes(route.path))
      : routeExpectations;
    const selectedMatrices = requestedMatrices?.length
      ? visualMatrix.filter((matrix) => requestedMatrices.includes(matrix.id))
      : visualMatrix;
    expect(selectedRoutes.length, 'A11Y_ROUTES must select at least one known route').toBeGreaterThan(0);
    expect(selectedMatrices.length, 'A11Y_MATRICES must select at least one known matrix').toBeGreaterThan(0);
    const unclassifiedIncomplete: Array<{ route: string; details: unknown[] }> = [];
    const routeViolations: Array<{ route: string; details: unknown[] }> = [];
    const unnamedControls: Array<{ route: string; details: unknown[] }> = [];
    const overflowFailures: Array<{ route: string; matrix: string; metrics: unknown }> = [];
    const radiusFailures: Array<{ route: string; matrix: string; details: unknown[] }> = [];
    const radiusCoverage = Object.fromEntries(modernSurfaceSelectors.map((selector) => [selector, 0]));
    const evidenceRoot = resolve(process.env.A11Y_EVIDENCE_ROOT ?? 'test-results/frontend-final');
    const screenshotDirectory = resolve(evidenceRoot, 'screenshots');
    const accessibilityDirectory = resolve(evidenceRoot, 'accessibility');
    if (process.env.A11Y_PRESERVE_OUTPUT !== '1') {
      rmSync(screenshotDirectory, { force: true, recursive: true });
      rmSync(accessibilityDirectory, { force: true, recursive: true });
    }
    mkdirSync(screenshotDirectory, { recursive: true });
    mkdirSync(accessibilityDirectory, { recursive: true });

    for (const matrix of selectedMatrices) {
      await page.setViewportSize({ width: matrix.width, height: matrix.height });
      await page.goto(selectedRoutes[0].path);
      await page.evaluate((mode) => {
        localStorage.setItem('hospital-billing-theme', mode);
      }, matrix.mode);

      for (const route of selectedRoutes) {
        await page.goto(route.path);
        await waitForScreen(page, route.heading);
        if (matrix.zoom !== 1) {
          await page.evaluate((zoom) => { document.documentElement.style.zoom = String(zoom); }, matrix.zoom);
        }

        const state = `${route.path.replaceAll('/', '-').replace(/^-/, '') || 'root'}-${matrix.id}`;
        await expect(page.getByRole('main'), `${state} main landmark`).toBeVisible();
        await expect(page.getByRole('heading', { level: 1 }), `${state} h1 count`).toHaveCount(1);
        const routeUnnamedControls = await visibleUnnamedControls(page);
        if (routeUnnamedControls.length > 0) unnamedControls.push({ route: state, details: routeUnnamedControls });
        const overflow = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        if (overflow.scrollWidth > overflow.clientWidth + 1) {
          overflowFailures.push({ route: route.path, matrix: matrix.id, metrics: overflow });
        }
        const surfaceGeometry = await page.evaluate((selectors) => selectors.flatMap((selector) => (
          Array.from(document.querySelectorAll(selector)).flatMap((element) => {
            const rect = element.getBoundingClientRect();
            const style = getComputedStyle(element);
            if (rect.width <= 0 || rect.height <= 0 || style.visibility === 'hidden' || style.display === 'none') return [];
            return [{
              selector,
              radii: [
                style.borderTopLeftRadius,
                style.borderTopRightRadius,
                style.borderBottomLeftRadius,
                style.borderBottomRightRadius,
              ],
              html: element.outerHTML.slice(0, 500),
            }];
          })
        )), modernSurfaceSelectors);
        for (const surface of surfaceGeometry) radiusCoverage[surface.selector] += 1;
        const invalidSurfaces = surfaceGeometry.filter((surface) => surface.radii.some((radius) => Number.parseFloat(radius) > 16));
        if (invalidSurfaces.length > 0) {
          radiusFailures.push({ route: route.path, matrix: matrix.id, details: invalidSurfaces });
        }
        const routeReport = await expectShellAxeReport(page, state, testInfo, true);
        writeFileSync(
          resolve(accessibilityDirectory, `${state}.json`),
          `${JSON.stringify({ route: route.path, matrix, surfaceGeometry, ...routeReport }, null, 2)}\n`,
          'utf8',
        );
        if (routeReport.violations.length > 0) {
          routeViolations.push({ route: state, details: routeReport.violations });
        }
        if (routeReport.unclassifiedIncomplete.length > 0) {
          unclassifiedIncomplete.push({ route: state, details: routeReport.unclassifiedIncomplete });
        }
        await page.screenshot({
          fullPage: true,
          path: resolve(screenshotDirectory, `${state}.png`),
        });
      }
    }
    await testInfo.attach('border-radius-coverage', {
      body: Buffer.from(JSON.stringify(radiusCoverage, null, 2)),
      contentType: 'application/json',
    });
    console.log(`[modern-surface-coverage] ${JSON.stringify(radiusCoverage)}`);
    expect(overflowFailures, 'horizontal overflow by route and matrix').toEqual([]);
    expect(radiusFailures, 'visible surfaces outside the institutional radius scale').toEqual([]);
    expect(unnamedControls, 'unnamed controls by route').toEqual([]);
    expect(routeViolations, 'axe violations by route').toEqual([]);
    expect(unclassifiedIncomplete, 'unclassified axe incomplete results by route').toEqual([]);
  });

  test('E2 routes keep runtime accessibility findings closed', async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await installAccessibilityMocks(page, { authenticated: true });
    const paths = new Set(['/billing/new', '/cashbox', '/catalog', '/invoices', '/reports/executive', '/about']);

    for (const route of routeExpectations.filter((item) => paths.has(item.path))) {
      await page.goto(route.path);
      await waitForScreen(page, route.heading);
      await expect(await visibleUnnamedControls(page), `${route.path} unnamed controls`).toEqual([]);
      await expectShellAxeReport(page, `e2-${route.path.replaceAll('/', '-')}`, testInfo);
    }
  });
});

test.describe('Accessibility - authentication visual matrix', () => {
  test('login matrix', async ({ page }, testInfo) => {
    rmSync(resolve('test-results/frontend-final/auth'), { force: true, recursive: true });
    await installAccessibilityMocks(page, { authenticated: false });
    await runAuthenticationMatrix(page, testInfo, {
      id: 'login',
      navigatePath: '/login',
      heading: /iniciar sesi.n/i,
    });
  });

  test('required password change matrix', async ({ page }, testInfo) => {
    await installAccessibilityMocks(page, { authenticated: true, user: passwordChangeUser });
    await runAuthenticationMatrix(page, testInfo, {
      id: 'password-change',
      navigatePath: '/',
      heading: /cambio obligatorio de contrase/i,
    });
  });

  test('expired session matrix', async ({ page }, testInfo) => {
    await installAccessibilityMocks(page, { authenticated: true, expireSession: true });
    await runAuthenticationMatrix(page, testInfo, {
      id: 'session-expired',
      navigatePath: '/dashboard',
      heading: /iniciar sesi.n/i,
      status: /sesi.n (?:vencida|cerrada por el servidor)/i,
    });
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

async function shellAxeReport(page: Page, contextSelector?: string) {
  await page.addScriptTag({ content: axeCore.source });
  return page.evaluate(async (selector) => {
    const context = selector ? document.querySelector(selector) : document;
    const result = await window.axe.run(context ?? document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
      },
    });
    const parseRgb = (value: string) => {
      if (!/^rgba?\(/i.test(value.trim())) return null;
      const channels = value.match(/[\d.]+/g)?.slice(0, 4).map(Number);
      if (!channels || channels.length < 3) return null;
      return { red: channels[0], green: channels[1], blue: channels[2], alpha: channels[3] ?? 1 };
    };
    const relativeLuminance = ({ red, green, blue }: { red: number; green: number; blue: number }) => {
      const channels = [red, green, blue].map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const effectiveContrast = (element: Element | null, foreground: string) => {
      let ancestor = element;
      let background = '';
      while (ancestor) {
        const candidate = getComputedStyle(ancestor).backgroundColor;
        const parsed = parseRgb(candidate);
        if (parsed && parsed.alpha > 0.99) {
          background = candidate;
          break;
        }
        ancestor = ancestor.parentElement;
      }
      const foregroundRgb = parseRgb(foreground);
      const backgroundRgb = parseRgb(background);
      if (!foregroundRgb || !backgroundRgb) return { background, ratio: null };
      const foregroundLuminance = relativeLuminance(foregroundRgb);
      const backgroundLuminance = relativeLuminance(backgroundRgb);
      const ratio = (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
        / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
      return { background, ratio: Number(ratio.toFixed(2)) };
    };
    const impacts = { minor: 0, moderate: 0, serious: 0, critical: 0 };
    for (const violation of result.violations) {
      const impact = String(violation.impact) as keyof typeof impacts;
      if (impact in impacts) impacts[impact] += 1;
    }
    return {
      impacts,
      incomplete: result.incomplete.length,
      violations: result.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.slice(0, 5).map((node) => {
          const element = document.querySelector(node.target.join(' '));
          const computed = element ? getComputedStyle(element) : null;
          return {
            target: node.target,
            failure: node.failureSummary,
            html: node.html,
            computed: computed ? {
              backgroundColor: computed.backgroundColor,
              color: computed.color,
              display: computed.display,
              opacity: computed.opacity,
              visibility: computed.visibility,
            } : null,
            insideChart: Boolean(element?.closest('[data-chart]')),
            chartHasAlternativeTable: Boolean(element?.closest('figure')?.querySelector('table')),
          };
        }),
      })),
      incompleteDetails: result.incomplete.map((entry) => ({
        id: entry.id,
        impact: entry.impact,
        help: entry.help,
        nodes: entry.nodes.slice(0, 5).map((node) => {
          const element = document.querySelector(node.target.join(' '));
          const computed = element ? getComputedStyle(element) : null;
          const contrast = effectiveContrast(element, computed?.color ?? '');
          return {
            target: node.target,
            failure: node.failureSummary,
            html: node.html,
            computed: computed ? {
              backgroundColor: computed.backgroundColor,
              effectiveBackgroundColor: contrast.background,
              contrastRatio: contrast.ratio,
              color: computed.color,
              display: computed.display,
              opacity: computed.opacity,
              visibility: computed.visibility,
            } : null,
            insideChart: Boolean(element?.closest('[data-chart]')),
            chartHasAlternativeTable: Boolean(element?.closest('figure')?.querySelector('table')),
          };
        }),
      })),
    };
  }, contextSelector);
}

async function expectShellAxeReport(page: Page, state: string, testInfo: TestInfo, deferUnclassified = false, contextSelector?: string) {
  const report = await shellAxeReport(page, contextSelector);
  const incompleteClassification = report.incompleteDetails.flatMap((entry) => entry.nodes.map((node) => {
    const isOverlapContrastProbe = entry.id === 'color-contrast'
      && /background color could not be determined because (?:it(?: is|'s)?\s+)?(?:partially )?(?:obscured|overlapped|overlaps?)/i.test(node.failure ?? '');
    const isVerifiedOverlapContrast = isOverlapContrastProbe
      && typeof node.computed?.contrastRatio === 'number'
      && node.computed.contrastRatio >= 4.5;
    const isPseudoElementProbe = entry.id === 'color-contrast' && /due to a pseudo element/i.test(node.failure ?? '');
    const isShortDataProbe = entry.id === 'color-contrast' && /content is too short to determine/i.test(node.failure ?? '');
    const isAccessibleChartProbe = entry.id === 'color-contrast'
      && node.insideChart
      && node.chartHasAlternativeTable
      && /contains an image node/i.test(node.failure ?? '');
    const hasVerifiedContrast = typeof node.computed?.contrastRatio === 'number'
      && node.computed.contrastRatio >= 4.5;
    const classifiedManually = isAccessibleChartProbe
      || isVerifiedOverlapContrast
      || ((isPseudoElementProbe || isShortDataProbe) && hasVerifiedContrast);
    return {
      id: entry.id,
      selector: node.target,
      computed: node.computed,
      html: node.html,
      classification: classifiedManually ? 'manual-false-positive' : 'unclassified',
      analysis: classifiedManually
        ? isAccessibleChartProbe
          ? 'Axe no calcula contraste dentro del SVG de Recharts; el contenedor expone un nombre accesible y la tabla HTML contigua conserva todos los valores exactos.'
          : isVerifiedOverlapContrast
          ? `Contraste manual ${node.computed?.contrastRatio}:1 calculado entre ${node.computed?.color} y el ancestro opaco ${node.computed?.effectiveBackgroundColor}; cumple 4.5:1.`
          : isShortDataProbe
          ? 'El nodo es un valor numérico visible y significativo; Axe lo deja incompleto únicamente por la longitud del contenido.'
          : 'Axe no puede resolver el fondo por superposición o pseudo-elemento; la comprobación computed-style shellContrastViolations valida el contraste efectivo del mismo estado.'
        : node.failure,
    };
  }));
  await testInfo.attach(`${state}-axe`, {
    body: Buffer.from(JSON.stringify({ state, ...report, incompleteClassification }, null, 2)),
    contentType: 'application/json',
  });
  console.log(`[axe-shell] ${state} ${JSON.stringify({ ...report.impacts, incomplete: report.incomplete })}`);
  if (report.incompleteDetails.length > 0) {
    console.log(`[axe-shell-incomplete] ${state} ${JSON.stringify(report.incompleteDetails)}`);
  }
  if (!deferUnclassified) {
    await expect(report.violations, `${state} axe violations`).toEqual([]);
  }
  const unclassifiedIncomplete = incompleteClassification.filter((item) => item.classification === 'unclassified');
  if (!deferUnclassified) {
    await expect(unclassifiedIncomplete, `${state} unclassified axe incomplete results`).toEqual([]);
  }
  return { ...report, incompleteClassification, unclassifiedIncomplete };
}

async function expectModernSurface(locator: ReturnType<Page['locator']>) {
  await expect(locator).toBeVisible();
  const style = await locator.evaluate((element) => {
    const computed = window.getComputedStyle(element);
    return {
      borderTopLeftRadius: computed.borderTopLeftRadius,
      borderTopRightRadius: computed.borderTopRightRadius,
      borderBottomLeftRadius: computed.borderBottomLeftRadius,
      borderBottomRightRadius: computed.borderBottomRightRadius,
      backgroundImage: computed.backgroundImage,
    };
  });
  expect(style.backgroundImage).toBe('none');
  expect([
    style.borderTopLeftRadius,
    style.borderTopRightRadius,
    style.borderBottomLeftRadius,
    style.borderBottomRightRadius,
  ].every((radius) => Number.parseFloat(radius) <= 16)).toBe(true);
}

async function runAuthenticationMatrix(
  page: Page,
  testInfo: TestInfo,
  state: { id: string; navigatePath: string; heading: RegExp; status?: RegExp },
) {
  test.setTimeout(300_000);
  const artifactDirectory = resolve('test-results/frontend-final/auth');
  mkdirSync(artifactDirectory, { recursive: true });
  const failures = {
    overflow: [] as unknown[],
    radius: [] as unknown[],
    unnamed: [] as unknown[],
    violations: [] as unknown[],
    unclassified: [] as unknown[],
  };

  for (const matrix of visualMatrix) {
    await page.setViewportSize({ width: matrix.width, height: matrix.height });
    await page.goto(state.navigatePath);
    await page.evaluate((mode) => localStorage.setItem('hospital-billing-theme', mode), matrix.mode);
    await page.goto(state.navigatePath);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: state.heading })).toHaveCount(1);
    if (state.status) await expect(page.getByText(state.status).first()).toBeVisible();
    if (matrix.zoom !== 1) {
      await page.evaluate((zoom) => { document.documentElement.style.zoom = String(zoom); }, matrix.zoom);
    }
    const artifact = `${state.id}-${matrix.id}`;
    const unnamed = await visibleUnnamedControls(page);
    if (unnamed.length > 0) failures.unnamed.push({ artifact, unnamed });
    const overflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    if (overflow.scrollWidth > overflow.clientWidth + 1) failures.overflow.push({ artifact, overflow });
    const surfaceGeometry = await page.evaluate((selectors) => selectors.flatMap((selector) => (
      Array.from(document.querySelectorAll(selector)).flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (rect.width <= 0 || rect.height <= 0 || style.visibility === 'hidden' || style.display === 'none') return [];
        return [{
          selector,
          radii: [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius],
          html: element.outerHTML.slice(0, 500),
        }];
      })
    )), modernSurfaceSelectors);
    const invalidSurfaces = surfaceGeometry.filter((surface) => surface.radii.some((radius) => Number.parseFloat(radius) > 16));
    if (invalidSurfaces.length > 0) failures.radius.push({ artifact, invalidSurfaces });
    const axe = await expectShellAxeReport(page, artifact, testInfo, true);
    if (axe.violations.length > 0) failures.violations.push({ artifact, violations: axe.violations });
    if (axe.unclassifiedIncomplete.length > 0) failures.unclassified.push({ artifact, incomplete: axe.unclassifiedIncomplete });
    writeFileSync(
      resolve(artifactDirectory, `${artifact}.json`),
      `${JSON.stringify({ state: state.id, matrix, overflow, surfaceGeometry, ...axe }, null, 2)}\n`,
      'utf8',
    );
    await page.screenshot({ fullPage: true, path: resolve(artifactDirectory, `${artifact}.png`) });
  }

  expect(failures.overflow, `${state.id} horizontal overflow`).toEqual([]);
  expect(failures.radius, `${state.id} radii outside the institutional scale`).toEqual([]);
  expect(failures.unnamed, `${state.id} unnamed controls`).toEqual([]);
  expect(failures.violations, `${state.id} axe violations`).toEqual([]);
  expect(failures.unclassified, `${state.id} unclassified axe incomplete`).toEqual([]);
}

async function installAccessibilityMocks(
  page: Page,
  options: { authenticated: boolean; user?: typeof adminUser; expireSession?: boolean },
) {
  let authenticated = options.authenticated;
  const sessionUser = options.user ?? adminUser;

  await page.route('**/favicon.ico', (route) => route.fulfill({ status: 204 }));
  await page.route('**/sanctum/csrf-cookie', (route) => route.fulfill({ status: 204 }));
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();

    if (path === '/api/auth/login' && method === 'POST') {
      authenticated = true;
      return json(route, { data: sessionUser });
    }
    if (path === '/api/auth/logout') {
      authenticated = false;
      return json(route, { ok: true });
    }
    if (path === '/api/auth/session' || path === '/api/auth/me') {
      return authenticated ? json(route, { data: sessionUser }) : json(route, { data: null });
    }
    if (path === '/api/settings/branding' || path === '/api/public/branding') {
      return json(route, { data: branding() });
    }
    if (path === '/api/settings/logo') {
      return route.fulfill({ status: 200, contentType: 'image/png', body: '' });
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
      if (options.expireSession) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'X-Force-Logout': '1' },
          body: JSON.stringify({ data: cashSession }),
        });
      }
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
