import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from './AppRoutes';
import { useHospitalSession } from './app/useHospitalSession';
import { useCashSession } from './hooks/useCashSession';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AdminEmpty, AdminSpinner } from './design-system/admin/components';
import { LoginView } from './features/auth/LoginView';
import { PasswordChangeView } from './features/auth/PasswordChangeView';
import { AdminShell } from './shell/admin/AdminShell';
import { AdminSessionProvider } from './shell/admin/AdminSessionContext';
import { queryClient } from './lib/query-client';
import { apiClient } from './lib/api';
import { FeedbackProvider, useFeedback } from './design-system/providers/FeedbackProvider';
import { ThemeProvider } from './design-system/providers/ThemeProvider';
import {
  normalizeOperationalStatus,
  type OperationalStatusEvent,
  type OperationalStatusReporter,
} from './app/operationalStatus';

export type ShellStatus = Pick<OperationalStatusEvent, 'key' | 'level' | 'message'> & {
  ownerUserId: number | null;
};

type NormalizedOperationalStatus = OperationalStatusEvent & { toast: boolean };

/**
 * La banda del shell queda reservada para problemas contextuales que deben
 * permanecer visibles. El feedback rutinario vive en su propia superficie o
 * en toast. Una recuperación solo limpia el problema que comparte una clave
 * explícita; claves ausentes o distintas nunca borran un error previo.
 */
export function reduceShellStatus(
  previous: ShellStatus | null,
  status: NormalizedOperationalStatus,
  ownerUserId: number | null,
): ShellStatus | null {
  if (!status.toast && (status.level === 'error' || status.level === 'warning')) {
    return { key: status.key, level: status.level, message: status.message, ownerUserId };
  }

  const resolvesPrevious =
    (status.level === 'info' || status.level === 'success')
    && typeof status.key === 'string'
    && status.key.length > 0
    && status.key === previous?.key;

  return resolvesPrevious ? null : previous;
}

export function clearShellStatusForUserChange(
  previous: ShellStatus | null,
  previousUserId: number | null,
  nextUserId: number | null,
): ShellStatus | null {
  return previousUserId === nextUserId ? previous : null;
}

export function visibleShellStatusMessage(
  status: ShellStatus | null,
  visibleUserId: number | null,
): string {
  return status?.ownerUserId === visibleUserId ? status.message : '';
}

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
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [shellStatus, setShellStatus] = useState<ShellStatus | null>(null);
  const shellUserIdRef = useRef<number | null>(session.user?.id ?? null);
  const shouldLoadCashSession = Boolean(
    session.user &&
      !session.user.must_change_password &&
      (session.canViewCash ||
        session.canOpenCash ||
        session.canCreateInvoices ||
        session.canCreatePayments),
  );
  const { data: cashSession, isLoading: cashSessionLoading } = useCashSession({
    enabled: shouldLoadCashSession,
  });

  useEffect(() => {
    const previousUserId = shellUserIdRef.current;
    const nextUserId = session.user?.id ?? null;
    setShellStatus((previous) =>
      clearShellStatusForUserChange(previous, previousUserId, nextUserId),
    );
    shellUserIdRef.current = nextUserId;
  }, [session.user?.id]);

  // Los eventos con toast se notifican allí. La banda persistente se limita a
  // errores/advertencias contextuales marcados `toast:false`; los estados
  // informativos locales (p. ej. agregar una línea) no desplazan el contenido.
  const handleStatus = useCallback<OperationalStatusReporter>(
    (input) => {
      const status = normalizeOperationalStatus(input);
      setShellStatus((previous) => reduceShellStatus(previous, status, session.user?.id ?? null));
      if (status.toast && status.message) {
        feedback.notify(status);
      }
    },
    [feedback, session.user?.id],
  );

  useEffect(() => {
    if (session.sessionExpired) {
      navigate('/login', { replace: true });
    }
  }, [session.sessionExpired, navigate]);

  useEffect(() => {
    apiClient
      .getLogo()
      .then((url) => setLogoUrl(url))
      .catch(() => {});
  }, [session.user]); // Refresh when user changes/logs in

  if (session.loading) {
    return (
      <div
        role="status"
        aria-label="Cargando sesión"
        className="ui-root flex min-h-dvh items-center justify-center"
      >
        <AdminSpinner className="size-8" />
      </div>
    );
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
    <AdminSessionProvider
      user={session.user}
      cashSession={cashSession ?? null}
      cashSessionLoading={shouldLoadCashSession && cashSessionLoading}
      onStatus={handleStatus}
    >
    <AdminShell
      cashSession={cashSession ?? null}
      cashSessionLoading={shouldLoadCashSession && cashSessionLoading}
      onLogout={session.handleLogout}
      status={visibleShellStatusMessage(shellStatus, session.user.id)}
      user={session.user}
      logoUrl={logoUrl}
    >
      {!session.hasAnyOperationalPermission ? (
        <AdminEmpty
          title="Sin permisos operativos"
          description="Su usuario no tiene permisos operativos asignados. Pida a un supervisor que revise su rol."
        />
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
          canViewReceiptSettings={session.canViewReceiptSettings}
          canEditReceiptSettings={session.canEditReceiptSettings}
          canEditAdvancedReceiptSettings={session.canEditAdvancedReceiptSettings}
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
          onStatus={handleStatus}
          user={session.user}
        />
      )}
    </AdminShell>
    </AdminSessionProvider>
  );
}
