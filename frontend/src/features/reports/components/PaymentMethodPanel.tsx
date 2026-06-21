import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { formatLempirasUI } from '@/lib/moneyCents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ExecutiveReport } from '@/lib/api';
import { useElementWidth } from '../../dashboard/useElementWidth';

type PaymentMethodPanelProps = {
  report: ExecutiveReport;
};

const METHOD_COLORS: Record<string, string> = {
  cash: '#047857',
  transfer: '#0369a1',
  card: '#0d9488',
  other: '#b45309',
};

type TooltipPayloadEntry = { name?: string; value?: number };

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recaudacion por metodo de pago</CardTitle>
        <p className="text-xs text-muted-foreground">
          Distribucion del cobro. Efectivo alimenta caja; los demas metodos se concilian por separado.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <div ref={ref} className="h-48 w-full min-w-px">
            {width > 0 ? (
              <PieChart width={width} height={192}>
                <Tooltip content={<PieTooltip />} />
                <Pie
                  data={data}
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={1}
                  dataKey="value"
                  isAnimationActive={false}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {data.map((entry) => (
                    <Cell
                      key={entry.key}
                      fill={METHOD_COLORS[entry.key] ?? '#475569'}
                    />
                  ))}
                </Pie>
              </PieChart>
            ) : null}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metodo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Pagos</TableHead>
                <TableHead className="text-right">% del total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.payment_methods.map((method) => (
                <TableRow key={method.method}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block size-2 rounded-sm"
                        style={{ background: METHOD_COLORS[method.method] ?? '#475569' }}
                        aria-hidden="true"
                      />
                      {method.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatLempirasUI(method.amount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{method.count}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {method.percentage.toFixed(2)}%
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 border-border bg-muted/40">
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="text-right font-mono tabular-nums font-semibold">
                  {formatLempirasUI(totalCollectedCents / 100)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {report.payment_methods.reduce((acc, m) => acc + m.count, 0)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">100.00%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
