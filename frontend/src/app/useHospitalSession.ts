import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { type AuthUser, type CashSession, apiClient, userSafeErrorMessage } from '../lib/api';
import { type PasswordChangeForm } from '../features/auth/PasswordChangeView';

export function useHospitalSession() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [login, setLogin] = useState(import.meta.env.DEV ? 'admin.demo' : '');
  const [password, setPassword] = useState('');
  const [passwordForm, setPasswordForm] = useState<PasswordChangeForm>({
    current_password: '',
    password: '',
    password_confirmation: '',
  });
  const [status, setStatus] = useState('Listo para iniciar sesión local.');
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  const permissions = useMemo(() => new Set(user?.permissions ?? []), [user?.permissions]);
  const canViewFiscalSettings = permissions.has('settings.fiscal.view');
  const canEditFiscalSettings = permissions.has('settings.fiscal.update');
  const canViewCatalog = permissions.has('catalog.view');
  const canCreateInvoices = permissions.has('invoices.create');
  const canViewInvoices = permissions.has('invoices.view');
  const canViewCash = permissions.has('cash.view');
  const canOpenCash = permissions.has('cash.open');
  const canCloseCash = permissions.has('cash.close');
  const canCreatePayments = permissions.has('payments.create');
  const canViewReceipts = permissions.has('receipts.view');
  const canViewManagerialReports = permissions.has('reports.managerial.view');
  const canViewCashSessionReports = permissions.has('reports.cash_session.view');
  const canExportReports = permissions.has('reports.export');
  const canViewReports =
    permissions.has('reports.view') ||
    canViewManagerialReports ||
    canViewCashSessionReports;
  const canViewBackups = permissions.has('backups.view');
  const canViewUsers = permissions.has('users.view');
  const canViewAreaServices = permissions.has('area_services.view');
  const needsBillingCashBootstrap = false;

  useEffect(() => {
    apiClient.onSessionExpired(() => {
      setUser(null);
      setCashSession(null);
      setStatus('Sesión vencida. Redirigiendo al login...');
      setSessionExpired(true);
    });

    apiClient
      .session()
      .then((currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          setStatus('Sesión activa.');
          setSessionExpired(false);
        }
        if (currentUser?.permissions.includes('cash.view') && import.meta.env.MODE !== 'test') {
          void apiClient
            .getCurrentCashSession()
            .then((currentCashSession) => {
              if (currentCashSession) {
                setCashSession(currentCashSession);
              }
            })
            .catch(() => setCashSession(null));
        }
      })
      .catch(() => {
        setUser(null);
        setSessionExpired(false);
        setStatus('Listo para iniciar sesión local.');
      })
      .finally(() => setLoading(false));

    return () => apiClient.onSessionExpired(null);
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('Validando credenciales...');

    try {
      const loggedUser = await apiClient.login(login, password);
      setSessionExpired(false);
      setUser(loggedUser);
      setPassword('');
      setStatus(
        loggedUser.must_change_password
          ? 'El usuario debe cambiar su contraseña antes de operar.'
          : 'Sesión iniciada.',
      );
    } catch (error) {
      setStatus(userSafeErrorMessage(error, 'No se pudo iniciar sesión.'));
    }
  }

  async function handleLogout() {
    await apiClient.logout().catch(() => undefined);
    setUser(null);
    setCashSession(null);
    setStatus('Sesión cerrada.');
  }

  async function refreshCashSession() {
    try {
      const session = await apiClient.getCurrentCashSession();
      setCashSession(session);
      return session;
    } catch {
      setCashSession(null);
      return null;
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('Actualizando contraseña...');

    try {
      const updatedUser = await apiClient.changePassword(passwordForm);
      setUser(updatedUser);
      setPasswordForm({
        current_password: '',
        password: '',
        password_confirmation: '',
      });
      setStatus('Contraseña actualizada.');
    } catch (error) {
      setStatus(userSafeErrorMessage(error, 'No se pudo actualizar la contraseña.'));
    }
  }

  return {
    user,
    cashSession,
    setCashSession,
    login,
    setLogin,
    password,
    setPassword,
    passwordForm,
    setPasswordForm,
    status,
    setStatus,
    loading,
    needsBillingCashBootstrap,
    cashBootstrapLoading: false,
    canViewFiscalSettings,
    canEditFiscalSettings,
    canViewCatalog,
    canCreateInvoices,
    canViewInvoices,
    canViewCash,
    canOpenCash,
    canCloseCash,
    canCreatePayments,
    canViewReceipts,
    canViewManagerialReports,
    canViewCashSessionReports,
    canExportReports,
    canViewReports,
    canViewBackups,
    canViewUsers,
    canViewAreaServices,
    hasAnyOperationalPermission:
      canViewFiscalSettings ||
      canViewCatalog ||
      canCreateInvoices ||
      canViewCash ||
      canViewInvoices ||
      canViewReports ||
      canViewBackups ||
      canViewUsers ||
      canViewAreaServices,
    defaultAuthenticatedRoute: canViewAreaServices && !canViewCatalog && !canCreateInvoices ? '/area-services' : '/dashboard',
    sessionExpired,
    handleLogin,
    handleLogout,
    handlePasswordSubmit,
    refreshCashSession,
  };
}
