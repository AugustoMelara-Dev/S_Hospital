import { describe, expect, it } from 'vitest';
import {
  appRoutes,
  canAccessRoute,
  getBreadcrumbs,
  getVisibleNavigation,
  primaryNavigation,
} from './appNavigation';

describe('appNavigation', () => {
  it('keeps the final billing-only navigation exact and unique', () => {
    const paths = primaryNavigation.map((item) => item.path);
    const labels = primaryNavigation.map((item) => item.label);

    expect(new Set(paths).size).toBe(paths.length);
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
});
