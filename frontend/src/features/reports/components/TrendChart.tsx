import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatLempirasUI } from '@/lib/moneyCents';
import { ChartCard } from '@/components/shared';
import type { ExecutiveReport } from '@/lib/api';

type TrendChartProps = {
  report: ExecutiveReport;
};

const CHART_COLORS = {
  billed: 'var(--color-foreground)',
  collected: 'var(--color-secondary)',
  pending: 'var(--color-warning)',
  voided: 'var(--color-destructive)',
  axis: 'var(--color-muted-foreground)',
  grid: 'var(--color-border)',
  cursor: 'var(--color-border)',
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
  const data = report.daily_trend.map((day) => ({
    date: day.date,
    day: formatDay(day.date),
    Facturado: Number(day.billed),
    Cobrado: Number(day.collected),
    Pendiente: Number(day.pending),
  }));

  return (
    <ChartCard
      title="Tendencia diaria"
      description="Facturado vs cobrado por dia. Responde: cuanto se emite y cuanto realmente se cobra."
      caption="La tabla oculta para lectores de pantalla contiene los valores exactos del grafico."
    >
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
      <div
        className="h-80 w-full"
        role="img"
        aria-label="Grafico de tendencia diaria; la tabla oculta para lectores de pantalla contiene los valores exactos."
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
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
            <Tooltip content={<TrendTooltip />} cursor={{ stroke: CHART_COLORS.cursor, strokeWidth: 1 }} />
            <Legend iconType="square" wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
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
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}