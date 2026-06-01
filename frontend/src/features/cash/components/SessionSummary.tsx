import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { finiteNumber, formatLempiras } from '@/lib/money';
import { cn } from '@/lib/utils';
import type { CashSession } from '@/lib/api';

interface SessionSummaryProps {
  session: CashSession;
  closingAmount: string | null;
  difference: number | null;
}

export function SessionSummary({
  session,
  closingAmount,
  difference,
}: SessionSummaryProps) {
  const expectedAmount = finiteNumber(session.expected_cash_amount ?? session.expected_amount);
  const openingAmount = finiteNumber(session.opening_amount);
  const cashPayments = finiteNumber(session.payments_by_method?.cash);
  const pendingAmount = finiteNumber(session.pending_amount);
  const pendingCount = session.pending_invoice_count ?? 0;
  const hasCountedAmount = closingAmount !== null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      <Card>
        <CardContent className="pt-6">
          <Label className="text-muted-foreground">Monto Apertura</Label>
          <p className="text-2xl font-bold">{formatLempiras(openingAmount)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Label className="text-muted-foreground">Efectivo esperado</Label>
          <p className="text-2xl font-bold">{formatLempiras(expectedAmount)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Apertura + pagos en efectivo. Tarjeta y transferencia no aumentan este monto.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <Label className="text-muted-foreground">Cobros en efectivo</Label>
          <p className="text-2xl font-bold">{formatLempiras(cashPayments)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Solo pagos posteados con metodo efectivo.
          </p>
        </CardContent>
      </Card>

      <Card className={cn(hasCountedAmount && difference !== 0 ? 'border-amber-200 bg-amber-50' : '')}>
        <CardContent className="pt-6">
          <Label className="text-muted-foreground">Contado y diferencia</Label>
          <p className="text-2xl font-bold">
            {hasCountedAmount ? formatLempiras(closingAmount) : 'Pendiente'}
          </p>
          <p
            className={cn(
              'mt-1 text-sm font-semibold',
              difference && difference > 0 ? 'text-emerald-600' : difference && difference < 0 ? 'text-red-600' : 'text-muted-foreground',
            )}
          >
            {!hasCountedAmount
              ? 'Ingrese monto contado para calcular diferencia.'
              : difference === null || difference === 0
              ? 'L. 0.00'
              : `L. ${difference > 0 ? '+' : ''}${difference.toFixed(2)}`}
          </p>
        </CardContent>
      </Card>

      <Card className={cn(pendingAmount > 0 ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20' : '')}>
        <CardContent className="pt-6">
          <Label className="text-muted-foreground">Saldo pendiente</Label>
          <p className="text-2xl font-bold">{formatLempiras(pendingAmount)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {pendingCount === 0
              ? 'Sin facturas pendientes en esta caja.'
              : `${pendingCount} factura(s) emitidas o parciales.`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
