import { Link } from 'react-router-dom';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { finiteNumber, formatLempirasUI } from '../../../lib/money';
import { cn } from '../../../lib/utils';
import {
  buildReconciliationStatus,
  type ReconciliationInput,
} from '../application/reconciliationStatus';

type AccountingControlPanelProps = {
  canViewInvoices?: boolean;
  reconciliation: ReconciliationInput;
  historyHref?: string;
};

export function AccountingControlPanel({
  canViewInvoices = false,
  reconciliation,
  historyHref = '/invoices',
}: AccountingControlPanelProps) {
  const status = buildReconciliationStatus(reconciliation);
  const pending = status.blockers.find((blocker) => blocker.kind === 'pending_invoices');
  const missingReceipts = status.blockers.find((blocker) => blocker.kind === 'missing_receipts');
  const hasDifference = reconciliation.difference_amount !== null && reconciliation.difference_amount !== undefined;
  const difference = finiteNumber(reconciliation.difference_amount);
  const differenceDescription = !hasDifference
    ? 'Conteo pendiente'
    : difference === 0
      ? 'Sin diferencia'
      : difference > 0
        ? 'Sobrante de caja'
        : 'Faltante de caja';

  return (
    <section
      aria-labelledby="accounting-control-title"
      className="overflow-hidden rounded-lg border border-operational-border bg-operational-surface"
    >
      <div className="border-b border-border px-4 pb-4 pt-5 sm:px-5">
        <h2 id="accounting-control-title" className="text-lg font-semibold tracking-tight text-foreground">
          Control contable de caja
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Ingresos, pendientes, anulaciones y estado del cierre, sin mezclar conceptos.
        </p>
      </div>

      <dl className="divide-y divide-border">
        <Fact
          label="Ingresos cobrados"
          value={reconciliation.payments_total === undefined
            ? 'No disponible'
            : formatLempirasUI(reconciliation.payments_total)}
          detail={reconciliation.payments_total === undefined
            ? 'La sesión no entregó un total consolidado'
            : 'Pagos posteados en la sesión'}
        />
        <Fact
          label="Saldo pendiente"
          value={formatLempirasUI(pending?.kind === 'pending_invoices' ? pending.amount : '0.00')}
          detail={pending?.kind === 'pending_invoices'
            ? `${pending.count} facturas pendientes o parciales`
            : 'Sin facturas pendientes'}
        />
        <Fact
          label="Recibos pendientes"
          value={missingReceipts?.kind === 'missing_receipts' ? String(missingReceipts.count) : '0'}
          detail={missingReceipts?.kind === 'missing_receipts'
            ? missingReceipts.count === 1
              ? '1 recibo institucional pendiente'
              : `${missingReceipts.count} recibos institucionales pendientes`
            : 'Todos los pagos liquidados tienen recibo'}
        />
        <Fact
          label="Pagos reversados"
          value={formatLempirasUI(status.reversedPayments.total)}
          detail={status.reversedPayments.count === 1
            ? '1 pago reversado'
            : `${status.reversedPayments.count} pagos reversados`}
        />
        <Fact
          label="Estado del cierre"
          value={reconciliation.status === 'closed' ? 'Cierre confirmado' : 'Cierre en preparación'}
          detail={hasDifference ? formatSignedLempiras(difference) : 'Ingrese el conteo físico'}
          detailId="accounting-difference-description"
          detailDescription={differenceDescription}
          detailClassName={cn(
            hasDifference && difference < 0 && 'text-destructive',
            hasDifference && difference > 0 && 'text-warning-foreground',
            hasDifference && difference === 0 && 'text-success-foreground',
          )}
        />
      </dl>

      <div className="grid gap-3 border-t border-border p-4 sm:p-5">
        {status.state === 'blocked' ? (
          <Alert variant="warning" title="Cierre bloqueado por conciliación pendiente">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="flex-1">Resuelva las facturas o recibos indicados antes de cerrar la caja.</span>
              {canViewInvoices ? (
                <Button asChild size="sm" variant="secondary">
                  <Link to={historyHref}>Resolver en Historial</Link>
                </Button>
              ) : (
                <span className="text-xs font-medium">
                  Solicite apoyo a un usuario con acceso al Historial.
                </span>
              )}
            </div>
          </Alert>
        ) : (
          <Alert variant="success" title="Conciliación operativa lista">
            Sin pendientes que bloqueen el cierre. Verifique el efectivo contado antes de confirmar.
          </Alert>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Los egresos operativos no están modelados en esta versión. Por eso no se muestra un valor cero ni una acción que pueda confundirse con registro de gastos.
        </p>
      </div>
    </section>
  );
}

function Fact({
  detail,
  detailClassName,
  detailDescription,
  detailId,
  label,
  value,
}: {
  detail: string;
  detailClassName?: string;
  detailDescription?: string;
  detailId?: string;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold tabular-nums text-foreground">{value}</dd>
      <dd
        aria-describedby={detailId}
        className={cn('col-span-2 text-xs leading-relaxed text-muted-foreground', detailClassName)}
      >
        {detail}
      </dd>
      {detailDescription ? <dd id={detailId} className="sr-only">{detailDescription}</dd> : null}
    </div>
  );
}

function formatSignedLempiras(value: number): string {
  if (value === 0) return 'L 0.00';
  return `${value > 0 ? '+' : '-'} ${formatLempirasUI(Math.abs(value))}`;
}
