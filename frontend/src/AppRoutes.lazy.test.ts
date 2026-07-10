import { createElement, type ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppRoutes } from './AppRoutes';

const appRoutesProps: ComponentProps<typeof AppRoutes> = {
  canCreateInvoices: false,
  canCreatePayments: false,
  canEditFiscalSettings: false,
  canEditOperationalSettings: false,
  canManageCatalog: false,
  canOpenCash: false,
  canCloseAnyCash: false,
  canCloseCash: false,
  canViewBackups: false,
  canViewCash: false,
  canViewCatalog: false,
  canViewReceipts: false,
  canViewFiscalSettings: false,
  canViewInvoices: false,
  canViewReports: false,
  canViewManagerialReports: false,
  canViewCashSessionReports: false,
  canViewAuditReports: false,
  canExportReports: false,
  canViewUsers: false,
  canCreateUsers: false,
  canUpdateUsers: false,
  canDisableUsers: false,
  canManageRoles: false,
  canMarkDialysisPrescription: false,
  cashSession: null,
  defaultAuthenticatedRoute: '/dashboard',
  onQuickCash: () => undefined,
  onStatus: () => undefined,
  user: {
    id: 1,
    name: 'Cajero',
    email: 'cajero@hospital.local',
    username: 'cajero',
    active: true,
    roles: ['cajero'],
    permissions: [],
    must_change_password: false,
  },
};

/**
 * Smoke test that guarantees the heavy routes stay lazy-loaded so the
 * cashier can land on /login and reach /dashboard without pulling the
 * Reports, Backups, Fiscal Settings or Invoice History chunks.
 */
describe('AppRoutes lazy-loading', () => {
  it('defines the heavy views through React.lazy', () => {
    const source = readFileSync(
      resolve(__dirname, 'AppRoutes.tsx'),
      'utf8',
    );

    const heavyRoutes = [
      'AboutView',
      'BackupsView',
      'CatalogView',
      'DashboardView',
      'FiscalSettingsView',
      'HelpView',
      'InstitutionalReceiptSettingsView',
      'InvoiceHistoryView',
      'ReportsView',
      'UsersView',
    ];

    for (const view of heavyRoutes) {
      const lazyBinding = source.match(new RegExp(`lazy\\(\\(\\) => import\\([^)]*${view}[^)]*\\)`));
      expect(lazyBinding, `Expected ${view} to be lazy-loaded`).not.toBeNull();
    }
  });

  it('wraps the Routes in a Suspense fallback so the cashier never sees a blank screen', () => {
    const source = readFileSync(
      resolve(__dirname, 'AppRoutes.tsx'),
      'utf8',
    );

    expect(source).toMatch(/Suspense[^>]*fallback=/);
  });

  it('propaga capacidades de setup distintas al Dashboard', () => {
    const source = readFileSync(resolve(__dirname, 'AppRoutes.tsx'), 'utf8');

    expect(source).toContain('canEditFiscalSettings={canEditFiscalSettings}');
    expect(source).toContain('canManageCatalog={canManageCatalog}');
  });

  it('propaga identidad y capacidades de facturas a caja y caja rápida', () => {
    const routesSource = readFileSync(resolve(__dirname, 'AppRoutes.tsx'), 'utf8');
    const appSource = readFileSync(resolve(__dirname, 'App.tsx'), 'utf8');

    expect(routesSource).toContain('canCreateInvoices={canAccessRoute(appRoutes.newInvoice, user.permissions)}');
    expect(routesSource).toContain('canViewInvoices={canViewInvoices}');
    expect(routesSource).toContain('currentUserId={user.id}');
    expect(appSource).toContain('canCreateInvoices={canAccessRoute(appRoutes.newInvoice, session.user.permissions)}');
    expect(appSource).toContain('canViewInvoices={session.canViewInvoices}');
    expect(appSource).toContain('currentUserId={session.user.id}');
  });

  it('resuelve el wildcard al montar AppRoutes completo y conserva navegación a Inicio', () => {
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ['/ruta/desconocida'] },
        createElement(AppRoutes, appRoutesProps),
      ),
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Ruta no encontrada' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/dashboard');
  });
});
