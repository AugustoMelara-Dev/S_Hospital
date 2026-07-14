import { BookOutlined } from '@ant-design/icons';
import { Alert, Descriptions, Typography } from 'antd';
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
    <section className="grid gap-4 border border-operational-border bg-operational-surface p-4 sm:p-5" aria-labelledby="accounting-policy-title">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center bg-accent text-secondary ring-1 ring-border">
            <BookOutlined aria-hidden="true" />
          </span>
          <div>
            <Typography.Title id="accounting-policy-title" level={2}>Criterio contable operativo</Typography.Title>
            <p className="mt-1 text-sm text-muted-foreground">
              Este reporte controla facturacion, cobros y caja; no sustituye contabilidad financiera de partida doble.
            </p>
          </div>
        </div>

        <Descriptions
          bordered
          column={{ xs: 1, md: 2 }}
          items={[
            { key: 'billed', label: 'Facturado', children: effectivePolicy.billed_definition },
            { key: 'collected', label: 'Cobrado', children: effectivePolicy.collected_definition },
          ]}
        />

        {effectivePolicy.exclusions_already_applied ? (
          <Alert
            type="info"
            showIcon
            title="Anulaciones y reversos son datos de control"
            description="Ya están excluidos de los totales activos y no se restan otra vez."
          />
        ) : null}

        {!effectivePolicy.expenses_supported ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Egresos no estan modelados en esta version y no se presentan como un valor cero.
          </p>
        ) : null}
    </section>
  );
}
