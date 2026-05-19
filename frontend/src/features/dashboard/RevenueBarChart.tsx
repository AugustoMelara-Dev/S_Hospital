import {
  Bar,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
  Area,
} from 'recharts';

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

export function RevenueBarChart({ data }: RevenueBarChartProps) {
  const chartData = data.map((d) => {
    // Format date from YYYY-MM-DD to DD/MM
    const dateParts = d.date.split('-');
    const formattedDate = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}` : d.date;

    return {
      name: formattedDate,
      Billed: parseFloat(d.total_billed),
      Collected: parseFloat(d.total_collected),
      invoices: d.invoice_count,
      payments: d.payment_count,
    };
  });

  const formatCurrency = (value: number) => {
    return `L. ${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  return (
    <div className="h-[300px] w-full" style={{ minWidth: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorBilled" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
          <XAxis
            dataKey="name"
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={formatCurrency}
          />
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
            formatter={(value: any, name: any) => [
              `L. ${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
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
                {value === 'Billed' ? 'Facturado (Ventas)' : 'Cobrado (Flujo)'}
              </span>
            )}
          />
          <Area
            type="monotone"
            dataKey="Billed"
            fill="url(#colorBilled)"
            stroke="var(--primary)"
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
      </ResponsiveContainer>
    </div>
  );
}
