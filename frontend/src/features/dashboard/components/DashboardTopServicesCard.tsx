import { TopServicesChart } from '../TopServicesChart';
import { DashboardSectionCard } from './DashboardSectionCard';
import { type DashboardSectionState } from './dashboardTypes';

export type DashboardTopServicesCardProps = {
  canViewManagerialReports: boolean;
  dashboardError: string;
  loading: boolean;
  onRefresh: () => void;
  topServices: Parameters<typeof TopServicesChart>[0]['services'] | null;
};

const EMPTY_DESCRIPTION =
  'Cuando existan facturas pagadas, aqui se mostraran los servicios con mayor movimiento.';

export function DashboardTopServicesCard({
  canViewManagerialReports,
  dashboardError,
  loading,
  onRefresh,
  topServices,
}: DashboardTopServicesCardProps) {
  const state = resolveTopServicesState({
    canViewManagerialReports,
    dashboardError,
    loading,
    topServices,
  });

  return (
    <DashboardSectionCard
      title="Servicios principales"
      description="Top 5 del mes."
      state={state}
      loadingLabel="Cargando servicios principales"
      errorMessage={dashboardError}
      onRetry={onRefresh}
      emptyDescription={EMPTY_DESCRIPTION}
      emptyTitle="Sin servicios facturados este mes"
    >
      {topServices ? <TopServicesChart services={topServices} /> : null}
    </DashboardSectionCard>
  );
}

function resolveTopServicesState({
  canViewManagerialReports,
  dashboardError,
  loading,
  topServices,
}: {
  canViewManagerialReports: boolean;
  dashboardError: string;
  loading: boolean;
  topServices: Parameters<typeof TopServicesChart>[0]['services'] | null;
}): DashboardSectionState {
  if (!canViewManagerialReports) return 'permission-locked';
  if (loading) return 'loading';
  if (dashboardError) return 'error';
  if (!topServices) return 'empty';
  return 'ready';
}
