import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Wallet } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RouteState } from '@/design-system/patterns/RouteState';
import { PageHeader } from '@/design-system/components/PageHeader';
import { useDashboardReport } from '@/hooks/useDashboardReport';
import { type CashSession, type Invoice, apiClient, userSafeErrorMessage } from '@/lib/api';
import { formatDateTimeEs } from '@/lib/format/formatDate';
import { finiteNumber } from '@/lib/money';
import { formatLempirasUIFromCents, parseCents } from '@/lib/moneyCents';
import { OperationalQueue, type OperationalQueueItem } from './components/OperationalQueue';
import { SetupWizardDialog, type SetupStatus } from './components/SetupWizardDialog';
import { TodayLedger, type TodayLedgerItem } from './components/TodayLedger';
import type { OperationalStatusReporter } from '@/app/operationalStatus';

type DashboardViewProps = {
  canCreateInvoices: boolean;
  canEditFiscalSettings: boolean;
  canManageCatalog: boolean;
  canOpenCash: boolean;
  canViewBackups: boolean;
  canViewCatalog: boolean;
  canViewFiscalSettings: boolean;
  canViewInvoices: boolean;
  canViewManagerialReports: boolean;
  canViewReports: boolean;
  cashSession: CashSession | null;
  invoiceAccessDeniedReason?: string;
  onStatus: OperationalStatusReporter;
};

// Status label and color map — single source of truth for invoice status tags.
const INVOICE_STATUS_TAG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  paid:    { label: 'Pagada', variant: 'default' },
  pending: { label: 'Pendiente', variant: 'secondary' },
  void:    { label: 'Anulada', variant: 'destructive' },
  partial: { label: 'Parcial', variant: 'outline' },
};

function InvoiceStatusTag({ status }: { status: string }) {
  const cfg = INVOICE_STATUS_TAG[status];
  return cfg
    ? <Badge variant={cfg.variant}>{cfg.label}</Badge>
    : <Badge variant="outline">{status}</Badge>;
}

export function DashboardView({
  canCreateInvoices,
  canEditFiscalSettings,
  canManageCatalog,
  canOpenCash,
  canViewCatalog,
  canViewFiscalSettings,
  canViewInvoices,
  canViewManagerialReports,
  cashSession,
  invoiceAccessDeniedReason,
}: DashboardViewProps) {
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [setupStatusState, setSetupStatusState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [setupStatusError, setSetupStatusError] = useState('');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [recentInvoicesError, setRecentInvoicesError] = useState('');
  const [loadingRecent, setLoadingRecent] = useState(false);
  const setupStatusRequestRef = useRef<Promise<SetupStatus> | null>(null);
  const dashboardQuery = useDashboardReport(canViewManagerialReports);
  const dashboardData = dashboardQuery.data ?? null;
  const dashboardError = dashboardQuery.isError
    ? userSafeErrorMessage(dashboardQuery.error, 'No se pudo cargar el resumen.')
    : '';
  const todaySnapshot = dashboardData?.last_7_days.at(-1) ?? null;
  const cashIsOpen = Boolean(cashSession);
  const totalPending = dashboardData?.current_month.total_pending ?? null;

  const loadRecentInvoices = useCallback(async () => {
    if (!canViewInvoices) return;

    setLoadingRecent(true);
    setRecentInvoicesError('');
    try {
      const data = await apiClient.getInvoices({ page: 1, per_page: 5 });
      setRecentInvoices(Array.isArray(data.data) ? (data.data as Invoice[]) : []);
    } catch (error) {
      setRecentInvoicesError(userSafeErrorMessage(error, 'No se pudieron cargar las facturas recientes.'));
    } finally {
      setLoadingRecent(false);
    }
  }, [canViewInvoices]);

  useEffect(() => {
    void loadRecentInvoices();
  }, [loadRecentInvoices]);

  const loadSetupStatus = useCallback(async () => {
    setSetupStatusState('loading');
    setSetupStatusError('');
    const request = setupStatusRequestRef.current
      ?? apiClient.request<SetupStatus>('/api/system/setup-status');
    setupStatusRequestRef.current = request;

    try {
      setSetupStatus(await request);
      setSetupStatusState('ready');
    } catch (error) {
      setSetupStatus(null);
      setSetupStatusError(userSafeErrorMessage(error, 'No se pudo confirmar la configuración operativa.'));
      setSetupStatusState('error');
    } finally {
      if (setupStatusRequestRef.current === request) {
        setupStatusRequestRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void loadSetupStatus();
  }, [loadSetupStatus]);

  const setupReady = setupStatusState === 'ready';
  const setupRequired = setupReady && setupStatus?.needs_setup === true;
  const primaryAction = setupReady && !setupRequired && cashIsOpen && canCreateInvoices
    ? { label: 'Nueva factura', icon: <FileText aria-hidden="true" />, to: '/billing/new' }
    : setupReady && !setupRequired && !cashIsOpen && canOpenCash
      ? { label: 'Abrir caja', icon: <Wallet aria-hidden="true" />, to: '/cashbox' }
      : null;

  const ledgerLoading = dashboardQuery.isFetching;
  const hasCachedDashboardData = dashboardQuery.isError && dashboardData !== null;
  const ledgerUnavailable = dashboardQuery.isError || (!ledgerLoading && dashboardData === null);

  const ledgerItems: TodayLedgerItem[] = [
    {
      id: 'cash',
      label: 'Caja',
      value: cashIsOpen ? `Caja #${cashSession?.id}` : 'Cerrada',
      note: cashIsOpen ? 'Turno listo para cobrar' : 'Sin sesión de caja activa',
      tone: cashIsOpen ? 'success' : 'attention',
    },
    {
      id: 'billed',
      label: 'Facturado',
      value: ledgerLoading ? <LedgerSkeleton /> : moneyOrUnavailable(todaySnapshot?.total_billed),
      note: ledgerLoading
        ? 'Cargando facturación de hoy'
        : hasCachedDashboardData && todaySnapshot?.invoice_count !== null && todaySnapshot?.invoice_count !== undefined
          ? `Último dato conocido · ${finiteNumber(todaySnapshot.invoice_count)} facturas registradas`
        : ledgerUnavailable || todaySnapshot?.invoice_count === null || todaySnapshot?.invoice_count === undefined
          ? 'Actividad no disponible'
          : `${finiteNumber(todaySnapshot.invoice_count)} facturas registradas hoy`,
      tone: 'neutral',
    },
    {
      id: 'collected',
      label: 'Cobrado',
      value: ledgerLoading ? <LedgerSkeleton /> : moneyOrUnavailable(todaySnapshot?.total_collected),
      note: ledgerLoading
        ? 'Cargando pagos de hoy'
        : hasCachedDashboardData && todaySnapshot?.payment_count !== null && todaySnapshot?.payment_count !== undefined
          ? `Último dato conocido · ${finiteNumber(todaySnapshot.payment_count)} pagos recibidos`
        : ledgerUnavailable || todaySnapshot?.payment_count === null || todaySnapshot?.payment_count === undefined
          ? 'Actividad no disponible'
          : `${finiteNumber(todaySnapshot.payment_count)} pagos recibidos hoy`,
      tone: 'success',
    },
    {
      id: 'pending',
      label: 'Pendiente',
      value: ledgerLoading ? <LedgerSkeleton /> : moneyOrUnavailable(totalPending),
      note: ledgerLoading
        ? 'Cargando saldos del mes'
        : hasCachedDashboardData && totalPending !== null && totalPending !== undefined
          ? 'Último dato conocido · saldo pendiente del mes'
        : ledgerUnavailable || totalPending === null || totalPending === undefined
          ? 'Saldo no disponible'
          : finiteNumber(totalPending) > 0
            ? 'Saldo pendiente del mes'
            : 'Sin saldo pendiente',
      tone: totalPending !== null && totalPending !== undefined && finiteNumber(totalPending) > 0 ? 'attention' : 'neutral',
    },
  ];

  const queueItems: OperationalQueueItem[] = [];
  const canConfigureFiscal = canViewFiscalSettings && canEditFiscalSettings;
  const canConfigureCatalog = canViewCatalog && canManageCatalog;
  const missingAdminSetup = setupRequired && setupStatus?.steps.admin_exists === false;
  const missingFiscalSetup = setupRequired && (
    setupStatus?.steps.fiscal_settings === false || setupStatus?.steps.fiscal_sequence_exists === false
  );
  const missingCatalogSetup = setupRequired && setupStatus?.steps.catalog_has_services === false;
  const setupAction = !setupRequired || missingAdminSetup
    ? null
    : missingFiscalSetup && missingCatalogSetup && canConfigureFiscal && canConfigureCatalog
      ? { kind: 'wizard' as const, label: 'Completar configuración' }
      : missingFiscalSetup && !missingCatalogSetup && canConfigureFiscal
        ? { kind: 'link' as const, label: 'Completar configuración fiscal', to: '/settings/fiscal' }
        : missingCatalogSetup && !missingFiscalSetup && canConfigureCatalog
          ? { kind: 'link' as const, label: 'Completar catálogo', to: '/catalog?panel=new-service' }
          : null;
  const primaryHeaderAction = setupAction?.kind === 'wizard' ? (
    <Button onClick={() => setIsWizardOpen(true)} size="lg">
      {setupAction.label}
    </Button>
  ) : setupAction?.kind === 'link' ? (
    <Button asChild size="lg">
      <Link to={setupAction.to}>
        {setupAction.label}
      </Link>
    </Button>
  ) : primaryAction ? (
    <Button asChild size="lg">
      <Link to={primaryAction.to}>
        {primaryAction.icon}
        {primaryAction.label}
      </Link>
    </Button>
  ) : null;
  if (setupReady && setupStatus?.needs_setup) {
    queueItems.push({
      id: 'setup',
      title: 'Configuración pendiente',
      description: missingAdminSetup
        ? 'Un técnico autorizado debe crear o restaurar el usuario administrador antes de continuar.'
        : setupAction
          ? 'Complete los pasos pendientes antes de continuar la operación.'
          : 'Solicite a un administrador que complete hospital, numeración fiscal y catálogo.',
      priority: 'danger',
    });
  }
  if (!cashIsOpen) {
    queueItems.push({
      id: 'cash',
      title: 'Caja cerrada',
      description: canOpenCash ? 'Abra una sesión para registrar cobros y facturas.' : 'No hay una sesión de caja activa.',
      priority: canOpenCash ? 'attention' : 'normal',
    });
  }
  if (
    canViewManagerialReports
    && !dashboardQuery.isError
    && totalPending !== null
    && totalPending !== undefined
    && finiteNumber(totalPending) > 0
  ) {
    queueItems.push({
      id: 'pending',
      title: 'Cobros pendientes',
      description: `${formatLempirasUIFromCents(parseCents(totalPending))} pendientes durante el mes actual.`,
      href: canViewInvoices ? '/invoices' : undefined,
      actionLabel: canViewInvoices ? 'Revisar pendientes' : undefined,
      priority: 'attention',
    });
  }
  if (setupReady && !setupRequired && cashIsOpen && canCreateInvoices) {
    queueItems.push({
      id: 'billing',
      title: 'Facturación disponible',
      description: 'La caja está lista para emitir la siguiente factura del turno.',
      priority: 'normal',
    });
  }
  if (setupReady && !setupRequired && cashIsOpen && !canCreateInvoices && invoiceAccessDeniedReason) {
    queueItems.push({
      id: 'billing-access',
      title: 'Facturación no disponible',
      description: invoiceAccessDeniedReason,
      priority: 'attention',
    });
  }
  if (queueItems.length === 0) {
    queueItems.push({
      id: 'idle',
      title: 'Turno sin acciones disponibles',
      description: 'Consulte los módulos habilitados para su rol.',
      priority: 'normal',
    });
  }

  return (
    <section aria-label="Panel principal" className="flex min-w-0 flex-col gap-6">
      <PageHeader
        eyebrow="Centro operativo"
        title="Continuar operación"
        description={<>Estado del turno: <strong className="text-foreground">{cashIsOpen ? `Caja abierta #${cashSession?.id}` : 'Caja cerrada'}</strong></>}
        actions={primaryHeaderAction}
      />

      {canViewManagerialReports ? <TodayLedger items={ledgerItems} /> : null}

      {dashboardError ? (
        <RouteState
          kind="error"
          title="Resumen no disponible"
          description={dashboardError}
          headingLevel={2}
          action={{ label: 'Reintentar', onClick: () => void dashboardQuery.refetch() }}
        />
      ) : null}

      {setupStatusState === 'loading' ? (
        <RouteState
          kind="loading"
          title="Verificando configuración operativa"
          description="Confirmando que el hospital esté listo antes de habilitar acciones de caja y facturación."
          headingLevel={2}
        />
      ) : setupStatusState === 'error' ? (
        <RouteState
          kind="error"
          title="No se pudo verificar la configuración"
          description={setupStatusError}
          headingLevel={2}
          action={{ label: 'Reintentar configuración', onClick: () => void loadSetupStatus() }}
        />
      ) : null}

      <div className={`grid min-w-0 gap-6 ${canViewInvoices ? 'xl:grid-cols-2' : ''}`}>
        <OperationalQueue items={queueItems} />

        {canViewInvoices ? (
          <Card className="min-w-0" role="region" aria-labelledby="recent-invoices-title">
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <CardDescription className="text-xs font-semibold uppercase tracking-wider">Actividad</CardDescription>
                <CardTitle><h2 id="recent-invoices-title">Facturas recientes</h2></CardTitle>
              </div>
              <Button asChild variant="ghost" size="sm"><Link to="/invoices">Ver historial completo</Link></Button>
            </CardHeader>
            <CardContent className="min-w-0">
              {loadingRecent ? (
                <div className="flex flex-col gap-3" aria-label="Cargando facturas recientes">
                  <Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" />
                </div>
              ) : recentInvoicesError ? (
                <RouteState
                  kind="error"
                  title="Facturas recientes no disponibles"
                  description={recentInvoicesError}
                  headingLevel={2}
                  action={{ label: 'Reintentar facturas recientes', onClick: () => void loadRecentInvoices() }}
                />
              ) : recentInvoices.length === 0 ? (
                <Alert><AlertTitle>Sin facturas recientes</AlertTitle><AlertDescription>{cashIsOpen ? 'La actividad del turno aparecerá aquí.' : 'Abra caja para iniciar la actividad del turno.'}</AlertDescription></Alert>
              ) : (
                <section aria-label="Facturas recientes">
                  <div role="list" className="flex flex-col">
                    {recentInvoices.map((invoice) => (
                      <div key={invoice.id} role="listitem" className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link to={`/invoices?invoice=${invoice.id}`}>
                            <strong className="cursor-pointer text-primary hover:underline">{invoice.invoice_number}</strong>
                          </Link>
                          <InvoiceStatusTag status={invoice.status} />
                          {canViewManagerialReports ? (
                            <strong className="ml-auto font-mono tabular-nums text-foreground">{formatLempirasUIFromCents(parseCents(invoice.total))}</strong>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span>{invoice.patient_name}</span><span>{formatDateTimeEs(invoice.issued_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {canConfigureFiscal && canConfigureCatalog && !missingAdminSetup ? (
        <SetupWizardDialog
          open={isWizardOpen}
          onOpenChange={setIsWizardOpen}
          onComplete={() => {
            void loadSetupStatus();
            void dashboardQuery.refetch();
          }}
        />
      ) : null}
    </section>
  );
}

function LedgerSkeleton() {
  return <Skeleton className="inline-block h-5 w-20 align-middle" />;
}

function moneyOrUnavailable(value: string | number | null | undefined) {
  return value === null || value === undefined ? 'No disponible' : formatLempirasUIFromCents(parseCents(value));
}
