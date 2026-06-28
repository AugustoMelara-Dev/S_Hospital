import { CreditCard, ReceiptText, TrendingUp, WalletCards } from 'lucide-react';
import { StatGrid } from '../../../components/shared';
import { finiteNumber, formatLempirasUI } from '../../../lib/money';
import { type DashboardMetricsContext } from './dashboardTypes';

export type DashboardMetricsGridProps = {
  context: DashboardMetricsContext & { paymentCount: number | null | undefined };
};

export function DashboardMetricsGrid({ context }: DashboardMetricsGridProps) {
  const {
    cashSession,
    invoiceCount,
    loading,
    paymentCount,
    todayBilled,
    todayCollected,
    todayInvoiceCount,
    todayPaymentCount,
    totalBilled,
    totalCollected,
    totalPending,
  } = context;
  const hasBilledData = totalBilled !== null && totalBilled !== undefined;
  const hasCollectedData = totalCollected !== null && totalCollected !== undefined;
  const hasTodayBilled = todayBilled !== null && todayBilled !== undefined;
  const hasTodayCollected = todayCollected !== null && todayCollected !== undefined;
  const hasPendingData = totalPending !== null && totalPending !== undefined;
  const moneyValue = (value: string | number | null | undefined, hasData: boolean) => {
    if (loading) return <span className="inline-block h-7 w-24 rounded-md bg-muted" aria-hidden="true" />;
    return hasData ? formatLempirasUI(value) : 'Sin reporte';
  };
  const countValue = (value: number | null | undefined) => {
    if (loading) return <span className="inline-block h-7 w-16 rounded-md bg-muted" aria-hidden="true" />;
    return String(finiteNumber(value));
  };

  return (
    <section className="space-y-3" aria-label="Resumen operativo del dia y del mes">
      <StatGrid
        className="xl:grid-cols-[1fr_1fr_1fr_0.9fr]"
        items={[
          {
            icon: <WalletCards className="size-4" aria-hidden="true" />,
            label: 'Caja',
            value: cashSession ? `Caja #${cashSession.id}` : 'Cerrada',
            helper: cashSession ? 'Lista para cobrar' : 'Abra caja antes de facturar',
            tone: cashSession ? 'success' : 'warning',
          },
          {
            icon: <TrendingUp className="size-4" aria-hidden="true" />,
            label: 'Hoy facturado',
            value: moneyValue(todayBilled, hasTodayBilled),
            helper: `${finiteNumber(todayInvoiceCount)} facturas registradas hoy`,
            tone: 'info',
          },
          {
            icon: <CreditCard className="size-4" aria-hidden="true" />,
            label: 'Hoy cobrado',
            value: moneyValue(todayCollected, hasTodayCollected),
            helper: `${finiteNumber(todayPaymentCount)} pagos recibidos hoy`,
            tone: 'success',
          },
          {
            icon: <ReceiptText className="size-4" aria-hidden="true" />,
            label: 'Facturas',
            value: countValue(invoiceCount),
            helper: 'Emitidas este mes',
            tone: 'neutral',
          },
        ]}
      />

      <StatGrid
        className="xl:grid-cols-3"
        items={[
          {
            icon: <TrendingUp className="size-4" aria-hidden="true" />,
            label: 'Facturado',
            value: moneyValue(totalBilled, hasBilledData),
            helper: hasBilledData ? `${finiteNumber(invoiceCount)} facturas este mes` : 'Facturacion del mes',
            tone: 'info',
          },
          {
            icon: <CreditCard className="size-4" aria-hidden="true" />,
            label: 'Cobrado',
            value: moneyValue(totalCollected, hasCollectedData),
            helper: hasCollectedData ? `${finiteNumber(paymentCount)} pagos recibidos` : 'Cobros del mes',
            tone: 'success',
          },
          {
            icon: <ReceiptText className="size-4" aria-hidden="true" />,
            label: 'Pendiente',
            value: moneyValue(totalPending, hasPendingData),
            helper: hasPendingData ? 'Saldo pendiente del mes' : 'No incluido en el reporte actual',
            tone: hasPendingData && finiteNumber(totalPending) > 0 ? 'warning' : 'neutral',
          },
        ]}
      />
    </section>
  );
}
