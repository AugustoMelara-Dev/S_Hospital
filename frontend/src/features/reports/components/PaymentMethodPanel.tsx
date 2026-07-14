import { Typography } from 'antd';
import { InstitutionalChart, formatHnl } from '@/design-system/echarts';
import { InstitutionalDataGrid, type InstitutionalColumn } from '@/design-system/ag-grid';
import { finiteNumber } from '@/lib/moneyCents';
import type { ExecutiveReport } from '@/lib/api';

type PaymentMethodPanelProps = { report: ExecutiveReport };
type Row = { key: string; label: string; amount: number; count: number; percentage: number };
const tooltipMoney = (value: unknown) => formatHnl(Number(value));
const columns: InstitutionalColumn<Row>[] = [{ field: 'label', headerName: 'Método', priority: 'primary', flex: 1 }, { field: 'amount', headerName: 'Monto', priority: 'primary', valueFormatter: ({ value }) => formatHnl(Number(value)) }, { field: 'count', headerName: 'Pagos', priority: 'secondary' }, { field: 'percentage', headerName: '% del total', priority: 'secondary', valueFormatter: ({ value }) => `${Number(value).toFixed(2)}%` }];

export function PaymentMethodPanel({ report }: PaymentMethodPanelProps) {
  const methods = report.payment_methods.map((method) => ({ key: method.method, label: method.label, amount: finiteNumber(method.amount), count: Math.max(0, Math.trunc(finiteNumber(method.count))), percentage: Math.max(0, Math.min(100, finiteNumber(method.percentage))) }));
  const rows: Row[] = methods.length ? [...methods, { key: 'total', label: 'Total', amount: report.summary.collected_total_cents / 100, count: methods.reduce((sum, item) => sum + item.count, 0), percentage: 100 }] : [];
  const table = <table><caption>Recaudación por método de pago</caption><thead><tr><th>Método</th><th>Monto</th><th>Pagos</th><th>Porcentaje</th></tr></thead><tbody>{rows.map((row) => <tr key={row.key}><td>{row.label}</td><td>{formatHnl(row.amount)}</td><td>{row.count}</td><td>{row.percentage.toFixed(2)}%</td></tr>)}</tbody></table>;
  const option = { tooltip: { trigger: 'axis', valueFormatter: tooltipMoney }, grid: { left: 100, right: 24, top: 24, bottom: 32 }, xAxis: { type: 'value' }, yAxis: { type: 'category', data: methods.map((item) => item.label) }, series: [{ type: 'bar', name: 'Recaudado', data: methods.map((item) => item.amount) }] };
  return <section aria-labelledby="payment-method-title" className="border border-border p-4"><Typography.Title id="payment-method-title" level={3}>Recaudación por método de pago</Typography.Title><Typography.Paragraph>Cuánto se cobró por efectivo, transferencia, tarjeta y otros métodos.</Typography.Paragraph><InstitutionalChart ariaLabel="Participación por método de pago" summary={`${methods.length} métodos con pagos publicados.`} alternativeTable={table} state={methods.length ? 'ready' : 'empty'} option={option} /><InstitutionalDataGrid ariaLabel="Métodos de pago" rows={rows} columns={columns} getRowId={(row) => row.key} state={rows.length ? 'ready' : 'empty'} density="compact" gridOptions={{ pagination: false }} /></section>;
}
