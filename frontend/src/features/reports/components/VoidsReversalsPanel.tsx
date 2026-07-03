import { formatLempirasUI } from '@/lib/moneyCents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import type { ExecutiveReport } from '@/lib/api';
import { formatLocalizedDateTime } from '@/lib/format/formatDate';

type VoidsReversalsPanelProps = {
  report: ExecutiveReport;
};

type VoidOrReversal = ExecutiveReport['voids_and_reversals'][number];

const voidsAndReversalsColumns: Array<DataTableColumn<VoidOrReversal>> = [
  {
    key: 'kind',
    header: 'Tipo',
    render: (item) => (
      <Badge variant={item.kind === 'reversal' ? 'warning' : 'destructive'}>
        {item.kind === 'reversal' ? 'Reversa' : 'Anulacion'}
      </Badge>
    ),
  },
  {
    key: 'invoice_number',
    header: '# Factura',
    cellClassName: 'font-mono text-xs',
    render: (item) => item.invoice_number,
  },
  {
    key: 'patient',
    header: 'Paciente',
    cellClassName: 'font-semibold',
    render: (item) => fallbackText(item.patient, 'Sin paciente'),
  },
  {
    key: 'amount',
    header: 'Monto',
    numeric: true,
    cellClassName: 'font-mono tabular-nums font-semibold',
    render: (item) => formatLempirasUI(item.amount),
  },
  {
    key: 'user',
    header: 'Usuario',
    cellClassName: 'text-xs',
    render: (item) => fallbackText(item.user, 'Sin usuario'),
  },
  {
    key: 'authorized_by',
    header: 'Autorizado por',
    cellClassName: 'text-xs',
    render: (item) => fallbackText(item.authorized_by, 'Sin autorizador'),
  },
  {
    key: 'reason',
    header: 'Motivo',
    cellClassName: 'max-w-md truncate text-xs text-muted-foreground',
    render: (item) => {
      const reason = fallbackText(item.reason, 'Sin motivo');
      return <span title={reason}>{reason}</span>;
    },
  },
  {
    key: 'created_at',
    header: 'Fecha',
    cellClassName: 'text-xs text-muted-foreground',
    render: (item) => formatDate(item.created_at),
  },
];

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Sin fecha';
  const formatted = formatLocalizedDateTime(value);

  return formatted === '-' ? 'Fecha no disponible' : formatted;
}

function fallbackText(value: string | null | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

export function VoidsReversalsPanel({ report }: VoidsReversalsPanelProps) {
  const items = report.voids_and_reversals;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">Anulaciones y reversas</CardTitle>
          <p className="text-xs text-muted-foreground">
            Operaciones fuera del ingreso neto. Cada una con usuario, autorizador y motivo.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <DataTable
          caption="Operaciones anuladas o reversadas."
          columns={voidsAndReversalsColumns}
          containerLabel="Anulaciones y reversas"
          emptyDescription="Las anulaciones y reversas apareceran cuando existan operaciones auditadas en el periodo."
          emptyTitle="Sin anulaciones ni reversas"
          getRowKey={(item) => `${item.kind}-${item.invoice_number}-${item.created_at ?? 'sin-fecha'}`}
          rows={items}
          tableClassName="min-w-[980px]"
        />
      </CardContent>
    </Card>
  );
}
