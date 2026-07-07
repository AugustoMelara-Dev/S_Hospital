import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, ReceiptText, TrendingUp, WalletCards } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { StatGrid } from '@/components/shared';
import { type CashSession, type Invoice, apiClient, userSafeErrorMessage } from '@/lib/api';
import { formatDateTimeEs } from '@/lib/format/formatDate';
import { formatLempirasUI } from '@/lib/money';
import { finiteNumber } from '@/lib/money';
import { formatLempirasUIFromCents, parseCents } from '@/lib/moneyCents';
import { LoadingState } from '@/components/ui/states';
import { useDashboardReport } from '@/hooks/useDashboardReport';
import { DashboardSetupStatusCard } from './components/DashboardSetupStatusCard';
import { SetupWizardDialog } from './components/SetupWizardDialog';
import { type SetupStatus } from './components/dashboardTypes';

type DashboardViewProps = {
  canCreateInvoices: boolean;
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
  canOpenCash,
  canViewFiscalSettings,
  canViewInvoices,
  canViewManagerialReports,
  cashSession,
  onStatus,
}: DashboardViewProps) {
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const dashboardQuery = useDashboardReport(canViewManagerialReports);
  const dashboardData = dashboardQuery.data ?? null;
  const dashboardError = dashboardQuery.isError
    ? userSafeErrorMessage(dashboardQuery.error, 'No se pudo cargar el resumen.')
    : '';
  const loadingDashboard = dashboardQuery.isFetching;

  const todaySnapshot = dashboardData?.last_7_days.at(-1) ?? null;
  const cashIsOpen = Boolean(cashSession);
  const totalPending = dashboardData?.current_month.total_pending ?? null;

  async function loadRecentInvoices() {
    if (!canViewInvoices) return;
    setLoadingRecent(true);
    try {
      const data = await apiClient.getInvoices({ page: 1, per_page: 5 });
      setRecentInvoices(Array.isArray(data.data) ? (data.data as Invoice[]) : []);
    } catch {
      setRecentInvoices([]);
    } finally {
      setLoadingRecent(false);
    }
  }

  async function loadSetupStatus() {
    if (!canViewFiscalSettings && !canViewManagerialReports) return;
    try {
      const res = await apiClient.request<SetupStatus>('/api/system/setup-status');
      setSetupStatus(res);
    } catch {
      setSetupStatus(null);
    }
  }

  useEffect(() => {
    void loadSetupStatus();
    void loadRecentInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewFiscalSettings, canViewInvoices]);

  useEffect(() => {
    if (dashboardError) {
      onStatus(dashboardError);
    }
  }, [dashboardError, onStatus]);

  const moneyValue = (value: string | number | null | undefined, hasData: boolean) => {
    if (loadingDashboard) return <span className="inline-block h-7 w-24 rounded-md bg-muted" aria-hidden="true" />;
    return hasData ? formatLempirasUI(value) : 'Sin datos';
  };

  const primaryAction = cashIsOpen && canCreateInvoices
    ? { label: 'Nueva factura', icon: <ReceiptText aria-hidden="true" className="size-4" />, to: '/billing/new' }
    : canOpenCash
      ? { label: 'Abrir caja', icon: <WalletCards aria-hidden="true" className="size-4" />, to: '/cashbox' }
      : null;

  const showTodayBilled = todaySnapshot?.total_billed !== null && todaySnapshot?.total_billed !== undefined;
  const showTodayCollected = todaySnapshot?.total_collected !== null && todaySnapshot?.total_collected !== undefined;
  const showPending = totalPending !== null && totalPending !== undefined;
  const showRecentInvoices = !loadingRecent && recentInvoices.length === 0 && cashIsOpen;

  const invoiceColumns: Array<DataTableColumn<Invoice>> = [
    {
      key: 'invoice_number',
      header: 'Número',
      cellClassName: 'font-mono tabular-nums',
      render: (invoice) => invoice.invoice_number,
    },
    {
      key: 'issued_at',
      header: 'Fecha',
      render: (invoice) => formatDateTimeEs(invoice.issued_at),
    },
    {
      key: 'patient_name',
      header: 'Paciente',
      render: (invoice) => invoice.patient_name,
    },
    {
      key: 'total',
      header: 'Total',
      numeric: true,
      render: (invoice) => formatLempirasUIFromCents(parseCents(invoice.total)),
    },
    {
      key: 'status',
      header: 'Estado',
      render: (invoice) => invoice.status,
    },
  ];

  return (
    <section aria-labelledby="dashboard-title" className="flex flex-col gap-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Inicio operativo
          </p>
          <h1 id="dashboard-title" className="mt-1 text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
            Centro de mando
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Caja, cobros del día, pendientes y facturas recientes.
            {primaryAction ? (
              <>
                {' '}Una acción clara: <strong>{primaryAction.label}</strong>.
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {primaryAction && (
            <Button asChild>
              <Link to={primaryAction.to}>
                {primaryAction.icon}
                {primaryAction.label}
              </Link>
            </Button>
          )}
          {canCreateInvoices && canViewInvoices && cashIsOpen && (
            <Button asChild variant="outline" size="sm">
              <Link to="/invoices">Ver historial</Link>
            </Button>
          )}
        </div>
      </header>

      {setupStatus?.needs_setup && (
        <DashboardSetupStatusCard
          canViewFiscalSettings={canViewFiscalSettings}
          onReview={() => setIsWizardOpen(true)}
          setupStatus={setupStatus}
        />
      )}

      <StatGrid
        items={[
          {
            icon: <WalletCards aria-hidden="true" className="size-4" />,
            label: 'Caja',
            value: cashIsOpen ? `Caja #${cashSession?.id}` : 'Cerrada',
            helper: cashIsOpen ? 'Lista para cobrar' : 'Abra caja para facturar',
            tone: cashIsOpen ? 'success' : 'warning',
          },
          {
            icon: <TrendingUp aria-hidden="true" className="size-4" />,
            label: 'Facturado hoy',
            value: moneyValue(todaySnapshot?.total_billed, Boolean(showTodayBilled)),
            helper: `${finiteNumber(todaySnapshot?.invoice_count)} facturas registradas`,
            tone: 'info',
          },
          {
            icon: <Banknote aria-hidden="true" className="size-4" />,
            label: 'Cobrado hoy',
            value: moneyValue(todaySnapshot?.total_collected, Boolean(showTodayCollected)),
            helper: `${finiteNumber(todaySnapshot?.payment_count)} pagos recibidos`,
            tone: 'success',
          },
          {
            icon: <ReceiptText aria-hidden="true" className="size-4" />,
            label: 'Pendiente del mes',
            value: moneyValue(totalPending ?? undefined, Boolean(showPending)),
            helper: finiteNumber(totalPending) > 0 ? 'Saldo pendiente de cobro' : 'Sin pendientes',
            tone: finiteNumber(totalPending) > 0 ? 'warning' : 'neutral',
          },
        ]}
      />

      {dashboardError && (
        <Alert variant="destructive" title="Resumen no disponible">
          {dashboardError}
        </Alert>
      )}

      {canViewInvoices ? (
        <section className="rounded-panel border border-operational-border bg-operational-surface p-5 shadow-operational" aria-labelledby="recent-invoices-title">
          <header className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="recent-invoices-title" className="text-base font-semibold text-foreground">
            Facturas recientes
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/invoices">Ver historial completo</Link>
          </Button>
          </header>

          {loadingRecent ? (
          <LoadingState label="Cargando facturas recientes..." />
        ) : showRecentInvoices ? (
          <Alert title="Sin facturas hoy">
            Aún no se emitieron facturas en este turno. Cree la primera desde Nueva factura.
          </Alert>
        ) : recentInvoices.length === 0 ? (
          <Alert title="Sin facturas recientes">
            Cuando emita facturas aparecerán aquí.
          </Alert>
        ) : (
          <DataTable
            containerLabel="Facturas recientes"
            rows={recentInvoices}
            columns={invoiceColumns}
            getRowKey={(invoice) => invoice.id}
            emptyTitle="Sin facturas recientes"
          />
        )}
        </section>
      ) : null}

      {canViewFiscalSettings && (
        <SetupWizardDialog
          open={isWizardOpen}
          onOpenChange={setIsWizardOpen}
          onComplete={() => {
            void loadSetupStatus();
            void dashboardQuery.refetch();
          }}
        />
      )}
    </section>
  );
}
