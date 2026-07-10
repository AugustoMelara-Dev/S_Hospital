import { RotateCcw, ShieldCheck, WalletCards } from 'lucide-react';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { formatLempirasUI } from '../../../lib/money';
import {
  buildReconciliationStatus,
  type ReconciliationInput,
} from '../application/reconciliationStatus';

type AccountingControlPanelProps = {
  reconciliation: ReconciliationInput;
  historyHref?: string;
};

export function AccountingControlPanel({
  reconciliation,
  historyHref = '/invoices',
}: AccountingControlPanelProps) {
  const status = buildReconciliationStatus(reconciliation);
  const pending = status.blockers.find((blocker) => blocker.kind === 'pending_invoices');
  const missingReceipts = status.blockers.find((blocker) => blocker.kind === 'missing_receipts');

  return (
    <Card className="border-operational-border bg-operational-surface">
      <CardContent className="grid gap-4 p-4 sm:p-5">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Control contable de caja</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pendientes, comprobantes y reversos se muestran por separado para conciliar el turno.
          </p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-3">
          <Fact
            icon={<WalletCards aria-hidden="true" />}
            label="Saldo pendiente"
            value={formatLempirasUI(pending?.kind === 'pending_invoices' ? pending.amount : '0.00')}
            detail={pending?.kind === 'pending_invoices'
              ? `${pending.count} facturas pendientes o parciales`
              : 'Sin facturas pendientes'}
          />
          <Fact
            icon={<ShieldCheck aria-hidden="true" />}
            label="Recibos pendientes"
            value={missingReceipts?.kind === 'missing_receipts' ? String(missingReceipts.count) : '0'}
            detail={missingReceipts?.kind === 'missing_receipts'
              ? missingReceipts.count === 1
                ? '1 recibo institucional pendiente'
                : `${missingReceipts.count} recibos institucionales pendientes`
              : 'Todos los pagos liquidados tienen recibo'}
          />
          <Fact
            icon={<RotateCcw aria-hidden="true" />}
            label="Pagos reversados"
            value={formatLempirasUI(status.reversedPayments.total)}
            detail={status.reversedPayments.count === 1
              ? '1 pago reversado'
              : `${status.reversedPayments.count} pagos reversados`}
          />
        </dl>

        {status.state === 'blocked' ? (
          <Alert variant="warning" title="Cierre bloqueado por conciliacion pendiente">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="flex-1">Resuelva las facturas o recibos indicados antes de cerrar la caja.</span>
              <Button asChild size="sm" variant="secondary">
                <a href={historyHref}>Resolver en Historial</a>
              </Button>
            </div>
          </Alert>
        ) : (
          <Alert variant="success" title="Conciliacion operativa lista">
            Sin pendientes que bloqueen el cierre. Verifique el efectivo contado antes de confirmar.
          </Alert>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          Egresos operativos no estan modelados en esta version. El sistema no presenta un valor cero que pueda confundirse con ausencia de gastos.
        </p>
      </CardContent>
    </Card>
  );
}

function Fact({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card/70 p-3">
      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span className="[&>svg]:size-4">{icon}</span>
        {label}
      </dt>
      <dd className="mt-2 text-xl font-semibold tabular-nums text-foreground">{value}</dd>
      <dd className="mt-1 text-xs text-muted-foreground">{detail}</dd>
    </div>
  );
}
