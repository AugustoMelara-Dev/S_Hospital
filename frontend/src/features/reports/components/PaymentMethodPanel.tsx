import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { formatLempirasUI } from '@/lib/moneyCents';
import { ChartCard } from '@/components/shared';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import type { ExecutiveReport } from '@/lib/api';
import { useElementWidth } from '../../dashboard/useElementWidth';

type PaymentMethodPanelProps = {
  report: ExecutiveReport;
};

const METHOD_COLORS: Record<string, string> = {
  cash: 'var(--color-success)',
  transfer: 'var(--color-info)',
  card: 'var(--color-secondary)',
  other: 'var(--color-warning)',
};

type TooltipPayloadEntry = { name?: string; value?: number };
type PaymentMethod = ExecutiveReport['payment_methods'][number];
type PaymentMethodRow = {
  amount: string | number;
  count: number;
  isTotal?: boolean;
  key: string;
  label: string;
  method: PaymentMethod['method'] | 'total';
  percentage: number;
};

const paymentMethodColumns: Array<DataTableColumn<PaymentMethodRow>> = [
  {
    key: 'method',
    header: 'Metodo',
    render: (row) => (
      <span className="flex items-center gap-2">
        {!row.isTotal ? (
          <span
            className="inline-block size-2 rounded-sm"
            style={{ background: METHOD_COLORS[row.method] ?? 'var(--color-muted-foreground)' }}
            aria-hidden="true"
          />
        ) : null}
        <span className={row.isTotal ? 'font-semibold' : undefined}>{row.label}</span>
      </span>
    ),
  },
  {
    key: 'amount',
    header: 'Monto',
    numeric: true,
    cellClassName: 'font-mono tabular-nums',
    render: (row) => formatLempirasUI(row.amount),
  },
  {
    key: 'count',
    header: 'Pagos',
    numeric: true,
    render: (row) => row.count,
  },
  {
    key: 'percentage',
    header: '% del total',
    numeric: true,
    render: (row) => `${row.percentage.toFixed(2)}%`,
  },
];

function PieTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  return (
    <div className="rounded border border-border bg-card p-2 text-xs shadow-sm">
      <p className="font-semibold text-foreground">{entry.name}</p>
      <p className="font-mono tabular-nums text-muted-foreground">
        {formatLempirasUI(entry.value ?? 0)}
      </p>
    </div>
  );
}

export function PaymentMethodPanel({ report }: PaymentMethodPanelProps) {
  const { ref, width } = useElementWidth();
  const totalCollectedCents = report.summary.collected_total_cents;
  const data = report.payment_methods.map((method) => ({
    name: method.label,
    value: Number(method.amount),
    key: method.method,
  }));
  const totalPaymentCount = report.payment_methods.reduce((acc, method) => acc + method.count, 0);
  const paymentMethodRows: PaymentMethodRow[] =
    report.payment_methods.length > 0
      ? [
          ...report.payment_methods.map((method) => ({
            amount: method.amount,
            count: method.count,
            key: method.method,
            label: method.label,
            method: method.method,
            percentage: method.percentage,
          })),
          {
            amount: totalCollectedCents / 100,
            count: totalPaymentCount,
            isTotal: true,
            key: 'total',
            label: 'Total',
            method: 'total',
            percentage: 100,
          },
        ]
      : [];

  return (
    <ChartCard
      title="Recaudacion por metodo de pago"
      description="Distribucion del cobro. Efectivo alimenta caja; los demas metodos se concilian por separado."
      caption="La tabla contigua contiene los valores exactos por metodo."
    >
        <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)] lg:items-center">
          <div
            ref={ref}
            className="h-56 w-full min-w-px"
            role="img"
            aria-label="Grafico de distribucion por metodo de pago; la tabla contigua contiene los valores exactos."
          >
            {width > 0 ? (
              <PieChart width={width} height={224}>
                <Tooltip content={<PieTooltip />} />
                <Pie
                  data={data}
                  innerRadius={54}
                  outerRadius={84}
                  paddingAngle={1}
                  dataKey="value"
                  isAnimationActive={false}
                  stroke="var(--color-card)"
                  strokeWidth={2}
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={METHOD_COLORS[entry.key] ?? 'var(--color-muted-foreground)'}
                    />
                  ))}
                </Pie>
              </PieChart>
            ) : null}
          </div>
          <DataTable
            caption="Recaudacion por metodo de pago."
            columns={paymentMethodColumns}
            containerLabel="Metodos de pago"
            emptyDescription="Los cobros por metodo apareceran cuando existan pagos publicados en el periodo."
            emptyTitle="Sin metodos de pago"
            getRowClassName={(row) => (row.isTotal ? 'border-t-2 border-border bg-muted/40 font-semibold' : undefined)}
            getRowKey={(row) => row.key}
            rows={paymentMethodRows}
          />
        </div>
    </ChartCard>
  );
}
