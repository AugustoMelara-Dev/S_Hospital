import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PermissionGate } from './components/PermissionGate';
import { EmptyState, LoadingState } from './components/ui/states';
import { CashBoxView } from './features/cash/CashBoxView';
import { NewInvoiceView } from './features/invoices/NewInvoiceView';
import { type AuthUser, type CashSession } from './lib/api';

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
  onCashSessionChange: (session: CashSession | null) => void;
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
  canViewUsers,
  canCreateUsers,
  cashSession,
  defaultAuthenticatedRoute,
  onQuickCash,
  onQuickInvoice,
  onCashSessionChange,
  onStatus,
  user,
}: AppRoutesProps) {
  return (
    <Suspense fallback={<LoadingState label="Cargando pantalla..." />}>
      <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<Navigate to={defaultAuthenticatedRoute} replace />} />
      <Route
        path="/dashboard"
        element={
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
        }
      />
      <Route
        path="/billing/new"
        element={
          <PermissionGate
            allowed={canCreateInvoices && canViewCatalog && canViewCash && canCreatePayments && canViewReceipts}
            reason="Requiere permisos de facturación, catálogo, caja, pagos y recibos. Solicite el rol Cajero completo."
          >
            <NewInvoiceView
              cashSession={cashSession}
              canCreatePayments={canCreatePayments}
              canViewCatalog={canViewCatalog}
              canViewReceipts={canViewReceipts}
              onCashSessionChange={onCashSessionChange}
              onOpenCash={onQuickCash}
              onStatus={onStatus}
            />
          </PermissionGate>
        }
      />
      <Route
        path="/cashbox"
        element={
          <PermissionGate allowed={canViewCash} reason="Requiere permiso para consultar y operar caja.">
            <CashBoxView
              cashSession={cashSession}
              canCloseCash={canCloseCash}
              canOpenCash={canOpenCash}
              canViewCashSessionReport={canViewCashSessionReports || canViewManagerialReports}
              onStatus={onStatus}
              onSessionChange={onCashSessionChange}
            />
          </PermissionGate>
        }
      />
      <Route
        path="/catalog"
        element={
          <PermissionGate allowed={canViewCatalog} reason="Requiere permiso para consultar el catalogo de servicios.">
            <CatalogView user={user} onStatus={onStatus} />
          </PermissionGate>
        }
      />
      <Route
        path="/invoices"
        element={
          <PermissionGate allowed={canViewInvoices} reason="Requiere permiso para consultar historial de facturas y recibos.">
            <InvoiceHistoryView user={user} onStatus={onStatus} />
          </PermissionGate>
        }
      />
      <Route
        path="/reports"
        element={
          <PermissionGate
            allowed={canViewReports || canViewCashSessionReports}
            reason="Requiere permiso para consultar reportes operativos o reportes de caja."
          >
            <ReportsView
              canExport={canExportReports}
              canViewCashSessionReport={canViewCashSessionReports || canViewManagerialReports}
              canViewManagerial={canViewManagerialReports}
              onStatus={onStatus}
            />
          </PermissionGate>
        }
      />
      <Route
        path="/backups"
        element={
          <PermissionGate allowed={canViewBackups} reason="Requiere permiso para consultar respaldos locales.">
            <BackupsView user={user} onStatus={onStatus} />
          </PermissionGate>
        }
      />
      <Route
        path="/settings/fiscal"
        element={
          <PermissionGate allowed={canViewFiscalSettings} reason="Requiere permiso para consultar configuración fiscal.">
            <FiscalSettingsView canEdit={canEditFiscalSettings} onStatus={onStatus} />
          </PermissionGate>
        }
      />
      <Route
        path="/admin/users"
        element={
          <PermissionGate allowed={canViewUsers} reason="Requiere permiso para gestionar usuarios.">
            <UsersView onStatus={onStatus} canCreateUsers={canCreateUsers} />
          </PermissionGate>
        }
      />
      <Route
        path="/help"
        element={<HelpView />}
      />
      <Route
        path="/about"
        element={<AboutView onStatus={onStatus} />}
      />
      <Route path="*" element={<NotFoundView />} />
      </Routes>
    </Suspense>
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
