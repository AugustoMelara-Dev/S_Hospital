import { finiteNumber, formatLempirasUI } from '@/lib/moneyCents';
import { ChartCard } from '@/components/shared';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import type { ExecutiveReport } from '@/lib/api';

type PaymentMethodPanelProps = {
  report: ExecutiveReport;
};

const METHOD_COLORS: Record<string, string> = {
  cash: 'var(--color-success)',
  transfer: 'var(--color-info)',
  card: 'var(--color-secondary)',
  other: 'var(--color-warning)',
};

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

function safePaymentCount(value: number | string | null | undefined): number {
  return Math.max(0, Math.trunc(finiteNumber(value)));
}

function safePaymentPercentage(value: number | string | null | undefined): number {
  return Math.max(0, Math.min(100, finiteNumber(value)));
}

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

export function PaymentMethodPanel({ report }: PaymentMethodPanelProps) {
  const totalCollectedCents = report.summary.collected_total_cents;
  const normalizedMethods = report.payment_methods.map((method) => ({
    ...method,
    count: safePaymentCount(method.count),
    percentage: safePaymentPercentage(method.percentage),
  }));
  const totalPaymentCount = normalizedMethods.reduce((acc, method) => acc + method.count, 0);
  const paymentMethodRows: PaymentMethodRow[] =
    normalizedMethods.length > 0
      ? [
          ...normalizedMethods.map((method) => ({
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
      description="Cuanto se cobro por efectivo, transferencia, tarjeta y otros metodos."
      caption="Las barras muestran participacion relativa; la tabla contiene los valores exactos."
    >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] xl:items-start">
          <div className="rounded-md border border-operational-border bg-operational-panel p-4">
            <p className="text-sm font-semibold text-foreground">Participacion por metodo</p>
            {normalizedMethods.length > 0 ? (
              <div className="mt-4 space-y-4" role="list" aria-label="Participacion por metodo de pago">
                {normalizedMethods.map((method) => (
                  <div key={method.method} role="listitem" className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-foreground">
                        {method.label} - {method.percentage.toFixed(2)}%
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-sm bg-muted" aria-hidden="true">
                      <div
                        className="h-full rounded-sm"
                        style={{
                          width: `${method.percentage}%`,
                          background: METHOD_COLORS[method.method] ?? 'var(--color-muted-foreground)',
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{method.count} pago{method.count === 1 ? '' : 's'}</span>
                      <span className="font-mono tabular-nums">{formatLempirasUI(method.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No hay pagos publicados en el periodo seleccionado.</p>
            )}
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
