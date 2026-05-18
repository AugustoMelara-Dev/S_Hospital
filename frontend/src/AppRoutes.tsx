import { Navigate, Route, Routes } from 'react-router-dom';
import { PermissionGate } from './components/PermissionGate';
import { EmptyState } from './components/ui/states';
import { BackupsView } from './features/backups/BackupsView';
import { CashBoxView } from './features/cash/CashBoxView';
import { CatalogView } from './features/catalog/CatalogView';
import { DashboardView } from './features/dashboard/DashboardView';
import { InvoiceHistoryView } from './features/invoices/InvoiceHistoryView';
import { NewInvoiceView } from './features/invoices/NewInvoiceView';
import { ReportsView } from './features/reports/ReportsView';
import { FiscalSettingsView } from './features/settings/FiscalSettingsView';
import { type AuthUser, type CashSession } from './lib/api';

type AppRoutesProps = {
  canCreateInvoices: boolean;
  canEditFiscalSettings: boolean;
  canViewBackups: boolean;
  canViewCash: boolean;
  canViewCatalog: boolean;
  canViewFiscalSettings: boolean;
  canViewInvoices: boolean;
  canViewReports: boolean;
  canViewManagerialReports: boolean;
  canViewCashSessionReports: boolean;
  canExportReports: boolean;
  cashSession: CashSession | null;
  defaultAuthenticatedRoute: string;
  onCashSessionChange: (session: CashSession | null) => void;
  onStatus: (message: string) => void;
  user: AuthUser;
};

export function AppRoutes({
  canCreateInvoices,
  canEditFiscalSettings,
  canViewBackups,
  canViewCash,
  canViewCatalog,
  canViewFiscalSettings,
  canViewInvoices,
  canViewReports,
  canViewManagerialReports,
  canViewCashSessionReports,
  canExportReports,
  cashSession,
  defaultAuthenticatedRoute,
  onCashSessionChange,
  onStatus,
  user,
}: AppRoutesProps) {
  return (
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
            onStatus={onStatus}
          />
        }
      />
      <Route
        path="/billing/new"
        element={
          <PermissionGate allowed={canCreateInvoices}>
            <NewInvoiceView cashSession={cashSession} onStatus={onStatus} />
          </PermissionGate>
        }
      />
      <Route
        path="/cashbox"
        element={
          <PermissionGate allowed={canViewCash}>
            <CashBoxView onStatus={onStatus} onSessionChange={onCashSessionChange} />
          </PermissionGate>
        }
      />
      <Route
        path="/catalog"
        element={
          <PermissionGate allowed={canViewCatalog}>
            <CatalogView user={user} onStatus={onStatus} />
          </PermissionGate>
        }
      />
      <Route
        path="/invoices"
        element={
          <PermissionGate allowed={canViewInvoices}>
            <InvoiceHistoryView user={user} onStatus={onStatus} />
          </PermissionGate>
        }
      />
      <Route
        path="/reports"
        element={
          <PermissionGate allowed={canViewReports}>
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
          <PermissionGate allowed={canViewBackups}>
            <BackupsView user={user} onStatus={onStatus} />
          </PermissionGate>
        }
      />
      <Route
        path="/settings/fiscal"
        element={
          <PermissionGate allowed={canViewFiscalSettings}>
            <FiscalSettingsView canEdit={canEditFiscalSettings} onStatus={onStatus} />
          </PermissionGate>
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
