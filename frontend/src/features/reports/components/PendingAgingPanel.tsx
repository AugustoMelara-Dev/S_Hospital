import { formatLempirasUI } from '@/lib/moneyCents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { StatGrid } from '@/components/shared';
import type { ExecutiveReport } from '@/lib/api';
import { formatDate } from '@/lib/format/formatDate';

type PendingAgingPanelProps = {
  report: ExecutiveReport;
};

type PendingInvoice = ExecutiveReport['pending_aging']['items'][number];

const pendingInvoiceColumns: Array<DataTableColumn<PendingInvoice>> = [
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
    render: (item) => item.patient,
  },
  {
    key: 'issued_at',
    header: 'Emitida',
    cellClassName: 'text-xs text-muted-foreground',
    render: (item) => formatInvoiceDate(item.issued_at),
  },
  {
    key: 'age_days',
    header: 'Antiguedad',
    numeric: true,
    cellClassName: 'tabular-nums',
    render: (item) => `${item.age_days} d`,
  },
  {
    key: 'total',
    header: 'Total',
    numeric: true,
    cellClassName: 'font-mono tabular-nums',
    render: (item) => formatLempirasUI(item.total),
  },
  {
    key: 'balance_due',
    header: 'Saldo',
    numeric: true,
    cellClassName: 'font-mono tabular-nums font-semibold',
    render: (item) => formatLempirasUI(item.balance_due),
  },
];

export function PendingAgingPanel({ report }: PendingAgingPanelProps) {
  const aging = report.pending_aging;
  const buckets = [
    { key: '0_7_days', label: '0 a 7 dias' },
    { key: '8_30_days', label: '8 a 30 dias' },
    { key: '31_plus_days', label: '31 o mas dias' },
  ] as const;
  const bucketItems = buckets.map((bucket) => {
    const value = aging[bucket.key];

    return {
      label: bucket.label,
      value: value.count,
      helper: formatLempirasUI(value.amount),
    };
  });

  return (
    <Card className="overflow-hidden rounded-2xl border-operational-border shadow-operational">
      <CardHeader className="border-b border-border bg-muted/35">
        <CardTitle className="text-base">Pendientes y antiguedad</CardTitle>
        <p className="text-xs text-muted-foreground">
          Facturas con saldo abierto, agrupadas por dias desde la emision.
        </p>
      </CardHeader>
      <CardContent className="p-5">
        <StatGrid className="mb-4 sm:grid-cols-3 xl:grid-cols-3" items={bucketItems} />

        <DataTable
          caption="Facturas pendientes por antiguedad."
          columns={pendingInvoiceColumns}
          containerLabel="Facturas pendientes"
          emptyDescription="Las facturas con saldo abierto apareceran cuando el periodo tenga actividad pendiente."
          emptyTitle="Sin facturas pendientes"
          getRowKey={(item) => `${item.invoice_number}-${item.issued_at}-${item.bucket}`}
          rows={aging.items}
          tableClassName="min-w-[760px]"
        />
      </CardContent>
    </Card>
  );
}

function formatInvoiceDate(value: string): string {
  const formatted = formatDate(value);

  return formatted === '-' ? 'Fecha no disponible' : formatted;
}
