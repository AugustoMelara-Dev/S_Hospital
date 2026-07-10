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
import { finiteNumber, formatLempirasUI } from '@/lib/moneyCents';
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
  if (!isValidDate(date)) return 'Fecha no disponible';

  return date.slice(5);
}

function formatTableDate(date: string): string {
  return isValidDate(date) ? date : 'Fecha no disponible';
}

function isValidDate(date: string): boolean {
  const parsed = new Date(date);

  return !Number.isNaN(parsed.getTime());
}

function formatMoneyShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(0);
}

function safeTrendAmount(value: string): number {
  return finiteNumber(value);
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
    date: formatTableDate(day.date),
    day: formatDay(day.date),
    Facturado: safeTrendAmount(day.billed),
    Cobrado: safeTrendAmount(day.collected),
    Pendiente: safeTrendAmount(day.pending),
  }));

  return (
    <ChartCard
      title="Tendencia diaria"
      description="Facturado vs cobrado por dia. Responde: cuanto se emite y cuanto realmente se cobra."
      caption="La tabla contiene los mismos valores exactos que el grafico."
    >
      <p className="mb-3 text-sm font-medium text-foreground">
        {data.length} {data.length === 1 ? 'dia' : 'dias'} con actividad en el periodo.
      </p>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)] xl:items-start">
        <div
          className="h-80 min-w-0 w-full"
          role="img"
          aria-label="Grafico de tendencia diaria de facturacion y cobros; la tabla contigua contiene los valores exactos."
        >
          <ResponsiveContainer width="100%" height={320} minWidth={0}>
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
              <XAxis dataKey="day" tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} tickLine={false} axisLine={{ stroke: CHART_COLORS.grid }} />
              <YAxis tick={{ fill: CHART_COLORS.axis, fontSize: 11 }} tickFormatter={formatMoneyShort} tickLine={false} axisLine={false} width={50} />
              <Tooltip content={<TrendTooltip />} cursor={{ stroke: CHART_COLORS.cursor, strokeWidth: 1 }} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
              <Area type="monotone" dataKey="Facturado" stroke={CHART_COLORS.billed} fill="url(#billed-fill)" strokeWidth={2} isAnimationActive={false} />
              <Area type="monotone" dataKey="Cobrado" stroke={CHART_COLORS.collected} fill="url(#collected-fill)" strokeWidth={2} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div
          role="region"
          aria-label="Datos exactos de tendencia diaria"
          aria-describedby="trend-table-scroll-help"
          tabIndex={0}
          className="max-h-80 overflow-auto rounded-md border border-operational-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <p id="trend-table-scroll-help" className="sr-only">
            Desplace horizontalmente para consultar todas las columnas de la tabla.
          </p>
          <table className="w-full min-w-[28rem] border-collapse text-sm">
          <caption>Tendencia diaria del reporte ejecutivo</caption>
          <thead className="sticky top-0 bg-operational-panel text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2" scope="col">Fecha</th>
              <th className="px-3 py-2 text-right" scope="col">Facturado</th>
              <th className="px-3 py-2 text-right" scope="col">Cobrado</th>
              <th className="px-3 py-2 text-right" scope="col">Pendiente</th>
            </tr>
          </thead>
          <tbody>
            {data.map((day) => (
              <tr key={day.date} className="border-t border-operational-border">
                <td className="px-3 py-2 tabular-nums">{day.date}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{formatLempirasUI(day.Facturado)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{formatLempirasUI(day.Cobrado)}</td>
                <td className="px-3 py-2 text-right font-mono tabular-nums">{formatLempirasUI(day.Pendiente)}</td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>
    </ChartCard>
  );
}
