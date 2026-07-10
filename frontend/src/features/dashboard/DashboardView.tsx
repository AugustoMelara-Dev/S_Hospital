import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ReceiptText, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { RouteState } from '@/design-system/patterns/RouteState';
import { useDashboardReport } from '@/hooks/useDashboardReport';
import { type CashSession, type Invoice, apiClient, userSafeErrorMessage } from '@/lib/api';
import { formatDateTimeEs } from '@/lib/format/formatDate';
import { finiteNumber } from '@/lib/money';
import { formatLempirasUIFromCents, parseCents } from '@/lib/moneyCents';
import { OperationalQueue, type OperationalQueueItem } from './components/OperationalQueue';
import { SetupWizardDialog } from './components/SetupWizardDialog';
import { TodayLedger, type TodayLedgerItem } from './components/TodayLedger';
import { type SetupStatus } from './components/dashboardTypes';

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
  onStatus: (message: string) => void;
};

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
}: DashboardViewProps) {
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [setupStatusState, setSetupStatusState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [setupStatusError, setSetupStatusError] = useState('');
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [recentInvoicesError, setRecentInvoicesError] = useState('');
  const [loadingRecent, setLoadingRecent] = useState(false);
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
    try {
      setSetupStatus(await apiClient.request<SetupStatus>('/api/system/setup-status'));
      setSetupStatusState('ready');
    } catch (error) {
      setSetupStatus(null);
      setSetupStatusError(userSafeErrorMessage(error, 'No se pudo confirmar la configuración operativa.'));
      setSetupStatusState('error');
    }
  }, []);

  useEffect(() => {
    void loadSetupStatus();
  }, [loadSetupStatus]);

  const setupReady = setupStatusState === 'ready';
  const setupRequired = setupReady && setupStatus?.needs_setup === true;
  const primaryAction = setupReady && !setupRequired && cashIsOpen && canCreateInvoices
    ? { label: 'Nueva factura', icon: <ReceiptText aria-hidden="true" />, to: '/billing/new' }
    : setupReady && !setupRequired && !cashIsOpen && canOpenCash
      ? { label: 'Abrir caja', icon: <WalletCards aria-hidden="true" />, to: '/cashbox' }
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
          ? { kind: 'link' as const, label: 'Completar catálogo', to: '/catalog' }
          : null;
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
  if (queueItems.length === 0) {
    queueItems.push({
      id: 'idle',
      title: 'Turno sin acciones disponibles',
      description: 'Consulte los módulos habilitados para su rol.',
      priority: 'normal',
    });
  }

  const invoiceColumns: Array<DataTableColumn<Invoice>> = [
    { key: 'invoice_number', header: 'Número', cellClassName: 'font-mono tabular-nums', render: (invoice) => invoice.invoice_number },
    { key: 'issued_at', header: 'Fecha', render: (invoice) => formatDateTimeEs(invoice.issued_at) },
    { key: 'patient_name', header: 'Paciente', render: (invoice) => invoice.patient_name },
    { key: 'status', header: 'Estado', render: (invoice) => invoice.status },
  ];
  if (canViewManagerialReports) {
    invoiceColumns.splice(3, 0, {
      key: 'total',
      header: 'Total',
      numeric: true,
      render: (invoice) => formatLempirasUIFromCents(parseCents(invoice.total)),
    });
  }

  return (
    <section aria-labelledby="dashboard-title" className="flex min-w-0 flex-col gap-6">
      <header className="relative isolate overflow-hidden rounded-2xl bg-[#0c2733] px-5 py-7 text-white shadow-[0_28px_70px_-48px_rgba(4,20,28,.95)] sm:flex sm:items-end sm:justify-between sm:gap-8 sm:px-7 sm:py-9">
        <div className="absolute -right-24 -top-28 -z-10 size-80 rounded-full border border-[#55d3bf]/20 bg-[#55d3bf]/5" aria-hidden="true" />
        <div className="min-w-0 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#80dfd0]">Inicio operativo</p>
          <h1 id="dashboard-title" className="mt-3 text-3xl font-semibold leading-[1.08] tracking-[-0.04em] text-white sm:text-4xl">
            Continuar operación
          </h1>
          <p className="mt-4 text-sm leading-6 text-white/65">
            Estado del turno: <strong className="font-semibold text-white">{cashIsOpen ? `Caja abierta #${cashSession?.id}` : 'Caja cerrada'}</strong>
          </p>
        </div>
        {setupAction?.kind === 'wizard' ? (
          <Button type="button" onClick={() => setIsWizardOpen(true)} className="mt-6 min-h-12 w-full bg-[#55d3bf] text-[#071c24] hover:bg-[#76dfcf] sm:mt-0 sm:w-auto">
            {setupAction.label}
          </Button>
        ) : setupAction?.kind === 'link' ? (
          <Button asChild className="mt-6 min-h-12 w-full bg-[#55d3bf] text-[#071c24] hover:bg-[#76dfcf] sm:mt-0 sm:w-auto">
            <Link to={setupAction.to}>{setupAction.label}</Link>
          </Button>
        ) : primaryAction ? (
          <Button asChild className="mt-6 min-h-12 w-full bg-[#55d3bf] text-[#071c24] hover:bg-[#76dfcf] sm:mt-0 sm:w-auto">
            <Link to={primaryAction.to}>
              {primaryAction.icon}
              {primaryAction.label}
            </Link>
          </Button>
        ) : null}
      </header>

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

      <div className={`grid min-w-0 gap-6 ${canViewInvoices ? 'xl:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.28fr)]' : ''}`}>
        <OperationalQueue items={queueItems} />

        {canViewInvoices ? (
          <section aria-labelledby="recent-invoices-title" className="min-w-0 overflow-hidden rounded-xl border border-operational-border bg-operational-surface shadow-operational">
            <header className="flex items-center justify-between gap-3 border-b border-operational-border bg-muted/35 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Actividad</p>
                <h2 id="recent-invoices-title" className="mt-1 text-lg font-semibold">Facturas recientes</h2>
              </div>
              <Button asChild variant="ghost" size="sm" className="min-h-11 sm:min-h-11">
                <Link to="/invoices">Ver historial completo</Link>
              </Button>
            </header>
            <div className="min-w-0 p-4 sm:p-5">
              {loadingRecent ? (
                <div role="status" aria-label="Cargando facturas recientes" className="space-y-3">
                  <span className="sr-only">Cargando facturas recientes...</span>
                  {[1, 2, 3].map((row) => (
                    <div key={row} className="h-11 w-full animate-pulse rounded bg-muted motion-reduce:animate-none" aria-hidden="true" />
                  ))}
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
                <div className="border-l-2 border-muted-foreground/40 py-2 pl-4">
                  <p className="font-semibold">Sin facturas recientes</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {cashIsOpen ? 'La actividad del turno aparecerá aquí.' : 'Abra caja para iniciar la actividad del turno.'}
                  </p>
                </div>
              ) : (
                <DataTable
                  containerLabel="Facturas recientes"
                  rows={recentInvoices}
                  columns={invoiceColumns}
                  getRowKey={(invoice) => invoice.id}
                  emptyTitle="Sin facturas recientes"
                />
              )}
            </div>
          </section>
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
  return <span className="inline-block h-7 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" aria-hidden="true" />;
}

function moneyOrUnavailable(value: string | number | null | undefined) {
  return value === null || value === undefined ? 'No disponible' : formatLempirasUIFromCents(parseCents(value));
}
