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

type CashierTableProps = {
  report: ExecutiveReport;
};

export function CashierTable({ report }: CashierTableProps) {
  if (report.cashiers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cajeros</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Sin pagos en el periodo.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cajeros</CardTitle>
        <p className="text-xs text-muted-foreground">
          Recaudacion por cajero. Responde: que cajero cobro mas.
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cajero</TableHead>
              <TableHead className="text-right">Cobrado</TableHead>
              <TableHead className="text-right">Efectivo</TableHead>
              <TableHead className="text-right">Transferencia</TableHead>
              <TableHead className="text-right">Tarjeta</TableHead>
              <TableHead className="text-right">Otro</TableHead>
              <TableHead className="text-right">Pagos</TableHead>
              <TableHead className="text-right">Anuladas</TableHead>
              <TableHead className="text-right">Diferencia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.cashiers.map((cashier: ExecutiveReport['cashiers'][number]) => (
              <TableRow key={cashier.user_id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">{cashier.name}</span>
                    <span className="text-xs text-muted-foreground">@{cashier.username}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums font-semibold">
                  {formatLempirasUI(cashier.collected)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums text-secondary">
                  {formatLempirasUI(cashier.cash)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatLempirasUI(cashier.transfer)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatLempirasUI(cashier.card)}
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {formatLempirasUI(cashier.other)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{cashier.payment_count}</TableCell>
                <TableCell className="text-right tabular-nums">{cashier.voided_count}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">
                  {cashier.difference_total !== '0.00' ? formatLempirasUI(cashier.difference_total) : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
