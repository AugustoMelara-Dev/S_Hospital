import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PermissionGate } from './components/PermissionGate';
import { EmptyState, LoadingState } from './components/ui/states';
import { CashBoxView } from './features/cash/CashBoxView';
import { NewInvoiceView } from './features/invoices/NewInvoiceView';
import { type AuthUser, type CashSession } from './lib/api';
import { appRoutes, canAccessRoute } from './navigation/appNavigation';

const AboutView = lazy(() => import('./features/about/AboutView').then((module) => ({ default: module.AboutView })));
const BackupsView = lazy(() => import('./features/backups/BackupsView').then((module) => ({ default: module.BackupsView })));
const CatalogView = lazy(() => import('./features/catalog/CatalogView').then((module) => ({ default: module.CatalogView })));
const DashboardView = lazy(() => import('./features/dashboard/DashboardView').then((module) => ({ default: module.DashboardView })));
const FiscalSettingsView = lazy(() => import('./features/settings/FiscalSettingsView').then((module) => ({ default: module.FiscalSettingsView })));
const HelpView = lazy(() => import('./features/help/HelpView').then((module) => ({ default: module.HelpView })));
const InvoiceHistoryView = lazy(() => import('./features/invoices/InvoiceHistoryView').then((module) => ({ default: module.InvoiceHistoryView })));
const ReportsView = lazy(() => import('./features/reports/ReportsView').then((module) => ({ default: module.ReportsView })));
const UsersView = lazy(() => import('./features/admin/UsersView').then((module) => ({ default: module.UsersView })));

type AppRoutesProps = {
  canCreateInvoices: boolean;
  canCreatePayments: boolean;
  canEditFiscalSettings: boolean;
  canOpenCash: boolean;
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
  canExportReports: boolean;
  canViewUsers: boolean;
  canCreateUsers: boolean;
  cashSession: CashSession | null;
  defaultAuthenticatedRoute: string;
  onQuickCash: () => void;
  onQuickInvoice: () => void;
  onStatus: (message: string) => void;
  user: AuthUser;
};

export function AppRoutes({
  canCreateInvoices,
  canCreatePayments,
  canEditFiscalSettings,
  canOpenCash,
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
  canExportReports,
  canViewUsers: _canViewUsers,
  canCreateUsers,
  cashSession,
  defaultAuthenticatedRoute,
  onQuickCash,
  onQuickInvoice,
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
          <Suspense fallback={<LoadingState label="Cargando módulo..." />}>
            <DashboardView
              canCreateInvoices={canCreateInvoices}
              canViewBackups={canViewBackups}
              canViewCash={canViewCash}
              canViewCatalog={canViewCatalog}
              canViewFiscalSettings={canViewFiscalSettings}
              canViewInvoices={canViewInvoices}
              canViewManagerialReports={canViewManagerialReports}
              canViewReports={canViewReports}
              cashSession={cashSession}
              onQuickCash={onQuickCash}
              onQuickInvoice={onQuickInvoice}
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
            <NewInvoiceView
              cashSession={cashSession}
              canCreatePayments={canCreatePayments}
              canViewCatalog={canViewCatalog}
              canViewReceipts={canViewReceipts}
              onOpenCash={onQuickCash}
              onStatus={onStatus}
            />
          </PermissionGate>
        }
      />
      <Route
        path={appRoutes.cashbox.path}
        element={
          <PermissionGate allowed={canAccessRoute(appRoutes.cashbox, user.permissions)} reason={appRoutes.cashbox.deniedReason}>
            <CashBoxView
              cashSession={cashSession}
              canCloseCash={canCloseCash}
              canOpenCash={canOpenCash}
              canViewCashSessionReport={canViewCashSessionReports || canViewManagerialReports}
              onStatus={onStatus}
            />
          </PermissionGate>
        }
      />
      <Route
        path={appRoutes.catalog.path}
        element={
          <PermissionGate allowed={canAccessRoute(appRoutes.catalog, user.permissions)} reason={appRoutes.catalog.deniedReason}>
            <Suspense fallback={<LoadingState label="Cargando catálogo..." />}>
              <CatalogView user={user} onStatus={onStatus} />
            </Suspense>
          </PermissionGate>
        }
      />
      <Route
        path={appRoutes.invoices.path}
        element={
          <PermissionGate allowed={canAccessRoute(appRoutes.invoices, user.permissions)} reason={appRoutes.invoices.deniedReason}>
            <Suspense fallback={<LoadingState label="Cargando historial..." />}>
              <InvoiceHistoryView user={user} onStatus={onStatus} />
            </Suspense>
          </PermissionGate>
        }
      />
      <Route
        path={appRoutes.reports.path}
        element={
          <PermissionGate
            allowed={canAccessRoute(appRoutes.reports, user.permissions)}
            reason={appRoutes.reports.deniedReason}
          >
            <Suspense fallback={<LoadingState label="Cargando reportes..." />}>
              <ReportsView
                canExport={canExportReports}
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
            <Suspense fallback={<LoadingState label="Cargando respaldos..." />}>
              <BackupsView user={user} onStatus={onStatus} />
            </Suspense>
          </PermissionGate>
        }
      />
      <Route
        path={appRoutes.fiscalSettings.path}
        element={
          <PermissionGate allowed={canAccessRoute(appRoutes.fiscalSettings, user.permissions)} reason={appRoutes.fiscalSettings.deniedReason}>
            <Suspense fallback={<LoadingState label="Cargando configuracion fiscal..." />}>
              <FiscalSettingsView canEdit={canEditFiscalSettings} onStatus={onStatus} />
            </Suspense>
          </PermissionGate>
        }
      />
      <Route
        path={appRoutes.users.path}
        element={
          <PermissionGate allowed={canAccessRoute(appRoutes.users, user.permissions)} reason={appRoutes.users.deniedReason}>
            <Suspense fallback={<LoadingState label="Cargando usuarios..." />}>
              <UsersView onStatus={onStatus} canCreateUsers={canCreateUsers} />
            </Suspense>
          </PermissionGate>
        }
      />
      <Route
        path={appRoutes.help.path}
        element={
          <Suspense fallback={<LoadingState label="Cargando ayuda..." />}>
            <HelpView />
          </Suspense>
        }
      />
      <Route
        path={appRoutes.about.path}
        element={
          <Suspense fallback={<LoadingState label="Cargando acerca de..." />}>
            <AboutView user={user} onStatus={onStatus} />
          </Suspense>
        }
      />
      <Route path="*" element={<NotFoundView />} />
    </Routes>
  );
}

function NotFoundView() {
  return (
    <EmptyState
      title="Ruta no encontrada"
      description="La pantalla solicitada no existe dentro de la navegacion principal."
    />
  );
}
