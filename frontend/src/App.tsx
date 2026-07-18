import { lazy, Suspense, useCallback, useEffect } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from './AppRoutes';
import { useHospitalSession } from './app/useHospitalSession';
import { useCashSession } from './hooks/useCashSession';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { LoginView } from './features/auth/LoginView';
import { PasswordChangeView } from './features/auth/PasswordChangeView';
import { InstitutionalShell } from './shell/InstitutionalShell';
import { queryClient } from './lib/query-client';
import { apiClient } from './lib/api';
import { FeedbackProvider, useFeedback } from './design-system/providers/FeedbackProvider';
import { ThemeProvider } from './design-system/providers/ThemeProvider';
import { appRoutes, canAccessRoute } from './navigation/appNavigation';
import { normalizeOperationalStatus, type OperationalStatusReporter } from './app/operationalStatus';

const CashBoxView = lazy(() => import('./features/cash/CashBoxView').then((module) => ({ default: module.CashBoxView })));

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <FeedbackProvider>
          <BrowserRouter>
            <AppErrorBoundary>
              <HospitalApp />
            </AppErrorBoundary>
          </BrowserRouter>
        </FeedbackProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function HospitalApp() {
  const session = useHospitalSession();
  const navigate = useNavigate();
  const feedback = useFeedback();
  const setSessionStatus = session.setStatus;
  const [quickCashOpen, setQuickCashOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const shouldLoadCashSession = Boolean(
    session.user &&
    !session.user.must_change_password &&
    (session.canViewCash || session.canOpenCash || session.canCreateInvoices || session.canCreatePayments),
  );
  const { data: cashSession } = useCashSession({ enabled: shouldLoadCashSession });

  // Augment the onStatus callback: any message that features dispatch
  // is also surfaced as a real toast (top-right). The status string
  // continues to drive the topbar pill, but cashiers no longer miss
  // errors that were previously hidden in an sr-only footer.
  const handleStatus = useCallback<OperationalStatusReporter>((input) => {
    const status = normalizeOperationalStatus(input);
    setSessionStatus(status.message);
    if (status.toast && status.message && status.message !== 'Listo para iniciar sesión local.') {
      feedback.notify(status);
    }
  }, [feedback, setSessionStatus]);

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
    return <div role="status" aria-label="Cargando sesión" className="flex min-h-screen items-center justify-center"><Spinner className="size-8" /></div>;
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
        submitting={session.loginSubmitting}
        logoUrl={logoUrl}
      />
    );
  }

  if (session.user.must_change_password) {
    return (
      <PasswordChangeView
        onSubmit={session.handlePasswordSubmit}
        submitting={session.passwordSubmitting}
        status={session.status}
      />
    );
  }

  return (
    <InstitutionalShell
      cashSession={cashSession ?? null}
      onLogout={session.handleLogout}
      status={session.status}
      user={session.user}
      logoUrl={logoUrl}
    >
      {!session.hasAnyOperationalPermission ? (
        <Empty><EmptyHeader><EmptyDescription>No tiene permisos operativos asignados.</EmptyDescription></EmptyHeader></Empty>
      ) : session.loading ? (
        <div role="status" aria-label="Validando caja para facturación" className="flex min-h-48 items-center justify-center"><Spinner /></div>
      ) : (
        <AppRoutes
          canCreateInvoices={session.canCreateInvoices}
          canEditFiscalSettings={session.canEditFiscalSettings}
          canEditOperationalSettings={session.canEditOperationalSettings}
          canManageCatalog={session.canManageCatalog}
          canOpenCash={session.canOpenCash}
          canCloseAnyCash={session.canCloseAnyCash}
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
          canViewAuditReports={session.canViewAuditReports}
          canExportReports={session.canExportReports}
          canViewUsers={session.canViewUsers}
          canCreateUsers={session.canCreateUsers}
          canUpdateUsers={session.canUpdateUsers}
          canDisableUsers={session.canDisableUsers}
          canManageRoles={session.canManageRoles}
          canMarkDialysisPrescription={session.canMarkDialysisPrescription}
          cashSession={cashSession ?? null}
          defaultAuthenticatedRoute={session.defaultAuthenticatedRoute}
          onQuickCash={() => setQuickCashOpen(true)}
          onStatus={handleStatus}
          user={session.user}
        />
      )}


      <Dialog open={quickCashOpen} onOpenChange={setQuickCashOpen}>
        <DialogContent className="quick-cash-dialog overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{cashSession ? 'Caja activa' : 'Abrir caja'}</DialogTitle>
            <DialogDescription>Apertura y cierre de turno sin navegar a otra pantalla.</DialogDescription>
          </DialogHeader>
          <Suspense fallback={<div role="status" aria-label="Cargando caja rápida" className="flex min-h-48 items-center justify-center"><Spinner /></div>}>
            <CashBoxView
              cashSession={cashSession ?? null}
              canCloseAnyCash={session.canCloseAnyCash}
              canCloseCash={session.canCloseCash}
              canCreateInvoices={canAccessRoute(appRoutes.newInvoice, session.user.permissions)}
              canOpenCash={session.canOpenCash}
              canViewInvoices={session.canViewInvoices}
              canViewCashSessionReport={session.canViewCashSessionReports || session.canViewManagerialReports}
              currentUserId={session.user.id}
              onStatus={handleStatus}
              compact
            />
          </Suspense>
        </DialogContent>
      </Dialog>
    </InstitutionalShell>
  );
}
