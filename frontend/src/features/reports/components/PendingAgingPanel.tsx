import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type InstitutionalColumn } from '@/design-system/patterns/DataTable';
import { formatDate } from '@/lib/format/formatDate';
import { formatLempirasUI } from '@/lib/moneyCents';
import type { ExecutiveReport } from '@/lib/api';

type Props = { report: ExecutiveReport };
type Item = ExecutiveReport['pending_aging']['items'][number];
const columns: Array<InstitutionalColumn<Item>> = [
  { accessorKey: 'invoice_number', header: '# Factura' },
  { accessorKey: 'patient', header: 'Paciente' },
  { accessorKey: 'issued_at', header: 'Emitida', cell: ({ row }) => pendingDate(row.original.issued_at) },
  { accessorKey: 'age_days', header: 'Antigüedad', meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums">{row.original.age_days} d</span> },
  { accessorKey: 'total', header: 'Total', meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums">{formatLempirasUI(row.original.total)}</span> },
  { accessorKey: 'balance_due', header: 'Saldo', meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums">{formatLempirasUI(row.original.balance_due)}</span> },
];

export function PendingAgingPanel({ report }: Props) {
  const aging = report.pending_aging;
  const buckets = [['0_7_days', '0 a 7 días'], ['8_30_days', '8 a 30 días'], ['31_plus_days', '31 o más días']] as const;
  return (
    <section aria-labelledby="pending-title">
      <Card>
        <CardHeader>
          <CardTitle><h3 id="pending-title">Pendientes y antigüedad</h3></CardTitle>
          <CardDescription>Facturas con saldo abierto, agrupadas por días desde la emisión.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <dl className="grid gap-3 md:grid-cols-3">
            {buckets.map(([key, label]) => <div key={key} className="rounded-lg border border-border bg-muted/30 p-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="mt-1 flex items-baseline justify-between gap-2"><span className="text-xl font-semibold tabular-nums">{aging[key].count}</span><span className="text-sm tabular-nums text-muted-foreground">{formatLempirasUI(aging[key].amount)}</span></dd></div>)}
          </dl>
          <DataTable ariaLabel="Facturas pendientes" data={aging.items} columns={columns} getRowId={(item) => `${item.invoice_number}-${item.issued_at}-${item.bucket}`} emptyTitle="Sin facturas pendientes" emptyDescription="Las facturas con saldo abierto aparecerán aquí según su antigüedad." />
        </CardContent>
      </Card>
    </section>
  );
}

function pendingDate(value: unknown): string {
  const formatted = formatDate(String(value ?? ''));
  return formatted === '-' ? 'Fecha no disponible' : formatted;
}
