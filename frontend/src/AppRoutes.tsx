import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PermissionGate } from './components/PermissionGate';
import { RouteState } from './design-system/patterns/RouteState';
import { type AuthUser, type CashSession } from './lib/api';
import { appRoutes, canAccessRoute } from './navigation/appNavigation';
import type { OperationalStatusReporter } from './app/operationalStatus';

const AboutView = lazy(() => import('./features/about/AboutView').then((module) => ({ default: module.AboutView })));
const BackupsView = lazy(() => import('./features/backups/BackupsView').then((module) => ({ default: module.BackupsView })));
const CatalogView = lazy(() => import('./features/catalog/CatalogView').then((module) => ({ default: module.CatalogView })));
const DashboardView = lazy(() => import('./features/dashboard/DashboardView').then((module) => ({ default: module.DashboardView })));
const FiscalSettingsView = lazy(() => import('./features/settings/FiscalSettingsView').then((module) => ({ default: module.FiscalSettingsView })));
const HelpView = lazy(() => import('./features/help/HelpView').then((module) => ({ default: module.HelpView })));
const InstitutionalReceiptSettingsView = lazy(() => import('./features/receipt-settings/InstitutionalReceiptSettingsView').then((module) => ({ default: module.InstitutionalReceiptSettingsView })));
const InvoiceHistoryView = lazy(() => import('./features/invoices/InvoiceHistoryView').then((module) => ({ default: module.InvoiceHistoryView })));
const NewInvoiceView = lazy(() => import('./features/invoices/NewInvoiceView').then((module) => ({ default: module.NewInvoiceView })));
const ReportsView = lazy(() => import('./features/reports/ReportsView').then((module) => ({ default: module.ReportsView })));
const SupportCenterView = lazy(() => import('./features/support/SupportCenterView').then((module) => ({ default: module.SupportCenterView })));
const UsersView = lazy(() => import('./features/admin/UsersView').then((module) => ({ default: module.UsersView })));
const CashBoxView = lazy(() => import('./features/cash/CashBoxView').then((module) => ({ default: module.CashBoxView })));

type AppRoutesProps = {
  canCreateInvoices: boolean;
  canCreatePayments: boolean;
  canEditFiscalSettings: boolean;
  canEditOperationalSettings: boolean;
  canManageCatalog: boolean;
  canOpenCash: boolean;
  canCloseAnyCash: boolean;
  canCloseCash: boolean;
  canViewBackups: boolean;
  canViewCash: boolean;
  canViewCatalog: boolean;
  canViewReceipts: boolean;
  canViewFiscalSettings: boolean;
  canViewInvoices: boolean;
  canViewReports: boolean;
  canViewManagerialReports: boolean;
  canViewCashSessionReports: boolean;
  canViewAuditReports: boolean;
  canExportReports: boolean;
  canViewUsers: boolean;
  canCreateUsers: boolean;
  canUpdateUsers: boolean;
  canDisableUsers: boolean;
  canManageRoles: boolean;
  canMarkDialysisPrescription: boolean;
  cashSession: CashSession | null;
  defaultAuthenticatedRoute: string;
  onQuickCash: () => void;
  onStatus: OperationalStatusReporter;
  user: AuthUser;
};

export function AppRoutes({
  canCreateInvoices,
  canCreatePayments,
  canEditFiscalSettings,
  canEditOperationalSettings,
  canManageCatalog,
  canOpenCash,
  canCloseAnyCash,
  canCloseCash,
  canViewBackups,
  canViewCash,
  canViewCatalog,
  canViewReceipts,
  canViewFiscalSettings,
  canViewInvoices,
  canViewReports,
  canViewManagerialReports,
  canViewCashSessionReports,
  canViewAuditReports,
  canExportReports,
  canViewUsers: _canViewUsers,
  canCreateUsers,
  canUpdateUsers,
  canDisableUsers,
  canManageRoles,
  canMarkDialysisPrescription,
  cashSession,
  defaultAuthenticatedRoute,
  onQuickCash,
  onStatus,
  user,
}: AppRoutesProps) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={appRoutes.dashboard.path} replace />} />
      <Route path="/login" element={<Navigate to={defaultAuthenticatedRoute} replace />} />
      <Route
        path={appRoutes.dashboard.path}
        element={
          <Suspense fallback={<RouteState kind="loading" title="Cargando módulo..." description="Espere mientras se carga el modulo local." headingLevel={2} />}>
            <DashboardView
              canCreateInvoices={canCreateInvoices}
              canEditFiscalSettings={canEditFiscalSettings}
              canManageCatalog={canManageCatalog}
              canOpenCash={canOpenCash}
              canViewBackups={canViewBackups}
              canViewCatalog={canViewCatalog}
              canViewFiscalSettings={canViewFiscalSettings}
              canViewInvoices={canViewInvoices}
              canViewManagerialReports={canViewManagerialReports}
              canViewReports={canViewReports}
              cashSession={cashSession}
              onStatus={onStatus}
            />
          </Suspense>
        }
      />
      <Route
        path={appRoutes.newInvoice.path}
        element={
          <PermissionGate
            allowed={canAccessRoute(appRoutes.newInvoice, user.permissions)}
            reason={appRoutes.newInvoice.deniedReason}
          >
            <Suspense fallback={<RouteState kind="loading" title="Cargando facturación..." description="Espere mientras se carga el módulo local." headingLevel={2} />}>
              <NewInvoiceView
                cashSession={cashSession}
                canCreatePayments={canCreatePayments}
                canOpenCash={canOpenCash}
                canViewCatalog={canViewCatalog}
                canViewReceipts={canViewReceipts}
                canMarkDialysisPrescription={canMarkDialysisPrescription}
                onOpenCash={canOpenCash ? onQuickCash : undefined}
                onStatus={onStatus}
              />
            </Suspense>
          </PermissionGate>
        }
      />
      <Route
        path={appRoutes.cashbox.path}
        element={
          <PermissionGate allowed={canAccessRoute(appRoutes.cashbox, user.permissions)} reason={appRoutes.cashbox.deniedReason}>
            <Suspense fallback={<RouteState kind="loading" title="Cargando caja..." description="Espere mientras se carga el módulo local." headingLevel={2} />}>
              <CashBoxView
              cashSession={cashSession}
              canCloseAnyCash={canCloseAnyCash}
              canCloseCash={canCloseCash}
              canCreateInvoices={canAccessRoute(appRoutes.newInvoice, user.permissions)}
              canOpenCash={canOpenCash}
              canViewInvoices={canViewInvoices}
              canViewCashSessionReport={canViewCashSessionReports || canViewManagerialReports}
              currentUserId={user.id}
              onStatus={onStatus}
              />
            </Suspense>
          </PermissionGate>
        }
      />

      <Route
        path={appRoutes.catalog.path}
        element={
          <PermissionGate allowed={canAccessRoute(appRoutes.catalog, user.permissions)} reason={appRoutes.catalog.deniedReason}>
            <Suspense fallback={<RouteState kind="loading" title="Cargando catálogo..." description="Espere mientras se carga el modulo local." headingLevel={2} />}>
              <CatalogView user={user} onStatus={onStatus} />
            </Suspense>
          </PermissionGate>
        }
      />
      <Route
        path={appRoutes.invoices.path}
        element={
          <PermissionGate allowed={canAccessRoute(appRoutes.invoices, user.permissions)} reason={appRoutes.invoices.deniedReason}>
            <Suspense fallback={<RouteState kind="loading" title="Cargando historial..." description="Espere mientras se carga el modulo local." headingLevel={2} />}>
              <InvoiceHistoryView user={user} onStatus={onStatus} />
            </Suspense>
          </PermissionGate>
        }
      />
      <Route
        path={`${appRoutes.reports.path}/*`}
        element={
          <PermissionGate
            allowed={canAccessRoute(appRoutes.reports, user.permissions)}
            reason={appRoutes.reports.deniedReason}
          >
            <Suspense fallback={<RouteState kind="loading" title="Cargando reportes..." description="Espere mientras se carga el modulo local." headingLevel={2} />}>
              <ReportsView
                canBrowseCashSessions={canViewCash}
                canExport={canExportReports}
                canViewAuditReports={canViewAuditReports}
                canViewCashSessionReport={canViewCashSessionReports || canViewManagerialReports}
                canViewManagerial={canViewManagerialReports}
                onStatus={onStatus}
              />
            </Suspense>
          </PermissionGate>
        }
      />
      <Route
        path={appRoutes.backups.path}
        element={
          <PermissionGate allowed={canAccessRoute(appRoutes.backups, user.permissions)} reason={appRoutes.backups.deniedReason}>
            <Suspense fallback={<RouteState kind="loading" title="Cargando respaldos..." description="Espere mientras se carga el modulo local." headingLevel={2} />}>
              <BackupsView user={user} onStatus={onStatus} />
            </Suspense>
          </PermissionGate>
        }
      />
      <Route
        path={appRoutes.fiscalSettings.path}
        element={
          <PermissionGate allowed={canAccessRoute(appRoutes.fiscalSettings, user.permissions)} reason={appRoutes.fiscalSettings.deniedReason}>
            <Suspense fallback={<RouteState kind="loading" title="Cargando configuracion fiscal..." description="Espere mientras se carga el modulo local." headingLevel={2} />}>
              <FiscalSettingsView
                canEdit={canEditFiscalSettings}
                canEditOperationalRules={canEditOperationalSettings}
                canViewFiscalSettings={canViewFiscalSettings}
                onStatus={onStatus}
              />
            </Suspense>
          </PermissionGate>
        }
      />
      <Route
        path={appRoutes.receiptSettings.path}
        element={
          <PermissionGate allowed={canAccessRoute(appRoutes.receiptSettings, user.permissions)} reason={appRoutes.receiptSettings.deniedReason}>
            <Suspense fallback={<RouteState kind="loading" title="Cargando recibos institucionales..." description="Espere mientras se carga el modulo local." headingLevel={2} />}>
              <InstitutionalReceiptSettingsView
                canEdit={user.permissions.includes('receipt_settings.update')}
                canEditAdvanced={user.permissions.includes('receipt_settings.advanced')}
                onStatus={onStatus}
              />
            </Suspense>
          </PermissionGate>
        }
      />
      <Route
        path={appRoutes.users.path}
        element={
          <PermissionGate allowed={canAccessRoute(appRoutes.users, user.permissions)} reason={appRoutes.users.deniedReason}>
            <Suspense fallback={<RouteState kind="loading" title="Cargando usuarios..." description="Espere mientras se carga el modulo local." headingLevel={2} />}>
              <UsersView
                onStatus={onStatus}
                canCreateUsers={canCreateUsers}
                canUpdateUsers={canUpdateUsers}
                canDisableUsers={canDisableUsers}
                canManageRoles={canManageRoles}
                canAssignAdminRole={user.permissions.includes('users.assign_admin_role')}
                currentUserId={user.id}
              />
            </Suspense>
          </PermissionGate>
        }
      />
      <Route
        path={appRoutes.support.path}
        element={
          <Suspense fallback={<RouteState kind="loading" title="Cargando soporte..." description="Espere mientras se carga el modulo local." headingLevel={2} />}>
            <SupportCenterView user={user} onStatus={onStatus} />
          </Suspense>
        }
      />
      <Route
        path={appRoutes.help.path}
        element={
          <Suspense fallback={<RouteState kind="loading" title="Cargando ayuda..." description="Espere mientras se carga el modulo local." headingLevel={2} />}>
            <HelpView />
          </Suspense>
        }
      />
      <Route
        path={appRoutes.about.path}
        element={
          <Suspense fallback={<RouteState kind="loading" title="Cargando acerca de..." description="Espere mientras se carga el modulo local." headingLevel={2} />}>
            <AboutView user={user} onStatus={onStatus} />
          </Suspense>
        }
      />
      <Route path="*" element={<NotFoundView />} />
    </Routes>
  );
}

export function NotFoundView() {
  return (
    <RouteState
      kind="not-found"
      title="Ruta no encontrada"
      description="La pantalla solicitada no existe dentro de la navegación principal."
      action={{ label: 'Ir al inicio', href: appRoutes.dashboard.path }}
    />
  );
}
