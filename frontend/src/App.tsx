import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { AppRoutes } from './AppRoutes';
import { LoginView } from './features/auth/LoginView';
import { PasswordChangeView, type PasswordChangeForm } from './features/auth/PasswordChangeView';
import { AppShell } from './layout/AppShell';
import { type AuthUser, type CashSession, apiClient } from './lib/api';
import { EmptyState, LoadingState } from './components/ui/states';

export function App() {
  return (
    <BrowserRouter>
      <HospitalApp />
    </BrowserRouter>
  );
}

function HospitalApp() {
  const location = useLocation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [cashBootstrapPath, setCashBootstrapPath] = useState<string | null>(null);
  const [cashBootstrapLoading, setCashBootstrapLoading] = useState(false);
  const [login, setLogin] = useState(import.meta.env.DEV ? 'admin.demo' : '');
  const [password, setPassword] = useState('');
  const [passwordForm, setPasswordForm] = useState<PasswordChangeForm>({
    current_password: '',
    password: '',
    password_confirmation: '',
  });
  const [status, setStatus] = useState('Listo para iniciar sesion local.');
  const [loading, setLoading] = useState(true);

  const permissions = useMemo(() => new Set(user?.permissions ?? []), [user?.permissions]);
  const canViewFiscalSettings = permissions.has('settings.fiscal.view');
  const canEditFiscalSettings = permissions.has('settings.fiscal.update');
  const canViewCatalog = permissions.has('catalog.view');
  const canCreateInvoices = permissions.has('invoices.create');
  const canViewInvoices = permissions.has('invoices.view');
  const canViewCash = permissions.has('cash.view');
  const canViewReports = permissions.has('reports.view');
  const canViewBackups = permissions.has('backups.view');
  const needsBillingCashBootstrap =
    Boolean(user) &&
    !user?.must_change_password &&
    canViewCash &&
    cashSession === null &&
    location.pathname === '/billing/new' &&
    cashBootstrapPath !== location.pathname;

  useEffect(() => {
    apiClient
      .me()
      .then((currentUser) => {
        setUser(currentUser);
        setStatus('Sesion activa.');
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!needsBillingCashBootstrap) {
      return;
    }

    let active = true;
    setCashBootstrapLoading(true);

    apiClient
      .getCurrentCashSession()
      .then((current) => {
        if (!active) {
          return;
        }

        setCashSession(current);
        setCashBootstrapPath(location.pathname);
      })
      .catch(() => {
        if (active) {
          setCashBootstrapPath(location.pathname);
        }
      })
      .finally(() => {
        if (active) {
          setCashBootstrapLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [location.pathname, needsBillingCashBootstrap]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('Validando credenciales...');

    try {
      const loggedUser = await apiClient.login(login, password);
      const currentUser = await apiClient.me().catch(() => loggedUser);
      setUser(currentUser);
      setPassword('');
      setStatus(
        currentUser.must_change_password
          ? 'El usuario debe cambiar su contrasena antes de operar.'
          : 'Sesion iniciada.',
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo iniciar sesion.');
    }
  }

  async function handleLogout() {
    await apiClient.logout().catch(() => undefined);
    setUser(null);
    setCashSession(null);
    setCashBootstrapPath(null);
    setStatus('Sesion cerrada.');
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('Actualizando contrasena...');

    try {
      const updatedUser = await apiClient.changePassword(passwordForm);
      setUser(updatedUser);
      setPasswordForm({
        current_password: '',
        password: '',
        password_confirmation: '',
      });
      setStatus('Contrasena actualizada.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo actualizar la contrasena.');
    }
  }

  if (loading) {
    return <LoadingState label="Cargando sesion..." />;
  }

  if (!user) {
    return (
      <LoginView
        login={login}
        password={password}
        status={status}
        onLoginChange={setLogin}
        onPasswordChange={setPassword}
        onSubmit={handleLogin}
      />
    );
  }

  if (user.must_change_password) {
    return (
      <PasswordChangeView
        form={passwordForm}
        onChange={setPasswordForm}
        onSubmit={handlePasswordSubmit}
      />
    );
  }

  const hasAnyOperationalPermission =
    canViewFiscalSettings ||
    canViewCatalog ||
    canCreateInvoices ||
    canViewCash ||
    canViewInvoices ||
    canViewReports ||
    canViewBackups;
  const defaultAuthenticatedRoute = canViewCash ? '/cashbox' : '/dashboard';

  return (
    <AppShell cashSession={cashSession} onLogout={handleLogout} status={status} user={user}>
      {!hasAnyOperationalPermission ? (
        <EmptyState
          title="Sin permisos operativos"
          description="No tiene permisos operativos asignados."
        />
      ) : needsBillingCashBootstrap || cashBootstrapLoading ? (
        <LoadingState label="Validando caja para facturacion..." />
      ) : (
        <AppRoutes
          canCreateInvoices={canCreateInvoices}
          canEditFiscalSettings={canEditFiscalSettings}
          canViewBackups={canViewBackups}
          canViewCash={canViewCash}
          canViewCatalog={canViewCatalog}
          canViewFiscalSettings={canViewFiscalSettings}
          canViewInvoices={canViewInvoices}
          canViewReports={canViewReports}
          cashSession={cashSession}
          defaultAuthenticatedRoute={defaultAuthenticatedRoute}
          onCashSessionChange={setCashSession}
          onStatus={setStatus}
          user={user}
        />
      )}
    </AppShell>
  );
}
