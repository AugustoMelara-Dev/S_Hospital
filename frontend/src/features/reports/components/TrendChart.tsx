import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatLempirasUI } from '@/lib/moneyCents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ExecutiveReport } from '@/lib/api';
import { useElementWidth } from '../../dashboard/useElementWidth';

type TrendChartProps = {
  report: ExecutiveReport;
};

const CHART_COLORS = {
  billed: '#0f172a',
  collected: '#0d9488',
  pending: '#b45309',
  voided: '#b91c1c',
  axis: '#94a3b8',
  grid: '#e2e8f0',
};

function formatDay(date: string): string {
  return date.slice(5);
}

function formatMoneyShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

type TooltipPayloadEntry = { name?: string; value?: number; color?: string };

type TrendTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
};

function TrendTooltip({ active, payload, label }: TrendTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded border border-border bg-card p-3 text-xs shadow-sm">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      <ul className="flex flex-col gap-1">
        {payload.map((entry) => (
          <li key={entry.name} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="inline-block size-2 rounded-sm" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <span className="font-mono tabular-nums text-foreground">
              {formatLempirasUI(entry.value ?? 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TrendChart({ report }: TrendChartProps) {
  const { ref, width } = useElementWidth();
  const data = report.daily_trend.map((day) => ({
    date: day.date,
    day: formatDay(day.date),
    Facturado: Number(day.billed),
    Cobrado: Number(day.collected),
    Pendiente: Number(day.pending),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tendencia diaria</CardTitle>
        <p className="text-xs text-muted-foreground">
          Facturado vs cobrado por dia. Responde: cuanto se emite y cuanto realmente se cobra.
        </p>
      </CardHeader>
      <CardContent>
        <div className="sr-only">
          <table>
            <caption>Tendencia diaria del reporte ejecutivo</caption>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Facturado</th>
                <th scope="col">Cobrado</th>
                <th scope="col">Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {data.map((day) => (
                <tr key={day.date}>
                  <td>{day.date}</td>
                  <td>{formatLempirasUI(day.Facturado)}</td>
                  <td>{formatLempirasUI(day.Cobrado)}</td>
                  <td>{formatLempirasUI(day.Pendiente)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div ref={ref} className="h-72 w-full min-w-px" aria-hidden="true">
          {width > 0 ? (
            <AreaChart width={width} height={288} data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="billed-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.billed} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={CHART_COLORS.billed} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="collected-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.collected} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={CHART_COLORS.collected} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="day"
                tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: CHART_COLORS.grid }}
              />
              <YAxis
                tick={{ fill: CHART_COLORS.axis, fontSize: 11 }}
                tickFormatter={formatMoneyShort}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }} />
              <Legend
                iconType="square"
                wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
              />
              <Area
                type="monotone"
                dataKey="Facturado"
                stroke={CHART_COLORS.billed}
                fill="url(#billed-fill)"
                strokeWidth={2}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="Cobrado"
                stroke={CHART_COLORS.collected}
                fill="url(#collected-fill)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </AreaChart>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
