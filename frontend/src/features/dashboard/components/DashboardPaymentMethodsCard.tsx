import { PaymentMethodPieChart } from '../PaymentMethodPieChart';
import { DashboardSectionCard } from './DashboardSectionCard';
import { type DashboardSectionState } from './dashboardTypes';

export type DashboardPaymentMethodsCardProps = {
  canViewManagerialReports: boolean;
  dashboardError: string;
  loading: boolean;
  onRefresh: () => void;
  paymentsByMethod: Parameters<typeof PaymentMethodPieChart>[0]['data'] | null;
};

const EMPTY_DESCRIPTION = 'Los metodos de pago apareceran aqui al registrar pagos en caja.';

export function DashboardPaymentMethodsCard({
  canViewManagerialReports,
  dashboardError,
  loading,
  onRefresh,
  paymentsByMethod,
}: DashboardPaymentMethodsCardProps) {
  const state = resolvePaymentMethodsState({
    canViewManagerialReports,
    dashboardError,
    loading,
    paymentsByMethod,
  });

  return (
    <DashboardSectionCard
      title="Cobros de hoy"
      description="Distribucion por metodo de pago."
      state={state}
      loadingLabel="Cargando cobros de hoy"
      errorMessage={dashboardError}
      onRetry={onRefresh}
      emptyDescription={EMPTY_DESCRIPTION}
      emptyTitle="Sin cobros registrados hoy"
    >
      {paymentsByMethod ? <PaymentMethodPieChart data={paymentsByMethod} /> : null}
    </DashboardSectionCard>
  );
}

function resolvePaymentMethodsState({
  canViewManagerialReports,
  dashboardError,
  loading,
  paymentsByMethod,
}: {
  canViewManagerialReports: boolean;
  dashboardError: string;
  loading: boolean;
  paymentsByMethod: Parameters<typeof PaymentMethodPieChart>[0]['data'] | null;
}): DashboardSectionState {
  if (!canViewManagerialReports) return 'permission-locked';
  if (loading) return 'loading';
  if (dashboardError) return 'error';
  if (!paymentsByMethod) return 'empty';
  return 'ready';
}
