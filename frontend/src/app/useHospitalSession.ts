import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { type AuthUser, type CashSession, apiClient, userSafeErrorMessage } from '../lib/api';
import { type PasswordChangeForm } from '../features/auth/PasswordChangeView';

export function useHospitalSession() {
  const location = useLocation();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [login, setLogin] = useState(import.meta.env.DEV ? 'admin.demo' : '');
  const [password, setPassword] = useState('');
  const [passwordForm, setPasswordForm] = useState<PasswordChangeForm>({
    current_password: '',
    password: '',
    password_confirmation: '',
  });
  const [status, setStatus] = useState('Listo para iniciar sesion local.');
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const initialPathRef = useRef(location.pathname);

  const permissions = useMemo(() => new Set(user?.permissions ?? []), [user?.permissions]);
  const canViewFiscalSettings = permissions.has('settings.fiscal.view');
  const canEditFiscalSettings = permissions.has('settings.fiscal.update');
  const canViewCatalog = permissions.has('catalog.view');
  const canCreateInvoices = permissions.has('invoices.create');
  const canViewInvoices = permissions.has('invoices.view');
  const canViewCash = permissions.has('cash.view');
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
  const needsBillingCashBootstrap = false;

  useEffect(() => {
    apiClient.onSessionExpired(() => {
      setUser(null);
      setCashSession(null);
      setStatus('Sesion vencida. Redirigiendo al login...');
      setSessionExpired(true);
    });

    if (initialPathRef.current === '/login') {
      setLoading(false);

      return () => apiClient.onSessionExpired(null);
    }

    apiClient
      .session()
      .then((currentUser) => {
        setUser(currentUser);
        if (currentUser) {
          setStatus('Sesion activa.');
        }
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));

    return () => apiClient.onSessionExpired(null);
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('Validando credenciales...');

    try {
      const loggedUser = await apiClient.login(login, password);
      setUser(loggedUser);
      setPassword('');
      setStatus(
        loggedUser.must_change_password
          ? 'El usuario debe cambiar su contrasena antes de operar.'
          : 'Sesion iniciada.',
      );
    } catch (error) {
      setStatus(userSafeErrorMessage(error, 'No se pudo iniciar sesion.'));
    }
  }

  async function handleLogout() {
    await apiClient.logout().catch(() => undefined);
    setUser(null);
    setCashSession(null);
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
      setStatus(userSafeErrorMessage(error, 'No se pudo actualizar la contrasena.'));
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
    canCreatePayments,
    canViewReceipts,
    canViewManagerialReports,
    canViewCashSessionReports,
    canExportReports,
    canViewReports,
    canViewBackups,
    hasAnyOperationalPermission:
      canViewFiscalSettings ||
      canViewCatalog ||
      canCreateInvoices ||
      canViewCash ||
      canViewInvoices ||
      canViewReports ||
      canViewBackups,
    defaultAuthenticatedRoute: '/dashboard',
    sessionExpired,
    handleLogin,
    handleLogout,
    handlePasswordSubmit,
  };
}
