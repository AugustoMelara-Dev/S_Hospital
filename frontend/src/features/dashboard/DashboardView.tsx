import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileTextOutlined, WalletOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Flex,
  Skeleton,
  Tag,
  Typography,
} from 'antd';
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

// Status label and color map — single source of truth for invoice status tags.
const INVOICE_STATUS_TAG: Record<string, { label: string; color: string }> = {
  paid:    { label: 'Pagada',   color: 'success' },
  pending: { label: 'Pendiente', color: 'warning' },
  void:    { label: 'Anulada',  color: 'error' },
  partial: { label: 'Parcial',  color: 'processing' },
};

function InvoiceStatusTag({ status }: { status: string }) {
  const cfg = INVOICE_STATUS_TAG[status];
  return cfg
    ? <Tag color={cfg.color}>{cfg.label}</Tag>
    : <Tag>{status}</Tag>;
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
    ? { label: 'Nueva factura', icon: <FileTextOutlined aria-hidden="true" />, to: '/billing/new' }
    : setupReady && !setupRequired && !cashIsOpen && canOpenCash
      ? { label: 'Abrir caja', icon: <WalletOutlined aria-hidden="true" />, to: '/cashbox' }
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
  const primaryHeaderAction = setupAction?.kind === 'wizard' ? (
    <Button type="primary" onClick={() => setIsWizardOpen(true)} size="large">
      {setupAction.label}
    </Button>
  ) : setupAction?.kind === 'link' ? (
    <Link to={setupAction.to}>
      <Button type="primary" size="large">
        {setupAction.label}
      </Button>
    </Link>
  ) : primaryAction ? (
    <Link to={primaryAction.to}>
      <Button type="primary" icon={primaryAction.icon} size="large">
        {primaryAction.label}
      </Button>
    </Link>
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
  if (queueItems.length === 0) {
    queueItems.push({
      id: 'idle',
      title: 'Turno sin acciones disponibles',
      description: 'Consulte los módulos habilitados para su rol.',
      priority: 'normal',
    });
  }

  return (
    <section aria-labelledby="dashboard-title" className="flex min-w-0 flex-col gap-6">
      <Flex justify="space-between" align="start" wrap="wrap" gap="middle">
        <div>
          <Typography.Title id="dashboard-title" level={1} className="m-0">
            Continuar operación
          </Typography.Title>
          <span>
            <Typography.Text type="secondary" className="text-xs font-semibold uppercase tracking-wider">
              Centro operativo ·{' '}
            </Typography.Text>
            Estado del turno: <Typography.Text strong>{cashIsOpen ? `Caja abierta #${cashSession?.id}` : 'Caja cerrada'}</Typography.Text>
          </span>
        </div>
        {primaryHeaderAction}
      </Flex>

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
          <section aria-labelledby="recent-invoices-title" className="min-w-0 border border-border bg-surface">
            <header className="border-b border-border px-5 py-4">
              <Flex justify="space-between" align="center" wrap="wrap" gap="small">
                <div>
                  <Typography.Text type="secondary" className="text-xs font-semibold uppercase tracking-wider">Actividad</Typography.Text>
                  <Typography.Title id="recent-invoices-title" level={2} className="m-0 mt-1">Facturas recientes</Typography.Title>
                </div>
                <Link to="/invoices">
                  <Button type="link" size="small">Ver historial completo</Button>
                </Link>
              </Flex>
            </header>
            <div className="min-w-0 p-4 sm:p-5">
              {loadingRecent ? (
                <Skeleton active={false} paragraph={{ rows: 3 }} title={false} />
              ) : recentInvoicesError ? (
                <RouteState
                  kind="error"
                  title="Facturas recientes no disponibles"
                  description={recentInvoicesError}
                  headingLevel={2}
                  action={{ label: 'Reintentar facturas recientes', onClick: () => void loadRecentInvoices() }}
                />
              ) : recentInvoices.length === 0 ? (
                <Alert type="info" showIcon title="Sin facturas recientes" description={cashIsOpen ? 'La actividad del turno aparecerá aquí.' : 'Abra caja para iniciar la actividad del turno.'} />
              ) : (
                <section aria-label="Facturas recientes">
                  <Flex vertical role="list">
                    {recentInvoices.map((invoice) => (
                      <Flex key={invoice.id} role="listitem" vertical gap="small" className="border-b border-border py-3 last:border-b-0">
                        <Flex gap="small" align="center" wrap="wrap">
                          <Link to={`/invoices?invoice=${invoice.id}`}>
                            <Typography.Text strong className="text-primary hover:underline cursor-pointer">
                              {invoice.invoice_number}
                            </Typography.Text>
                          </Link>
                          <InvoiceStatusTag status={invoice.status} />
                          {canViewManagerialReports ? (
                            <Typography.Text className="tabular-nums">
                              {formatLempirasUIFromCents(parseCents(invoice.total))}
                            </Typography.Text>
                          ) : null}
                        </Flex>
                        <Flex gap="middle" wrap="wrap">
                          <Typography.Text type="secondary">{invoice.patient_name}</Typography.Text>
                          <Typography.Text type="secondary">{formatDateTimeEs(invoice.issued_at)}</Typography.Text>
                        </Flex>
                      </Flex>
                    ))}
                  </Flex>
                </section>
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
  return <Skeleton.Input active={false} size="small" />;
}

function moneyOrUnavailable(value: string | number | null | undefined) {
  return value === null || value === undefined ? 'No disponible' : formatLempirasUIFromCents(parseCents(value));
}
