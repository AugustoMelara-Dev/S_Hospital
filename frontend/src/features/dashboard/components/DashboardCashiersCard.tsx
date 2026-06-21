import { CashierList } from '../CashierList';
import { DashboardSectionCard } from './DashboardSectionCard';
import { type DashboardSectionState } from './dashboardTypes';

export type DashboardCashiersCardProps = {
  canViewManagerialReports: boolean;
  cashiers: Parameters<typeof CashierList>[0]['cashiers'] | null;
  dashboardError: string;
  loading: boolean;
  onRefresh: () => void;
};

const EMPTY_DESCRIPTION = 'Los cobros recibidos por usuario apareceran aqui cuando existan pagos en caja.';

export function DashboardCashiersCard({
  canViewManagerialReports,
  cashiers,
  dashboardError,
  loading,
  onRefresh,
}: DashboardCashiersCardProps) {
  const state = resolveCashiersState({ canViewManagerialReports, cashiers, dashboardError, loading });

  return (
    <DashboardSectionCard
      title="Cajeros hoy"
      description="Cobros recibidos por usuario."
      state={state}
      loadingLabel="Cargando cajeros de hoy"
      errorMessage={dashboardError}
      onRetry={onRefresh}
      emptyDescription={EMPTY_DESCRIPTION}
      emptyTitle="Ningun cajero ha recibido pagos hoy"
    >
      {cashiers ? <CashierList cashiers={cashiers} /> : null}
    </DashboardSectionCard>
  );
}

function resolveCashiersState({
  canViewManagerialReports,
  cashiers,
  dashboardError,
  loading,
}: {
  canViewManagerialReports: boolean;
  cashiers: Parameters<typeof CashierList>[0]['cashiers'] | null;
  dashboardError: string;
  loading: boolean;
}): DashboardSectionState {
  if (!canViewManagerialReports) return 'permission-locked';
  if (loading) return 'loading';
  if (dashboardError) return 'error';
  if (!cashiers) return 'empty';
  return 'ready';
}
