import { formatLempirasUI } from '@/lib/moneyCents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ExecutiveReport } from '@/lib/api';

type PendingAgingPanelProps = {
  report: ExecutiveReport;
};

export function PendingAgingPanel({ report }: PendingAgingPanelProps) {
  const aging = report.pending_aging;
  const buckets = [
    { key: '0_7_days', label: '0 a 7 dias' },
    { key: '8_30_days', label: '8 a 30 dias' },
    { key: '31_plus_days', label: '31 o mas dias' },
  ] as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pendientes y antiguedad</CardTitle>
        <p className="text-xs text-muted-foreground">
          Facturas con saldo abierto, agrupadas por dias desde la emision.
        </p>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {buckets.map((bucket) => {
            const value = aging[bucket.key];
            return (
              <div key={bucket.key} className="rounded border border-border bg-muted/40 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {bucket.label}
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value.count}</p>
                <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground" translate="no">
                  {formatLempirasUI(value.amount)}
                </p>
              </div>
            );
          })}
        </div>

        {aging.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin facturas pendientes en el periodo.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead># Factura</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Emitida</TableHead>
                <TableHead className="text-right">Antiguedad</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {aging.items.map((item, index) => (
                <TableRow key={`${item.invoice_number}-${index}`}>
                  <TableCell className="font-mono text-xs">{item.invoice_number}</TableCell>
                  <TableCell className="font-semibold">{item.patient}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.issued_at ? new Date(item.issued_at).toLocaleDateString('es-HN') : '-'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{item.age_days} d</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {formatLempirasUI(item.total)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-semibold">
                    {formatLempirasUI(item.balance_due)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
