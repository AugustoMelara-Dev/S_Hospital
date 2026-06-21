import { useEffect, useState } from 'react';
import { PageHeader } from '../../components/ui/page-header';
import { type CashSession, type DashboardReport, apiClient, userSafeErrorMessage } from '../../lib/api';
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
      <PageHeader
        title="Inicio"
        description="Lo necesario para operar caja, cobros y facturacion sin perderse."
      />

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
          loading: loadingDashboard,
          paymentCount: dashboardData?.current_month.payment_count,
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
