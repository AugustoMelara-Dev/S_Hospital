import { ArrowRight, ReceiptText, ShieldCheck, WalletCards } from 'lucide-react';
import { WorkflowPanel } from '../../../components/shared';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { type DashboardNextActionContext } from './dashboardTypes';

export type DashboardNextActionCardProps = DashboardNextActionContext;

export function DashboardNextActionCard({
  canCreateInvoices,
  canViewCash,
  cashSession,
  onQuickCash,
  onQuickInvoice,
}: DashboardNextActionCardProps) {
  const showOpenCash = !cashSession && canViewCash;
  const showNewInvoice = Boolean(cashSession) && canCreateInvoices;
  const showEmpty = !showOpenCash && !showNewInvoice;
  const tone = showOpenCash ? 'warning' : showNewInvoice ? 'success' : 'neutral';

  return (
    <WorkflowPanel
      data-slot="dashboard-next-action"
      title="Siguiente accion"
      description="Comando principal segun el estado de caja y permisos del usuario."
      tone={tone}
      status={<Badge variant={showNewInvoice ? 'success' : showOpenCash ? 'warning' : 'secondary'}>{cashSession ? 'Caja abierta' : 'Caja cerrada'}</Badge>}
    >
      <div className="flex flex-col gap-3">
        {showOpenCash ? (
          <Button
            type="button"
            onClick={onQuickCash}
            className="h-11 w-full justify-start gap-2 font-medium"
            aria-label="Abrir caja desde el inicio"
          >
            <WalletCards aria-hidden="true" className="size-4 shrink-0" />
            Abrir caja
            <ArrowRight aria-hidden="true" className="ml-auto size-4 shrink-0" />
          </Button>
        ) : null}

        {showNewInvoice ? (
          <Button
            type="button"
            onClick={onQuickInvoice}
            className="h-11 w-full justify-start gap-2 font-medium"
            aria-label="Crear nueva factura"
          >
            <ReceiptText aria-hidden="true" className="size-4 shrink-0" />
            Nueva factura
            <ArrowRight aria-hidden="true" className="ml-auto size-4 shrink-0" />
          </Button>
        ) : null}

        {showEmpty ? (
          <p
            className="rounded-md border border-dashed border-operational-border bg-operational-panel px-3 py-3 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            No hay acciones disponibles para este usuario.
          </p>
        ) : null}

        <div className="rounded-md border border-operational-border bg-background/70 p-3 text-xs text-muted-foreground">
          <div className="flex gap-2">
            <ShieldCheck aria-hidden="true" className="size-4 shrink-0 text-hospital-primary" />
            <div>
              <p className="font-semibold text-foreground">Red local</p>
              <p className="mt-0.5">Los cobros y respaldos se guardan en el servidor del hospital.</p>
            </div>
          </div>
        </div>
      </div>
    </WorkflowPanel>
  );
}
