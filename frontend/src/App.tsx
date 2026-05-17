import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './AppRoutes';
import { useHospitalSession } from './app/useHospitalSession';
import { EmptyState, LoadingState } from './components/ui/states';
import { LoginView } from './features/auth/LoginView';
import { PasswordChangeView } from './features/auth/PasswordChangeView';
import { AppShell } from './layout/AppShell';

export function App() {
  return (
    <BrowserRouter>
      <HospitalApp />
    </BrowserRouter>
  );
}

function HospitalApp() {
  const session = useHospitalSession();

  if (session.loading) {
    return <LoadingState label="Cargando sesion..." />;
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
      />
    );
  }

  if (session.user.must_change_password) {
    return (
      <PasswordChangeView
        form={session.passwordForm}
        onChange={session.setPasswordForm}
        onSubmit={session.handlePasswordSubmit}
      />
    );
  }

  return (
    <AppShell
      cashSession={session.cashSession}
      onLogout={session.handleLogout}
      status={session.status}
      user={session.user}
    >
      {!session.hasAnyOperationalPermission ? (
        <EmptyState
          title="Sin permisos operativos"
          description="No tiene permisos operativos asignados."
        />
      ) : session.needsBillingCashBootstrap || session.cashBootstrapLoading ? (
        <LoadingState label="Validando caja para facturacion..." />
      ) : (
        <AppRoutes
          canCreateInvoices={session.canCreateInvoices}
          canEditFiscalSettings={session.canEditFiscalSettings}
          canViewBackups={session.canViewBackups}
          canViewCash={session.canViewCash}
          canViewCatalog={session.canViewCatalog}
          canViewFiscalSettings={session.canViewFiscalSettings}
          canViewInvoices={session.canViewInvoices}
          canViewReports={session.canViewReports}
          canViewManagerialReports={session.canViewManagerialReports}
          canViewCashSessionReports={session.canViewCashSessionReports}
          canExportReports={session.canExportReports}
          cashSession={session.cashSession}
          defaultAuthenticatedRoute={session.defaultAuthenticatedRoute}
          onCashSessionChange={session.setCashSession}
          onStatus={session.setStatus}
          user={session.user}
        />
      )}
    </AppShell>
  );
}
