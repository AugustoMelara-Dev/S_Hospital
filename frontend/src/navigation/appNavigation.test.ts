import { describe, expect, it } from 'vitest';
import {
  appRoutes,
  canAccessRoute,
  getBreadcrumbs,
  getVisibleNavigation,
  primaryNavigation,
} from './appNavigation';

describe('appNavigation', () => {
  it('keeps navigation paths unique and institutional', () => {
    const paths = primaryNavigation.map((item) => item.path);
    const labels = primaryNavigation.map((item) => item.label);

    expect(new Set(paths).size).toBe(paths.length);
    expect(labels).toEqual([
      'Inicio',
      'Nueva factura',
      'Caja',
      'Catalogo',
      'Historial',
      'Reportes',
      'Respaldos',
      'Configuracion',
      'Usuarios',
      'Ayuda',
      'Acerca de',
    ]);
    expect(labels.every((label) => label.length > 0)).toBe(true);
  });

  it('uses the route registry as the breadcrumb source of truth', () => {
    expect(getBreadcrumbs('/dashboard')).toEqual([{ label: 'Inicio', path: '/dashboard' }]);
    expect(getBreadcrumbs('/billing/new')).toEqual([
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Nueva factura', path: '/billing/new' },
    ]);
    expect(getBreadcrumbs('/settings/fiscal')).toEqual([
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Configuracion', path: '/settings/fiscal' },
    ]);
    expect(getBreadcrumbs('/admin/users')).toEqual([
      { label: 'Inicio', path: '/dashboard' },
      { label: 'Usuarios', path: '/admin/users' },
    ]);
  });

  it('distinguishes navigation visibility from route access contracts', () => {
    expect(getVisibleNavigation(['invoices.create']).map((item) => item.path)).toContain('/billing/new');
    expect(canAccessRoute(appRoutes.newInvoice, ['invoices.create'])).toBe(false);
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
  });
});
