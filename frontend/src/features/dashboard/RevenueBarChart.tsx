import {
  Bar,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
  Area,
} from 'recharts';
import { finiteNumber, formatLempiras } from '../../lib/money';
import { useElementWidth } from './useElementWidth';

type DailyTrendData = {
  date: string;
  total_billed: string;
  total_collected: string;
  invoice_count: number;
  payment_count: number;
};

type RevenueBarChartProps = {
  data: DailyTrendData[];
};

type TooltipValue = string | number | readonly (string | number)[] | undefined;
type TooltipName = string | number | undefined;

function numericTooltipValue(value: TooltipValue): number {
  if (typeof value === 'string' || typeof value === 'number') {
    return finiteNumber(value);
  }

  const scalar = Array.isArray(value) ? value[0] : 0;

  return finiteNumber(scalar ?? 0);
}

export function RevenueBarChart({ data }: RevenueBarChartProps) {
  const { ref, width } = useElementWidth();
  const chartData = data.map((d) => {
    // Format date from YYYY-MM-DD to DD/MM
    const dateParts = d.date.split('-');
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : d.date;

    return {
      name: formattedDate,
      Billed: finiteNumber(d.total_billed),
      Collected: finiteNumber(d.total_collected),
      invoices: d.invoice_count,
      payments: d.payment_count,
    };
  });

  const formatCurrency = (value: number) => {
    return `L. ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <div ref={ref} className="h-[300px] w-full min-w-px" style={{ minHeight: 300 }}>
      {width > 0 ? (
        <ComposedChart
          data={chartData}
          width={width}
          height={300}
          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorBilled" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" opacity={0.5} />
          <XAxis
            dataKey="name"
            stroke="var(--color-muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--color-muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatCurrency}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-card)',
              borderColor: 'var(--color-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-foreground)',
              fontSize: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
            formatter={(value: TooltipValue, name: TooltipName) => [
              formatLempiras(numericTooltipValue(value)),
              name === 'Billed' ? 'Facturado' : 'Cobrado',
            ]}
            labelStyle={{ fontWeight: 'bold', marginBottom: '4px' }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span className="text-xs font-medium text-foreground">
                {value === 'Billed' ? 'Facturado (emision)' : 'Cobrado (pagos)'}
              </span>
            )}
          />
          <Area
            type="monotone"
            dataKey="Billed"
            fill="url(#colorBilled)"
            stroke="var(--color-primary)"
            strokeWidth={2}
            activeDot={{ r: 6 }}
          />
          <Bar
            dataKey="Collected"
            barSize={24}
            fill="url(#colorCollected)"
            stroke="var(--color-success)"
            strokeWidth={1.5}
            radius={[4, 4, 0, 0]}
          />
        </ComposedChart>
      ) : null}
    </div>
  );
}
