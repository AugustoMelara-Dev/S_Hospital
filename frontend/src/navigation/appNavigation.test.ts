import { describe, expect, it } from 'vitest';
import {
  appRoutes,
  canAccessRoute,
  canAccessPath,
  getBreadcrumbs,
  getVisibleNavigation,
  primaryNavigation,
} from './appNavigation';

describe('appNavigation', () => {
  it('keeps the final billing-only navigation exact and unique', () => {
    const paths = primaryNavigation.map((item) => item.path);
    const labels = primaryNavigation.map((item) => item.label);
    const permissionMetadata = primaryNavigation.map((item) => ({
      path: item.path,
      group: item.navigationGroup,
      permissions: item.navigationPermissions ?? [],
      mode: item.navigationPermissionMode ?? 'any',
    }));

    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual([
      '/dashboard',
      '/billing/new',
      '/cashbox',
      '/catalog',
      '/invoices',
      '/reports',
      '/backups',
      '/settings/fiscal',
      '/settings/institutional-receipts',
      '/admin/users',
      '/help',
    ]);
    expect(labels).toEqual([
      'Inicio',
      'Nueva factura',
      'Caja',
      'Catálogo',
      'Historial',
      'Reportes',
      'Respaldos',
      'Configuración',
      'Recibos',
      'Usuarios',
      'Ayuda',
    ]);
    expect(permissionMetadata).toEqual([
      { path: '/dashboard', group: 'operations', permissions: [], mode: 'any' },
      { path: '/billing/new', group: 'operations', permissions: ['invoices.create', 'catalog.view', 'cash.view', 'payments.create', 'receipts.view'], mode: 'all' },
      { path: '/cashbox', group: 'operations', permissions: ['cash.view'], mode: 'any' },
      { path: '/catalog', group: 'operations', permissions: ['catalog.view'], mode: 'any' },
      { path: '/invoices', group: 'operations', permissions: ['invoices.view'], mode: 'any' },
      { path: '/reports', group: 'operations', permissions: ['reports.managerial.view', 'reports.cash_session.view', 'audit.view'], mode: 'any' },
      { path: '/backups', group: 'administration', permissions: ['backups.view'], mode: 'any' },
      { path: '/settings/fiscal', group: 'administration', permissions: ['settings.fiscal.view', 'settings.operational.update'], mode: 'any' },
      { path: '/settings/institutional-receipts', group: 'administration', permissions: ['receipt_settings.view'], mode: 'any' },
      { path: '/admin/users', group: 'administration', permissions: ['users.view'], mode: 'any' },
      { path: '/help', group: 'support', permissions: [], mode: 'any' },
    ]);
  });

  it('uses the route registry as the breadcrumb source of truth', () => {
    expect(getBreadcrumbs('/dashboard')).toEqual([{ label: 'Inicio', path: '/dashboard' }]);
    expect(getBreadcrumbs('/billing/new')).toEqual([
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Nueva factura', path: '/billing/new' },
    ]);
    expect(getBreadcrumbs('/settings/fiscal')).toEqual([
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Configuración', path: '/settings/fiscal' },
    ]);
    expect(getBreadcrumbs('/settings/institutional-receipts')).toEqual([
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Recibos institucionales', path: '/settings/institutional-receipts' },
    ]);
    expect(getBreadcrumbs('/admin/users')).toEqual([
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Usuarios', path: '/admin/users' },
    ]);
  });

  it('requires complete operational permissions for the new invoice navigation and route', () => {
    expect(getVisibleNavigation(['invoices.create']).map((item) => item.path)).not.toContain('/billing/new');
    expect(canAccessRoute(appRoutes.newInvoice, ['invoices.create'])).toBe(false);
    expect(
      getVisibleNavigation([
        'invoices.create',
        'catalog.view',
        'cash.view',
        'payments.create',
        'receipts.view',
      ]).map((item) => item.path),
    ).toContain('/billing/new');
    expect(
      canAccessRoute(appRoutes.newInvoice, [
        'invoices.create',
        'catalog.view',
        'cash.view',
        'payments.create',
        'receipts.view',
      ]),
    ).toBe(true);
    expect(canAccessRoute(appRoutes.reports, ['reports.cash_session.view'])).toBe(true);
    expect(canAccessRoute(appRoutes.reports, ['reports.managerial.view'])).toBe(true);
    expect(canAccessRoute(appRoutes.receiptSettings, ['receipt_settings.view'])).toBe(true);
  });

  it('does not expose report routes for generic reports.view without a concrete report permission', () => {
    const visiblePaths = getVisibleNavigation(['reports.view']).map((item) => item.path);

    expect(visiblePaths).not.toContain('/reports');
    expect(canAccessRoute(appRoutes.reports, ['reports.view'])).toBe(false);
    expect(canAccessPath('/reports', ['reports.view'])).toBe(false);
    expect(canAccessRoute(appRoutes.reports, ['reports.cash_session.view'])).toBe(true);
    expect(canAccessRoute(appRoutes.reports, ['reports.managerial.view'])).toBe(true);
    expect(canAccessRoute(appRoutes.reports, ['audit.view'])).toBe(true);
  });

  it('lets operational settings editors reach the configuration route without fiscal write access', () => {
    const operationalEditorPaths = getVisibleNavigation(['settings.operational.update']).map((item) => item.path);

    expect(operationalEditorPaths).toContain('/settings/fiscal');
    expect(canAccessRoute(appRoutes.fiscalSettings, ['settings.operational.update'])).toBe(true);
    expect(canAccessPath('/settings/fiscal', ['settings.operational.update'])).toBe(true);
  });

  it('preserves visible routes by operational profile', () => {
    const cashierPaths = getVisibleNavigation([
      'catalog.view',
      'cash.view',
      'invoices.create',
      'invoices.view',
      'payments.create',
      'receipts.view',
    ]).map((item) => item.path);

    expect(cashierPaths).toEqual([
      '/dashboard',
      '/billing/new',
      '/cashbox',
      '/catalog',
      '/invoices',
      '/help',
    ]);
    expect(canAccessPath('/billing/new', ['invoices.create'])).toBe(false);
    expect(canAccessPath('/billing/new', ['invoices.create', 'catalog.view', 'cash.view', 'payments.create', 'receipts.view'])).toBe(true);
    expect(canAccessPath('/does-not-exist', [])).toBe(false);
  });
});
