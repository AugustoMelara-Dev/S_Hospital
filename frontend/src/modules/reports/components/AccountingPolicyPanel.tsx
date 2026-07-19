import { BookOpenIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ExecutiveReport } from '../../../lib/api/types';

type AccountingPolicyPanelProps = { policy?: ExecutiveReport['accounting_policy'] };

export function AccountingPolicyPanel({ policy }: AccountingPolicyPanelProps) {
  const effectivePolicy = policy ?? {
    scope: 'operational_cash' as const,
    expenses_supported: false as const,
    exclusions_already_applied: true as const,
    billed_definition: 'Facturas emitidas no anuladas. Las anulaciones ya estan excluidas.',
    collected_definition: 'Pagos posteados no reversados. Los reversos ya estan excluidos.',
  };
  return (
    <section aria-labelledby="accounting-policy-title">
      <Card>
        <CardHeader className="flex flex-row items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-muted"><BookOpenIcon aria-hidden="true" className="size-5" /></span>
          <div className="flex flex-col gap-1"><CardTitle><h2 id="accounting-policy-title">Criterio contable operativo</h2></CardTitle><CardDescription>Este reporte controla facturación, cobros y caja; no sustituye contabilidad financiera de partida doble.</CardDescription></div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid overflow-hidden rounded-lg border border-border md:grid-cols-2">
            <div className="p-3"><dt className="text-sm font-medium">Facturado</dt><dd className="mt-1 text-sm text-muted-foreground">{effectivePolicy.billed_definition}</dd></div>
            <div className="border-t border-border p-3 md:border-l md:border-t-0"><dt className="text-sm font-medium">Cobrado</dt><dd className="mt-1 text-sm text-muted-foreground">{effectivePolicy.collected_definition}</dd></div>
          </dl>
          {effectivePolicy.exclusions_already_applied ? <Alert><AlertTitle>Anulaciones y reversos son datos de control</AlertTitle><AlertDescription>Ya están excluidos de los totales activos y no se restan otra vez.</AlertDescription></Alert> : null}
          {!effectivePolicy.expenses_supported ? <p className="text-xs leading-relaxed text-muted-foreground">Egresos no están modelados en esta versión y no se presentan como un valor cero.</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}
