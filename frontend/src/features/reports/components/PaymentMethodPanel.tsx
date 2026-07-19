import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Chart, formatHnl } from '@/design-system/patterns/Chart';
import { DataTable, type InstitutionalColumn } from '@/design-system/patterns/DataTable';
import { finiteNumber } from '@/lib/moneyCents';
import type { ExecutiveReport } from '@/lib/api';

type PaymentMethodPanelProps = { report: ExecutiveReport };
type Row = { key: string; label: string; amount: number; count: number; percentage: number };
const chartConfig = { amount: { label: 'Recaudado', color: 'var(--chart-2)' } } satisfies ChartConfig;
const columns: Array<InstitutionalColumn<Row>> = [
  { accessorKey: 'label', header: 'Método' },
  { accessorKey: 'amount', header: 'Monto', meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums">{formatHnl(row.original.amount)}</span> },
  { accessorKey: 'count', header: 'Pagos', meta: { numeric: true } },
  { accessorKey: 'percentage', header: '% del total', meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums">{row.original.percentage.toFixed(2)}%</span> },
];

export function PaymentMethodPanel({ report }: PaymentMethodPanelProps) {
  const methods = report.payment_methods.map((method) => ({
    key: method.method,
    label: method.label,
    amount: finiteNumber(method.amount),
    count: Math.max(0, Math.trunc(finiteNumber(method.count))),
    percentage: Math.max(0, Math.min(100, finiteNumber(method.percentage))),
  }));
  const rows: Row[] = methods.length ? [...methods, {
    key: 'total',
    label: 'Total',
    amount: report.summary.collected_total_cents / 100,
    count: methods.reduce((sum, item) => sum + item.count, 0),
    percentage: 100,
  }] : [];
  const table = (
    <table className="w-full text-sm">
      <caption className="sr-only">Recaudación por método de pago</caption>
      <thead><tr className="border-b"><th className="p-2 text-left">Método</th><th className="p-2 text-right">Monto</th><th className="p-2 text-right">Pagos</th><th className="p-2 text-right">Porcentaje</th></tr></thead>
      <tbody>{rows.map((row) => <tr key={row.key} className="border-b last:border-0"><td className="p-2">{row.label}</td><td className="p-2 text-right tabular-nums">{formatHnl(row.amount)}</td><td className="p-2 text-right tabular-nums">{row.count}</td><td className="p-2 text-right tabular-nums">{row.percentage.toFixed(2)}%</td></tr>)}</tbody>
    </table>
  );

  return (
    <section aria-labelledby="payment-method-title">
      <Card>
        <CardHeader>
          <CardTitle><h3 id="payment-method-title">Recaudación por método de pago</h3></CardTitle>
          <CardDescription>Cuánto se cobró por efectivo, transferencia, tarjeta y otros métodos.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Chart ariaLabel="Participación por método de pago" summary={`${methods.length} métodos con pagos publicados.`} alternativeTable={table} state={methods.length ? 'ready' : 'empty'} config={chartConfig}>
            <BarChart data={methods} accessibilityLayer={false} layout="vertical" margin={{ left: 12, right: 24 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} tickFormatter={(value: number) => `L ${value}`} />
              <YAxis dataKey="label" type="category" tickLine={false} axisLine={false} width={96} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatHnl(Number(value))} />} />
              <Bar dataKey="amount" fill="var(--color-amount)" radius={6} />
            </BarChart>
          </Chart>
          <DataTable ariaLabel="Métodos de pago" data={rows} columns={columns} getRowId={(row) => row.key} emptyTitle="Sin métodos de pago" emptyDescription="No hay pagos publicados en el período." />
        </CardContent>
      </Card>
    </section>
  );
}
