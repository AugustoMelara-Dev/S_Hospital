import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { type MoneyByMethod } from '../../lib/api';

type PaymentMethodPieChartProps = {
  data: MoneyByMethod;
};

const COLORS = {
  cash: 'var(--color-success)',
  transfer: 'var(--color-info)',
  card: 'var(--color-secondary)',
  other: 'var(--color-warning)',
};

const LABELS = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  other: 'Otro',
};

export function PaymentMethodPieChart({ data }: PaymentMethodPieChartProps) {
  const chartData = Object.entries(data)
    .map(([method, amountStr]) => ({
      name: LABELS[method as keyof typeof LABELS] || method,
      value: parseFloat(amountStr) || 0,
      key: method,
    }))
    .filter((d) => d.value > 0);

  const total = chartData.reduce((acc, curr) => acc + curr.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-md border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Sin ingresos cobrados hoy
      </div>
    );
  }

  return (
    <div className="h-[240px] w-full" style={{ minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={4}
            dataKey="value"
          >
            {chartData.map((entry) => (
              <Cell
                key={`cell-${entry.key}`}
                fill={COLORS[entry.key as keyof typeof COLORS] || '#94a3b8'}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              borderColor: 'var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--foreground)',
              fontSize: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [
              `L. ${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${((Number(value ?? 0) / total) * 100).toFixed(1)}%)`,
              'Total',
            ]}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            formatter={(value) => {
              const item = chartData.find((d) => d.name === value);
              const amountStr = item ? ` (L. ${Math.round(item.value).toLocaleString()})` : '';
              return <span className="text-xs text-muted-foreground">{value}{amountStr}</span>;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
