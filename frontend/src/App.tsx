import { useEffect } from 'react';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AppRoutes } from './AppRoutes';
import { useHospitalSession } from './app/useHospitalSession';
import { Dialog } from './components/ui/dialog';
import { EmptyState, LoadingState } from './components/ui/states';
import { LoginView } from './features/auth/LoginView';
import { PasswordChangeView } from './features/auth/PasswordChangeView';
import { CashBoxView } from './features/cash/CashBoxView';
import { NewInvoiceView } from './features/invoices/NewInvoiceView';
import { AppShell } from './layout/AppShell';
import { queryClient } from './lib/query-client';
import { apiClient } from './lib/api';
import { Toaster } from './components/ui/toaster';import { useFiscalSettings } from './hooks/useFiscalSettings';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <HospitalApp />
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function HospitalApp() {
  const session = useHospitalSession();
  const navigate = useNavigate();
  const [quickInvoiceOpen, setQuickInvoiceOpen] = useState(false);
  const [quickCashOpen, setQuickCashOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const { data: fiscal } = useFiscalSettings();

  useEffect(() => {
    if (!fiscal?.primary_color) return;

    const colors = {
      indigo: { primary: '#4f46e5', accent: '#f5f3ff', hover: '#4338ca' },
      blue: { primary: '#2563eb', accent: '#eff6ff', hover: '#1d4ed8' },
      teal: { primary: '#0d9488', accent: '#f0fdfa', hover: '#0f766e' },
      green: { primary: '#16a34a', accent: '#f0fdf4', hover: '#15803d' },
      rose: { primary: '#e11d48', accent: '#fff1f2', hover: '#be123c' },
    };

    const theme = colors[fiscal.primary_color] || colors.indigo;

    document.documentElement.style.setProperty('--color-secondary', theme.primary);
    document.documentElement.style.setProperty('--color-ring', theme.primary);
    document.documentElement.style.setProperty('--color-sidebar-primary', theme.primary);
    document.documentElement.style.setProperty('--color-accent', theme.accent);
    document.documentElement.style.setProperty('--color-accent-foreground', theme.primary);
  }, [fiscal?.primary_color]);

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
      />
    );
  }

  return (
    <AppShell
      cashSession={session.cashSession}
      onQuickCash={() => setQuickCashOpen(true)}
      onQuickInvoice={() => setQuickInvoiceOpen(true)}
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
      ) : session.cashBootstrapLoading ? (
        <LoadingState label="Validando caja para facturacion..." />
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
          cashSession={session.cashSession}
          defaultAuthenticatedRoute={session.defaultAuthenticatedRoute}
          onQuickCash={() => setQuickCashOpen(true)}
          onQuickInvoice={() => setQuickInvoiceOpen(true)}
          onCashSessionChange={session.setCashSession}
          onStatus={session.setStatus}
          user={session.user}
        />
      )}

      <Dialog
        open={quickInvoiceOpen}
        onOpenChange={setQuickInvoiceOpen}
        size="fullscreen"
        title="Emitir factura"
        description="POS rapido en modal para facturar sin abandonar el contexto actual."
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
          onStatus={session.setStatus}
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
          onStatus={session.setStatus}
          onSessionChange={session.setCashSession}
          compact
        />
      </Dialog>
    </AppShell>
  );
}
