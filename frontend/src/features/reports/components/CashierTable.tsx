import { formatLempirasUI } from '@/lib/moneyCents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import type { ExecutiveReport } from '@/lib/api';

type CashierTableProps = {
  report: ExecutiveReport;
};

export function CashierTable({ report }: CashierTableProps) {
  const columns: Array<DataTableColumn<ExecutiveReport['cashiers'][number]>> = [
    {
      key: 'cashier',
      header: 'Cajero',
      render: (cashier) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{cashier.name}</span>
          <span className="text-xs text-muted-foreground">@{cashier.username}</span>
        </div>
      ),
    },
    {
      key: 'collected',
      header: 'Cobrado',
      numeric: true,
      cellClassName: 'font-mono tabular-nums font-semibold',
      render: (cashier) => formatLempirasUI(cashier.collected),
    },
    {
      key: 'cash',
      header: 'Efectivo',
      numeric: true,
      cellClassName: 'font-mono tabular-nums text-secondary',
      render: (cashier) => formatLempirasUI(cashier.cash),
    },
    {
      key: 'transfer',
      header: 'Transferencia',
      numeric: true,
      cellClassName: 'font-mono tabular-nums',
      render: (cashier) => formatLempirasUI(cashier.transfer),
    },
    {
      key: 'card',
      header: 'Tarjeta',
      numeric: true,
      cellClassName: 'font-mono tabular-nums',
      render: (cashier) => formatLempirasUI(cashier.card),
    },
    {
      key: 'other',
      header: 'Otro',
      numeric: true,
      cellClassName: 'font-mono tabular-nums',
      render: (cashier) => formatLempirasUI(cashier.other),
    },
    {
      key: 'payments',
      header: 'Pagos',
      numeric: true,
      render: (cashier) => cashier.payment_count,
    },
    {
      key: 'voided',
      header: 'Anuladas',
      numeric: true,
      render: (cashier) => cashier.voided_count,
    },
    {
      key: 'difference',
      header: 'Diferencia',
      numeric: true,
      cellClassName: 'font-mono tabular-nums',
      render: (cashier) => (cashier.difference_total !== '0.00' ? formatLempirasUI(cashier.difference_total) : '-'),
    },
  ];

  if (report.cashiers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cajeros</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Sin pagos en el periodo.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cajeros</CardTitle>
        <p className="text-xs text-muted-foreground">
          Recaudacion por cajero. Responde: que cajero cobro mas.
        </p>
      </CardHeader>
      <CardContent>
        <DataTable
          containerLabel="Recaudacion por cajero"
          rows={report.cashiers}
          columns={columns}
          getRowKey={(cashier) => cashier.user_id}
        />
      </CardContent>
    </Card>
  );
}
