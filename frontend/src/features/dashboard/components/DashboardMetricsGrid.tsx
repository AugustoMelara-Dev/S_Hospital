import { CreditCard, ReceiptText, TrendingUp, WalletCards } from 'lucide-react';
import { MetricCard } from '../../../components/ui/metric-card';
import { Skeleton } from '../../../components/ui/states';
import { finiteNumber, formatLempirasUI } from '../../../lib/money';
import { type DashboardMetricsContext } from './dashboardTypes';

export type DashboardMetricsGridProps = {
  context: DashboardMetricsContext & { paymentCount: number | null | undefined };
};

export function DashboardMetricsGrid({ context }: DashboardMetricsGridProps) {
  const { cashSession, invoiceCount, loading, paymentCount, totalBilled, totalCollected } = context;
  const hasBilledData = totalBilled !== null && totalBilled !== undefined;
  const hasCollectedData = totalCollected !== null && totalCollected !== undefined;

  return (
    <section
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.15fr_1fr_1fr_0.85fr]"
      aria-label="Resumen operativo del mes"
    >
      <MetricCard
        icon={<WalletCards className="size-4 text-success" aria-hidden="true" />}
        label="Caja"
        value={cashSession ? `Caja #${cashSession.id}` : 'Cerrada'}
        helper={cashSession ? 'Lista para cobrar' : 'Abra caja antes de facturar'}
        variant={cashSession ? 'success' : 'warning'}
      />

      <MetricCard
        icon={<TrendingUp className="size-4 text-primary" aria-hidden="true" />}
        label="Facturado"
        value={
          loading ? (
            <Skeleton className="h-7 w-24" />
          ) : hasBilledData ? (
            formatLempirasUI(totalBilled)
          ) : (
            formatLempirasUI(0)
          )
        }
        helper={
          hasBilledData
            ? `${finiteNumber(invoiceCount)} facturas este mes`
            : 'Facturacion del mes'
        }
      />

      <MetricCard
        icon={<CreditCard className="size-4 text-success" aria-hidden="true" />}
        label="Cobrado"
        value={
          loading ? (
            <Skeleton className="h-7 w-24" />
          ) : hasCollectedData ? (
            formatLempirasUI(totalCollected)
          ) : (
            formatLempirasUI(0)
          )
        }
        helper={
          hasCollectedData
            ? `${finiteNumber(paymentCount)} pagos recibidos`
            : 'Cobros del mes'
        }
      />

      <MetricCard
        icon={<ReceiptText className="size-4 text-info" aria-hidden="true" />}
        label="Facturas"
        value={
          loading ? (
            <Skeleton className="h-7 w-16" />
          ) : (
            String(finiteNumber(invoiceCount))
          )
        }
        helper="Emitidas este mes"
        variant="info"
      />
    </section>
  );
}
