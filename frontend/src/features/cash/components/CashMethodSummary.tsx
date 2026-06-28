import { CreditCard, HandCoins, Landmark, ReceiptText, WalletCards } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { MetricCard } from '@/components/ui/metric-card';
import { formatLempirasUI } from '@/lib/money';

type CashMethodSummaryProps = {
  paymentsByMethod?: {
    cash: string;
    transfer: string;
    card: string;
    other: string;
  };
  paymentsCount?: number;
  pendingAmount?: string;
};

export function CashMethodSummary({
  paymentsByMethod,
  paymentsCount = 0,
  pendingAmount = '0.00',
}: CashMethodSummaryProps) {
  if (!paymentsByMethod) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="cash-method-summary-title">
      <Card className="border-operational-border bg-operational-surface">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-1 border-b border-border pb-4">
            <h2 id="cash-method-summary-title" className="text-lg font-semibold text-foreground">
              Resumen por método de pago
            </h2>
            <p className="text-sm text-muted-foreground">
              Efectivo entra al efectivo esperado. Transferencias, tarjetas y otros métodos quedan separados para conciliación.
            </p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              icon={<HandCoins />}
              label="Efectivo"
              value={formatLempirasUI(paymentsByMethod.cash)}
              helper="Suma al efectivo esperado"
              variant="success"
            />
            <MetricCard
              icon={<Landmark />}
              label="Transferencia"
              value={formatLempirasUI(paymentsByMethod.transfer)}
              helper="Conciliación separada"
              variant="info"
            />
            <MetricCard
              icon={<CreditCard />}
              label="Tarjeta"
              value={formatLempirasUI(paymentsByMethod.card)}
              helper="No aumenta gaveta"
              variant="info"
            />
            <MetricCard
              icon={<WalletCards />}
              label="Otros"
              value={formatLempirasUI(paymentsByMethod.other)}
              helper="Método no efectivo"
            />
            <MetricCard
              icon={<ReceiptText />}
              label="Pagos"
              value={paymentsCount}
              helper="Pagos registrados"
            />
            <MetricCard
              icon={<ReceiptText />}
              label="Pendiente"
              value={formatLempirasUI(pendingAmount)}
              helper="Facturas emitidas o parciales"
              variant={pendingAmount === '0.00' ? 'neutral' : 'warning'}
            />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
