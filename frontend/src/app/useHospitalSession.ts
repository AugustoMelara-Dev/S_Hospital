import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { type AuthUser, apiClient, userSafeErrorMessage } from '../lib/api';
import { disconnectEcho } from '../lib/realtime/echo';
import { type PasswordChangeForm } from '../features/auth/PasswordChangeView';

export function useHospitalSession() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  const [status, setStatus] = useState('Listo para iniciar sesión local.');
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [loginSubmitting, setLoginSubmitting] = useState(false);
  const loginSubmitInFlightRef = useRef(false);
  const sessionRevisionRef = useRef(0);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const passwordSubmitInFlightRef = useRef(false);
  const queryClient = useQueryClient();

  const permissions = useMemo(() => new Set(user?.permissions ?? []), [user?.permissions]);
  const canViewFiscalSettings = permissions.has('settings.fiscal.view');
  const canEditFiscalSettings = permissions.has('settings.fiscal.update');
  const canEditOperationalSettings = permissions.has('settings.operational.update');
  const canViewCatalog = permissions.has('catalog.view');
  const canManageCatalog = permissions.has('catalog.manage');
  const canCreateInvoices = permissions.has('invoices.create');
  const canViewInvoices = permissions.has('invoices.view');
  const canViewCash = permissions.has('cash.view');
  const canOpenCash = permissions.has('cash.open');
  const canCloseAnyCash = permissions.has('cash.close_any');
  const canCloseCash = permissions.has('cash.close') || canCloseAnyCash;
  const canCreatePayments = permissions.has('payments.create');
  const canViewReceipts = permissions.has('receipts.view');
  const canViewManagerialReports = permissions.has('reports.managerial.view');
  const canViewCashSessionReports = permissions.has('reports.cash_session.view');
  const canViewAuditReports = permissions.has('audit.view');
  const canExportReports = permissions.has('reports.export');
  const canViewReports =
    canViewManagerialReports ||
    canViewCashSessionReports ||
    canViewAuditReports;
  const canViewBackups = permissions.has('backups.view');
  const canViewSystemStatus = permissions.has('system.status.view');
  const canViewReceiptSettings = permissions.has('receipt_settings.view');
  const canViewUsers = permissions.has('users.view');
  const canCreateUsers = permissions.has('users.create');
  const canUpdateUsers = permissions.has('users.update');
  const canDisableUsers = permissions.has('users.disable');
  const canManageRoles = permissions.has('users.assign_admin_role');
  const canMarkDialysisPrescription = permissions.has('patients.mark_dialysis_prescription');

  useEffect(() => {
    const unsubscribe = apiClient.onSessionExpired(() => {
      sessionRevisionRef.current += 1;
      apiClient.invalidateSession();
      // Tear down realtime and the query cache so a stale Echo socket
      // and cached data from the previous user do not leak into the
      // next session on this PC.
      disconnectEcho();
      queryClient.clear();
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem('hospital_client_issue_log');
          window.sessionStorage.clear();
        } catch {
          // localStorage may be disabled in private mode; safe to ignore.
        }
      }
      setUser(null);
      setStatus('Sesión vencida. Inicie sesión nuevamente.');
      setSessionExpired(true);
    });

    return unsubscribe;
  }, [queryClient]);

  useEffect(() => {
    const unsubscribe = apiClient.onForceLogout(() => {
      sessionRevisionRef.current += 1;
      apiClient.invalidateSession();
      disconnectEcho();
      queryClient.clear();
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.removeItem('hospital_client_issue_log');
          window.sessionStorage.clear();
        } catch {
          // localStorage may be disabled in private mode; safe to ignore.
        }
      }
      setUser(null);
      setStatus('Sesión cerrada por el servidor. Inicie sesión nuevamente.');
      setSessionExpired(true);
    });

    return unsubscribe;
  }, [queryClient]);

  // The remaining session synchronization runs in a separate effect to
  // avoid running on every state change.
  useEffect(() => {
    const bootstrapRevision = sessionRevisionRef.current;
    let active = true;
    const isCurrentBootstrap = () => active && bootstrapRevision === sessionRevisionRef.current;

    apiClient
      .session()
      .then((currentUser) => {
        if (!isCurrentBootstrap()) return;
        setUser(currentUser);
        if (currentUser) {
          setStatus(
            currentUser.must_change_password
              ? 'Actualice su contraseña para continuar.'
              : 'Sesión activa.',
          );
          setSessionExpired(false);
        }
      })
      .catch(() => {
        if (!isCurrentBootstrap()) return;
        setUser(null);
        setSessionExpired(false);
        setStatus('Listo para iniciar sesión local.');
      })
      .finally(() => {
        if (isCurrentBootstrap()) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loginSubmitInFlightRef.current) return;

    // Any bootstrap response that started before this explicit login is stale.
    // Without this revision guard, a late `data: null` can erase a successful
    // login and flash "Sesión vencida" immediately after authentication.
    sessionRevisionRef.current += 1;
    loginSubmitInFlightRef.current = true;
    setLoginSubmitting(true);
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
    } finally {
      loginSubmitInFlightRef.current = false;
      setLoginSubmitting(false);
      setLoading(false);
    }
  }

  async function handleLogout() {
    sessionRevisionRef.current += 1;
    await apiClient.logout().catch(() => undefined);
    // Drop the cached CSRF promise so the next login fetches a token
    // for the current browser session before posting credentials.
    apiClient.invalidateSession();
    // Tear down realtime, the TanStack Query cache, and any persisted
    // client-side issue log so the next user on the same browser
    // cannot see the previous cashier's operational metadata.
    disconnectEcho();
    queryClient.clear();
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('hospital_client_issue_log');
        window.sessionStorage.clear();
      } catch {
        // localStorage may be disabled in private mode; safe to ignore.
      }
    }
    setUser(null);
    setStatus('Sesión cerrada.');
  }


  async function handlePasswordSubmit(data: PasswordChangeForm) {
    if (passwordSubmitInFlightRef.current) return;

    passwordSubmitInFlightRef.current = true;
    setPasswordSubmitting(true);
    setStatus('Actualizando contraseña...');

    try {
      const updatedUser = await apiClient.changePassword(data);
      setUser(updatedUser);
      setStatus('Contraseña actualizada.');
    } catch (error) {
      setStatus(userSafeErrorMessage(error, 'No se pudo actualizar la contraseña.'));
    } finally {
      passwordSubmitInFlightRef.current = false;
      setPasswordSubmitting(false);
    }
  }

  return {
    user,
    login,
    setLogin,
    password,
    setPassword,

    status,
    setStatus,
    loading,
    loginSubmitting,
    passwordSubmitting,
    canViewFiscalSettings,
    canEditFiscalSettings,
    canEditOperationalSettings,
    canViewCatalog,
    canManageCatalog,
    canCreateInvoices,
    canViewInvoices,
    canViewCash,
    canOpenCash,
    canCloseAnyCash,
    canCloseCash,
    canCreatePayments,
    canViewReceipts,
    canViewManagerialReports,
    canViewCashSessionReports,
    canViewAuditReports,
    canExportReports,
    canViewReports,
    canViewBackups,
    canViewReceiptSettings,
    canViewUsers,
    canCreateUsers,
    canUpdateUsers,
    canDisableUsers,
    canManageRoles,
    canMarkDialysisPrescription,
    hasAnyOperationalPermission:
      canViewFiscalSettings ||
      canEditOperationalSettings ||
      canViewCatalog ||
      canManageCatalog ||
      canCreateInvoices ||
      canViewCash ||
      canViewInvoices ||
      canViewReports ||
      canViewBackups ||
      canViewUsers ||
      canViewSystemStatus ||
      canViewReceiptSettings,
    defaultAuthenticatedRoute: canViewSystemStatus && !canViewCatalog && !canCreateInvoices ? '/help' : '/dashboard',
    sessionExpired,
    handleLogin,
    handleLogout,
    handlePasswordSubmit,
  };
}
