import { useEffect, useState } from 'react';
import { BarChart3, ReceiptText, RefreshCw, WalletCards } from 'lucide-react';
import { OperationalBanner, CashStatusCard, InfoPanel } from '../../components/shared';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { type CashSession, type DashboardReport, apiClient, userSafeErrorMessage } from '../../lib/api';
import { formatDateTimeEs } from '../../lib/format/formatDate';
import { DashboardCashiersCard } from './components/DashboardCashiersCard';
import { DashboardMetricsGrid } from './components/DashboardMetricsGrid';
import { DashboardNextActionCard } from './components/DashboardNextActionCard';
import { DashboardPaymentMethodsCard } from './components/DashboardPaymentMethodsCard';
import { DashboardRevenueCard } from './components/DashboardRevenueCard';
import { DashboardSetupStatusCard } from './components/DashboardSetupStatusCard';
import { DashboardTopServicesCard } from './components/DashboardTopServicesCard';
import { SetupWizardDialog } from './components/SetupWizardDialog';
import { type SetupStatus } from './components/dashboardTypes';

type DashboardViewProps = {
  canCreateInvoices: boolean;
  canViewBackups: boolean;
  canViewCash: boolean;
  canViewCatalog: boolean;
  canViewFiscalSettings: boolean;
  canViewInvoices: boolean;
  canViewManagerialReports: boolean;
  canViewReports: boolean;
  cashSession: CashSession | null;
  onQuickCash: () => void;
  onQuickInvoice: () => void;
  onStatus: (message: string) => void;
};

export function DashboardView({
  canCreateInvoices,
  canViewCash,
  canViewFiscalSettings,
  canViewManagerialReports,
  cashSession,
  onQuickCash,
  onQuickInvoice,
  onStatus,
}: DashboardViewProps) {
  const [dashboardData, setDashboardData] = useState<DashboardReport | null>(null);
  const [dashboardError, setDashboardError] = useState('');
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const todaySnapshot = dashboardData?.last_7_days.at(-1) ?? null;

  const fetchDashboard = () => {
    if (!canViewManagerialReports) {
      return;
    }

    setLoadingDashboard(true);
    apiClient
      .getDashboardReport()
      .then((data) => {
        setDashboardData(data);
        setDashboardError('');
      })
      .catch((err) => {
        const msg = userSafeErrorMessage(err, 'No se pudo cargar el resumen.');
        setDashboardError(msg);
        onStatus(msg);
      })
      .finally(() => {
        setLoadingDashboard(false);
      });
  };

  const fetchSetupStatus = () => {
    if (!canViewFiscalSettings && !canViewManagerialReports) {
      return;
    }

    apiClient
      .request<SetupStatus>('/api/system/setup-status')
      .then((res: SetupStatus) => {
        setSetupStatus(res);
      })
      .catch(() => {
        setSetupStatus(null);
      });
  };

  useEffect(() => {
    fetchDashboard();
    fetchSetupStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewManagerialReports, canViewFiscalSettings]);

  return (
    <>
      <OperationalBanner
        meta="Inicio operativo"
        title="Centro de mando"
        description="Estado de caja, cobros, facturacion y senales de operacion para el turno del hospital."
        tone={cashSession ? 'success' : 'warning'}
        status={
          <Badge variant={cashSession ? 'success' : 'warning'}>
            {cashSession ? `Caja #${cashSession.id} abierta` : 'Caja cerrada'}
          </Badge>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {cashSession && canCreateInvoices ? (
              <Button
                type="button"
                onClick={onQuickInvoice}
                className="gap-2"
                aria-label="Crear factura desde el centro de mando"
              >
                <ReceiptText aria-hidden="true" className="size-4" />
                Nueva factura
              </Button>
            ) : null}
            {!cashSession && canViewCash ? (
              <Button
                type="button"
                onClick={onQuickCash}
                className="gap-2"
                aria-label="Abrir caja desde el centro de mando"
              >
                <WalletCards aria-hidden="true" className="size-4" />
                Abrir caja
              </Button>
            ) : null}
            {canViewManagerialReports ? (
              <Button
                type="button"
                variant="outline"
                onClick={fetchDashboard}
                disabled={loadingDashboard}
                className="gap-2"
                aria-label="Actualizar tablero operativo"
              >
                <RefreshCw aria-hidden="true" className={`size-4 ${loadingDashboard ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <CashStatusCard
          status={cashSession ? 'open' : 'closed'}
          amount={cashSession ? `Caja #${cashSession.id}` : 'Caja cerrada'}
          timestamp={cashSession ? formatDateTimeEs(cashSession.opened_at) : undefined}
          helper={
            cashSession
              ? 'El turno puede registrar pagos y emitir facturas segun permisos.'
              : 'Abra una caja antes de iniciar cobros o facturacion.'
          }
          actions={
            !cashSession && canViewCash ? (
              <Button type="button" variant="outline" size="sm" onClick={onQuickCash}>
                Abrir caja
              </Button>
            ) : cashSession && canCreateInvoices ? (
              <Button type="button" variant="outline" size="sm" onClick={onQuickInvoice}>
                Nueva factura
              </Button>
            ) : undefined
          }
        />

        <InfoPanel
          tone={setupStatus?.needs_setup ? 'warning' : dashboardError ? 'destructive' : cashSession ? 'success' : 'info'}
          icon={<BarChart3 aria-hidden="true" className="size-4" />}
          title={
            setupStatus?.needs_setup
              ? 'Configuracion pendiente'
              : dashboardError
                ? 'Resumen operativo no disponible'
                : cashSession
                  ? 'Operacion lista para caja'
                  : 'Caja pendiente de apertura'
          }
          description={
            setupStatus?.needs_setup
              ? 'Revise los pasos institucionales antes de operar con normalidad.'
              : dashboardError
                ? dashboardError
                : todaySnapshot
                  ? `Ultimo dia en el resumen: ${todaySnapshot.date}.`
                  : 'Los paneles mostraran actividad cuando existan movimientos registrados.'
          }
        />
      </div>

      {setupStatus?.needs_setup ? (
        <DashboardSetupStatusCard
          canViewFiscalSettings={canViewFiscalSettings}
          onReview={() => setIsWizardOpen(true)}
          setupStatus={setupStatus}
        />
      ) : null}

      <DashboardMetricsGrid
        context={{
          cashSession,
          invoiceCount: dashboardData?.current_month.invoice_count,
          todayBilled: todaySnapshot?.total_billed,
          todayCollected: todaySnapshot?.total_collected,
          todayInvoiceCount: todaySnapshot?.invoice_count,
          todayPaymentCount: todaySnapshot?.payment_count,
          loading: loadingDashboard,
          paymentCount: dashboardData?.current_month.payment_count,
          totalPending: dashboardData?.current_month.total_pending,
          totalBilled: dashboardData?.current_month.total_billed,
          totalCollected: dashboardData?.current_month.total_collected,
        }}
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.75fr)_minmax(300px,0.9fr)]">
        <div className="flex flex-col gap-5">
          <DashboardRevenueCard
            canViewManagerialReports={canViewManagerialReports}
            dashboardData={dashboardData}
            dashboardError={dashboardError}
            loading={loadingDashboard}
            onRefresh={fetchDashboard}
          />

          <DashboardCashiersCard
            canViewManagerialReports={canViewManagerialReports}
            cashiers={dashboardData?.cashiers_summary ?? null}
            dashboardError={dashboardError}
            loading={loadingDashboard}
            onRefresh={fetchDashboard}
          />
        </div>

        <div className="flex flex-col gap-5">
          <DashboardNextActionCard
            canCreateInvoices={canCreateInvoices}
            canViewCash={canViewCash}
            cashSession={cashSession ? { id: cashSession.id } : null}
            onQuickCash={onQuickCash}
            onQuickInvoice={onQuickInvoice}
          />

          <DashboardPaymentMethodsCard
            canViewManagerialReports={canViewManagerialReports}
            dashboardError={dashboardError}
            loading={loadingDashboard}
            onRefresh={fetchDashboard}
            paymentsByMethod={dashboardData?.payments_by_method ?? null}
          />

          <DashboardTopServicesCard
            canViewManagerialReports={canViewManagerialReports}
            dashboardError={dashboardError}
            loading={loadingDashboard}
            onRefresh={fetchDashboard}
            topServices={dashboardData?.top_services ?? null}
          />
        </div>
      </div>

      {canViewFiscalSettings ? (
        <SetupWizardDialog
          open={isWizardOpen}
          onOpenChange={setIsWizardOpen}
          onComplete={() => {
            fetchSetupStatus();
            fetchDashboard();
          }}
        />
      ) : null}
    </>
  );
}
