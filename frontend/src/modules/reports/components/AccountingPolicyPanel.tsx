import { BookOpenCheck } from 'lucide-react';
import { Alert } from '../../../components/ui/alert';
import { Card, CardContent } from '../../../components/ui/card';
import type { ExecutiveReport } from '../../../lib/api/types';

type AccountingPolicyPanelProps = {
  policy?: ExecutiveReport['accounting_policy'];
};

export function AccountingPolicyPanel({ policy }: AccountingPolicyPanelProps) {
  const effectivePolicy = policy ?? {
    scope: 'operational_cash' as const,
    expenses_supported: false as const,
    exclusions_already_applied: true as const,
    billed_definition: 'Facturas emitidas no anuladas. Las anulaciones ya estan excluidas.',
    collected_definition: 'Pagos posteados no reversados. Los reversos ya estan excluidos.',
  };

  return (
    <Card className="border-operational-border bg-operational-surface">
      <CardContent className="grid gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded bg-muted text-secondary ring-1 ring-border">
            <BookOpenCheck aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Criterio contable operativo</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Este reporte controla facturacion, cobros y caja; no sustituye contabilidad financiera de partida doble.
            </p>
          </div>
        </div>

        <dl className="grid gap-3 md:grid-cols-2">
          <Definition label="Facturado" value={effectivePolicy.billed_definition} />
          <Definition label="Cobrado" value={effectivePolicy.collected_definition} />
        </dl>

        {effectivePolicy.exclusions_already_applied ? (
          <Alert variant="default" title="Anulaciones y reversos son datos de control">
            Ya estan excluidos de los totales activos y no se restan otra vez.
          </Alert>
        ) : null}

        {!effectivePolicy.expenses_supported ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Egresos no estan modelados en esta version y no se presentan como un valor cero.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Definition({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card/70 p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm leading-relaxed text-foreground">{value}</dd>
    </div>
  );
}
