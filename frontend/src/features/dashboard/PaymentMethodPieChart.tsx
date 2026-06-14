import { Cell, Legend, Pie, PieChart, Tooltip } from 'recharts';
import { type MoneyByMethod } from '../../lib/api';
import { finiteNumber, formatLempiras } from '../../lib/money';
import { useElementWidth } from './useElementWidth';

type PaymentMethodPieChartProps = {
  data: MoneyByMethod;
};

type TooltipValue = string | number | readonly (string | number)[] | undefined;

function numericTooltipValue(value: TooltipValue): number {
  if (typeof value === 'string' || typeof value === 'number') {
    return finiteNumber(value);
  }

  const scalar = Array.isArray(value) ? value[0] : 0;

  return finiteNumber(scalar ?? 0);
}

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
  const { ref, width } = useElementWidth();
  const chartData = Object.entries(data)
    .map(([method, amountStr]) => ({
      name: LABELS[method as keyof typeof LABELS] || method,
      value: finiteNumber(amountStr),
      key: method,
    }))
    .filter((d) => d.value > 0);

  const total = chartData.reduce((acc, curr) => acc + curr.value, 0);

  if (total === 0) {
    return (
      <div className="flex h-[240px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/20 px-6 text-center text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Sin cobros registrados hoy</span>
        <span>Los metodos de pago apareceran aqui al registrar pagos en caja.</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="h-[240px] w-full min-w-px" style={{ minHeight: 240 }}>
      {width > 0 ? (
        <PieChart width={width} height={240}>
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
                fill={COLORS[entry.key as keyof typeof COLORS] || 'var(--color-muted-foreground)'}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-card)',
              borderColor: 'var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-foreground)',
              fontSize: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
            formatter={(value: TooltipValue) => {
              const numericValue = numericTooltipValue(value);

              return [
                `${formatLempiras(numericValue)} (${((numericValue / total) * 100).toFixed(1)}%)`,
                'Total',
              ];
            }}
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
      ) : null}
    </div>
  );
}
