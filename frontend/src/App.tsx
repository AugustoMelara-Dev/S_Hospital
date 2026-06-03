import { useCallback, useEffect } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from './AppRoutes';
import { useHospitalSession } from './app/useHospitalSession';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { Dialog } from './components/ui/dialog';
import { EmptyState, LoadingState } from './components/ui/states';
import { LoginView } from './features/auth/LoginView';
import { PasswordChangeView } from './features/auth/PasswordChangeView';
import { CashBoxView } from './features/cash/CashBoxView';
import { NewInvoiceView } from './features/invoices/NewInvoiceView';
import { AppShell } from './layout/AppShell';
import { queryClient } from './lib/query-client';
import { apiClient } from './lib/api';
import { notify, Toaster } from './components/ui/toaster';
import { isErrorMessage } from './lib/api/user-error';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppErrorBoundary>
          <HospitalApp />
        </AppErrorBoundary>
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function HospitalApp() {
  const session = useHospitalSession();
  const { setStatus } = session;
  const navigate = useNavigate();
  const [quickInvoiceOpen, setQuickInvoiceOpen] = useState(false);
  const [quickCashOpen, setQuickCashOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Augment the onStatus callback: any message that features dispatch
  // is also surfaced as a real toast (top-right). The status string
  // continues to drive the topbar pill, but cashiers no longer miss
  // errors that were previously hidden in an sr-only footer.
  const handleStatus = useCallback((message: string) => {
    setStatus(message);
    if (message && message !== 'Listo para iniciar sesión local.') {
      if (isErrorMessage(message)) {
        notify.error(message);
      } else if (
        message.startsWith('Cargando') ||
        message.startsWith('Preparando') ||
        message.startsWith('Validando') ||
        message.startsWith('Actualizando') ||
        message.startsWith('Guardando') ||
        message.startsWith('Abriendo') ||
        message.startsWith('Cerrando') ||
        message.startsWith('Subiendo') ||
        message.startsWith('Creando') ||
        message.startsWith('Restableciendo') ||
        message.startsWith('Cambiando') ||
        message.startsWith('Revisando')
      ) {
        notify.info(message);
      } else {
        notify.success(message);
      }
    }
  }, [setStatus]);

  useEffect(() => {
    if (session.sessionExpired) {
      navigate('/login', { replace: true });
    }
  }, [session.sessionExpired, navigate]);

  useEffect(() => {
    apiClient.getLogo()
      .then((url) => setLogoUrl(url))
      .catch(() => {});
  }, [session.user]); // Refresh when user changes/logs in

  if (session.loading) {
    return <LoadingState label="Cargando sesión..." />;
  }

  if (!session.user) {
    return (
      <LoginView
        login={session.login}
        password={session.password}
        status={session.status}
        onLoginChange={session.setLogin}
        onPasswordChange={session.setPassword}
        onSubmit={session.handleLogin}
        logoUrl={logoUrl}
      />
    );
  }

  if (session.user.must_change_password) {
    return (
      <PasswordChangeView
        form={session.passwordForm}
        onChange={session.setPasswordForm}
        onSubmit={session.handlePasswordSubmit}
        submitting={session.passwordSubmitting}
        status={session.status}
      />
    );
  }

  return (
    <AppShell
      cashSession={session.cashSession}
      onLogout={session.handleLogout}
      status={session.status}
      user={session.user}
      logoUrl={logoUrl}
    >
      {!session.hasAnyOperationalPermission ? (
        <EmptyState
          title="Sin permisos operativos"
          description="No tiene permisos operativos asignados."
        />
      ) : session.loading ? (
        <LoadingState label="Validando caja para facturación..." />
      ) : (
        <AppRoutes
          canCreateInvoices={session.canCreateInvoices}
          canEditFiscalSettings={session.canEditFiscalSettings}
          canOpenCash={session.canOpenCash}
          canCloseCash={session.canCloseCash}
          canViewBackups={session.canViewBackups}
          canViewCash={session.canViewCash}
          canCreatePayments={session.canCreatePayments}
          canViewCatalog={session.canViewCatalog}
          canViewReceipts={session.canViewReceipts}
          canViewFiscalSettings={session.canViewFiscalSettings}
          canViewInvoices={session.canViewInvoices}
          canViewReports={session.canViewReports}
          canViewManagerialReports={session.canViewManagerialReports}
          canViewCashSessionReports={session.canViewCashSessionReports}
          canExportReports={session.canExportReports}
          canViewUsers={session.canViewUsers}
          canCreateUsers={session.canCreateUsers}
          cashSession={session.cashSession}
          defaultAuthenticatedRoute={session.defaultAuthenticatedRoute}
          onQuickCash={() => setQuickCashOpen(true)}
          onQuickInvoice={() => setQuickInvoiceOpen(true)}
          onCashSessionChange={session.setCashSession}
          onStatus={handleStatus}
          user={session.user}
        />
      )}

      <Dialog
        open={quickInvoiceOpen}
        onOpenChange={setQuickInvoiceOpen}
        size="fullscreen"
        title="Emitir factura"
        description="Facturación rápida sin abandonar la pantalla actual."
      >
        <NewInvoiceView
          cashSession={session.cashSession}
          canCreatePayments={session.canCreatePayments}
          canViewCatalog={session.canViewCatalog}
          canViewReceipts={session.canViewReceipts}
          onOpenCash={() => {
            setQuickInvoiceOpen(false);
            setQuickCashOpen(true);
          }}
          onStatus={handleStatus}
        />
      </Dialog>

      <Dialog
        open={quickCashOpen}
        onOpenChange={setQuickCashOpen}
        size="lg"
        title={session.cashSession ? 'Caja activa' : 'Abrir caja'}
        description="Apertura y cierre de turno sin navegar a otra pantalla."
      >
        <CashBoxView
          cashSession={session.cashSession}
          canCloseCash={session.canCloseCash}
          canOpenCash={session.canOpenCash}
          canViewCashSessionReport={session.canViewCashSessionReports || session.canViewManagerialReports}
          onStatus={handleStatus}
          onSessionChange={session.setCashSession}
          compact
        />
      </Dialog>
    </AppShell>
  );
}
