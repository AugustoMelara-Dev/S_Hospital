import { useEffect, useRef, useState } from 'react';
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { formatCents } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { Button, Money } from '@/ui';
import './viz.css';

export type TrendPoint = { date: string; billed_cents: number; collected_cents: number };

const SERIES = [
  { key: 'billed_cents', label: 'Facturado', color: 'var(--series-1)' },
  { key: 'collected_cents', label: 'Cobrado', color: 'var(--series-2)' },
] as const;

/** Compact L axis tick: 1234500 → "L 12,345"; whole lempiras, tabular. */
function axisTick(v: number): string {
  const whole = Math.round(v / 100);
  return `L ${whole.toLocaleString('en-US')}`;
}

function shortDay(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w !== undefined) setWidth(Math.floor(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

type TipProps = { active?: boolean; label?: string | number; payload?: Array<{ dataKey?: unknown; value?: unknown }> };

function ChartTooltip({ active, label, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius-sm)] border border-junta bg-surface px-3 py-2 text-[12.5px] shadow-[var(--shadow-pop)]">
      <p className="num mb-1 font-semibold text-ink">{typeof label === 'string' ? formatDate(label) : label}</p>
      {SERIES.map((s) => {
        const v = payload.find((p) => p.dataKey === s.key)?.value;
        return (
          <p key={s.key} className="flex items-center justify-between gap-4 text-ink-2">
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-[3px] w-3" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="num text-ink">{typeof v === 'number' ? formatCents(v) : '—'}</span>
          </p>
        );
      })}
    </div>
  );
}

/** Daily trend, Facturado vs Cobrado (one shared L axis, legend + table view). */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [asTable, setAsTable] = useState(false);
  const billed = data.reduce((s, d) => s + d.billed_cents, 0);
  const collected = data.reduce((s, d) => s + d.collected_cents, 0);
  const summary = `Tendencia diaria de ${data.length} días. Facturado ${formatCents(billed)}, cobrado ${formatCents(collected)}.`;

  return (
    <figure className="viz-root m-0 flex flex-col gap-2" aria-label="Facturado contra cobrado por día">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ul className="flex items-center gap-4 text-[12.5px] text-ink-2" aria-label="Leyenda">
          {SERIES.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-[3px] w-4" style={{ background: s.color }} />
              {s.label}
            </li>
          ))}
        </ul>
        <Button size="sm" variant="ghost" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? 'Ver gráfica' : 'Ver tabla'}
        </Button>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
      {asTable ? (
        <div className="max-h-[260px] overflow-y-auto">
          <table className="w-full text-[13px]">
            <caption className="sr-only">Facturado y cobrado por día</caption>
            <thead>
              <tr className="border-b border-junta text-[12px] text-ink-2">
                <th scope="col" className="py-1.5 text-left font-semibold">
                  Fecha
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Facturado
                </th>
                <th scope="col" className="py-1.5 text-right font-medium">
                  Cobrado
                </th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.date} className="border-b border-junta last:border-0">
                  <th scope="row" className="num py-1.5 text-left font-normal">
                    {formatDate(d.date)}
                  </th>
                  <td className="py-1.5 text-right">
                    <Money cents={d.billed_cents} />
                  </td>
                  <td className="py-1.5 text-right">
                    <Money cents={d.collected_cents} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="h-[220px] w-full" aria-hidden="true">
          {width > 0 && (
            <LineChart width={width} height={220} data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeDasharray="0" />
              <XAxis
                dataKey="date"
                tickFormatter={shortDay}
                tick={{ fill: 'var(--viz-axis)', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                axisLine={{ stroke: 'var(--viz-base)' }}
                tickLine={false}
                minTickGap={16}
              />
              <YAxis
                tickFormatter={axisTick}
                tick={{ fill: 'var(--viz-axis)', fontSize: 11, fontFamily: 'var(--font-sans)' }}
                axisLine={false}
                tickLine={false}
                width={84}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--junta-strong)', strokeWidth: 1 }} />
              {SERIES.map((s) => (
                <Line
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  dot={data.length <= 1 ? { r: 4, fill: s.color, stroke: 'var(--surface)', strokeWidth: 2 } : false}
                  activeDot={{ r: 4, fill: s.color, stroke: 'var(--surface)', strokeWidth: 2 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          )}
        </div>
      )}
    </figure>
  );
}
