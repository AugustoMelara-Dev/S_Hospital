import { RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { RevenueBarChart } from '../RevenueBarChart';
import { DashboardSectionCard } from './DashboardSectionCard';
import { type DashboardSectionState } from './dashboardTypes';

export type DashboardRevenueCardProps = {
  canViewManagerialReports: boolean;
  dashboardError: string;
  dashboardData: { last_7_days: Parameters<typeof RevenueBarChart>[0]['data'] } | null;
  loading: boolean;
  onRefresh: () => void;
};

const EMPTY_DESCRIPTION = 'La tendencia se activara cuando existan facturas emitidas o pagos registrados.';

export function DashboardRevenueCard({
  canViewManagerialReports,
  dashboardData,
  dashboardError,
  loading,
  onRefresh,
}: DashboardRevenueCardProps) {
  const state = resolveRevenueState({ canViewManagerialReports, dashboardData, dashboardError, loading });

  return (
    <DashboardSectionCard
      title="Facturacion y cobros"
      description="Ultimos 7 dias."
      state={state}
      loadingLabel="Cargando facturacion y cobros"
      errorMessage={dashboardError}
      onRetry={onRefresh}
      emptyDescription={EMPTY_DESCRIPTION}
      emptyTitle="Sin movimientos en los ultimos 7 dias"
      variant="chart"
      actions={
        canViewManagerialReports ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={onRefresh}
            disabled={loading}
            aria-label="Actualizar facturacion y cobros"
          >
            <RefreshCw aria-hidden="true" className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        ) : undefined
      }
    >
      {dashboardData ? <RevenueBarChart data={dashboardData.last_7_days} /> : null}
    </DashboardSectionCard>
  );
}

function resolveRevenueState({
  canViewManagerialReports,
  dashboardData,
  dashboardError,
  loading,
}: {
  canViewManagerialReports: boolean;
  dashboardData: { last_7_days: Parameters<typeof RevenueBarChart>[0]['data'] } | null;
  dashboardError: string;
  loading: boolean;
}): DashboardSectionState {
  if (!canViewManagerialReports) return 'permission-locked';
  if (loading) return 'loading';
  if (dashboardError) return 'error';
  if (!dashboardData) return 'empty';
  if (dashboardData.last_7_days.length === 0) return 'empty';
  return 'ready';
}
