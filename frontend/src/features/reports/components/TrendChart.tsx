import { CartesianGrid, Line, LineChart as RechartsLineChart, XAxis, YAxis } from 'recharts';
import { ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Chart, formatHnl } from '@/design-system/patterns/Chart';
import { finiteNumber } from '@/lib/moneyCents';
import type { ExecutiveReport } from '@/lib/api';

type TrendChartProps = { report: ExecutiveReport };
const validDate = (date: string) => Number.isNaN(new Date(date).getTime()) ? 'Fecha no disponible' : date;
const chartConfig = {
  billed: { label: 'Facturado', color: 'var(--chart-1)' },
  collected: { label: 'Cobrado', color: 'var(--chart-2)' },
  pending: { label: 'Pendiente', color: 'var(--chart-3)' },
} satisfies ChartConfig;

export function TrendChart({ report }: TrendChartProps) {
  const data = report.daily_trend.map((day) => ({
    date: validDate(day.date),
    billed: finiteNumber(day.billed),
    collected: finiteNumber(day.collected),
    pending: finiteNumber(day.pending),
  }));
  const table = (
    <table className="w-full text-sm">
      <caption className="sr-only">Tendencia diaria del reporte ejecutivo</caption>
      <thead><tr className="border-b"><th className="p-2 text-left">Fecha</th><th className="p-2 text-right">Facturado</th><th className="p-2 text-right">Cobrado</th><th className="p-2 text-right">Pendiente</th></tr></thead>
      <tbody>{data.map((day) => <tr key={day.date} className="border-b last:border-0"><td className="p-2">{day.date}</td><td className="p-2 text-right tabular-nums">{formatHnl(day.billed)}</td><td className="p-2 text-right tabular-nums">{formatHnl(day.collected)}</td><td className="p-2 text-right tabular-nums">{formatHnl(day.pending)}</td></tr>)}</tbody>
    </table>
  );

  return (
    <section aria-labelledby="trend-title">
      <Card>
        <CardHeader>
          <CardTitle><h3 id="trend-title">Tendencia diaria</h3></CardTitle>
          <CardDescription>Facturado vs cobrado por día. La tabla contiene los valores exactos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Chart ariaLabel="Gráfico de tendencia diaria de facturación y cobros" summary={`${data.length} ${data.length === 1 ? 'día' : 'días'} con actividad en el periodo.`} alternativeTable={table} state={data.length ? 'ready' : 'empty'} config={chartConfig}>
            <RechartsLineChart data={data} accessibilityLayer={false} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value: string) => value === 'Fecha no disponible' ? value : value.slice(5)} />
              <YAxis tickLine={false} axisLine={false} tickFormatter={(value: number) => `L ${value}`} width={64} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatHnl(Number(value))} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line dataKey="billed" type="monotone" stroke="var(--color-billed)" strokeWidth={2} dot={false} />
              <Line dataKey="collected" type="monotone" stroke="var(--color-collected)" strokeWidth={2} dot={false} />
              <Line dataKey="pending" type="monotone" stroke="var(--color-pending)" strokeWidth={2} dot={false} />
            </RechartsLineChart>
          </Chart>
        </CardContent>
      </Card>
    </section>
  );
}
