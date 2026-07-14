import { Typography } from 'antd';
import { InstitutionalChart, formatHnl } from '@/design-system/echarts';
import { finiteNumber } from '@/lib/moneyCents';
import type { ExecutiveReport } from '@/lib/api';

type TrendChartProps = { report: ExecutiveReport };
const validDate = (date: string) => Number.isNaN(new Date(date).getTime()) ? 'Fecha no disponible' : date;
const tooltipMoney = (value: unknown) => formatHnl(Number(value));

export function TrendChart({ report }: TrendChartProps) {
  const data = report.daily_trend.map((day) => ({ date: validDate(day.date), billed: finiteNumber(day.billed), collected: finiteNumber(day.collected), pending: finiteNumber(day.pending) }));
  const table = <table><caption>Tendencia diaria del reporte ejecutivo</caption><thead><tr><th>Fecha</th><th>Facturado</th><th>Cobrado</th><th>Pendiente</th></tr></thead><tbody>{data.map((day) => <tr key={day.date}><td>{day.date}</td><td>{formatHnl(day.billed)}</td><td>{formatHnl(day.collected)}</td><td>{formatHnl(day.pending)}</td></tr>)}</tbody></table>;
  const option = {
    tooltip: { trigger: 'axis', valueFormatter: tooltipMoney },
    legend: { data: ['Facturado', 'Cobrado', 'Pendiente'] },
    grid: { left: 72, right: 24, top: 48, bottom: 40 },
    xAxis: { type: 'category', data: data.map((item) => item.date.slice(5)) },
    yAxis: { type: 'value' },
    series: [
      { name: 'Facturado', type: 'line', data: data.map((item) => item.billed), smooth: true },
      { name: 'Cobrado', type: 'line', data: data.map((item) => item.collected), smooth: true },
      { name: 'Pendiente', type: 'line', data: data.map((item) => item.pending), smooth: true },
    ],
  };
  return <section aria-labelledby="trend-title" className="border border-slate-300 p-4"><Typography.Title id="trend-title" level={3}>Tendencia diaria</Typography.Title><Typography.Paragraph>Facturado vs cobrado por día. La tabla contiene los valores exactos.</Typography.Paragraph><InstitutionalChart ariaLabel="Gráfico de tendencia diaria de facturación y cobros" summary={`${data.length} ${data.length === 1 ? 'día' : 'días'} con actividad en el periodo.`} alternativeTable={table} state={data.length ? 'ready' : 'empty'} option={option} /></section>;
}
