import { AlertTriangle, CheckCircle2, Minus } from 'lucide-react';
import { formatLempirasUI } from '@/lib/moneyCents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ExecutiveReport } from '@/lib/api';

type CashReconciliationPanelProps = {
  report: ExecutiveReport;
};

function formatSigned(value: string): { display: string; tone: 'pos' | 'neg' | 'zero' } {
  if (value.startsWith('-')) {
    return { display: `- ${formatLempirasUI(value)}`, tone: 'neg' };
  }
  if (value === '0.00' || value === '0') {
    return { display: formatLempirasUI(value), tone: 'zero' };
  }
  return { display: `+ ${formatLempirasUI(value)}`, tone: 'pos' };
}

export function CashReconciliationPanel({ report }: CashReconciliationPanelProps) {
  const withDifference = report.cash_sessions.filter(
    (s: ExecutiveReport['cash_sessions'][number]) => s.difference && s.difference !== '0.00' && s.difference !== '0',
  );
  const totalExpected = report.cash_sessions.reduce(
    (acc: number, s: ExecutiveReport['cash_sessions'][number]) => acc + Number(s.expected_cash),
    0,
  );
  const totalCounted = report.cash_sessions.reduce(
    (acc: number, s: ExecutiveReport['cash_sessions'][number]) => acc + Number(s.counted_cash ?? 0),
    0,
  );
  const totalDifference = totalCounted - totalExpected;
  const openSessions = report.cash_sessions.filter((s: ExecutiveReport['cash_sessions'][number]) => s.status === 'open');

  return (
    <Card className="rounded-panel border-operational-border bg-operational-surface shadow-operational">
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">Caja y conciliacion</CardTitle>
          <p className="text-xs text-muted-foreground">
            Efectivo esperado vs contado por sesion. Las diferencias requieren justificacion y quedan en auditoria.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded border border-border bg-muted/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Efectivo esperado</p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground" translate="no">
              {formatLempirasUI(totalExpected)}
            </p>
          </div>
          <div className="rounded border border-border bg-muted/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Efectivo contado</p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-foreground" translate="no">
              {formatLempirasUI(totalCounted)}
            </p>
          </div>
          <div className="rounded border border-border bg-muted/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Diferencia total</p>
            <p
              className={
                'mt-1 font-mono text-lg font-bold tabular-nums ' +
                (totalDifference > 0
                  ? 'text-secondary'
                  : totalDifference < 0
                    ? 'text-destructive'
                    : 'text-foreground')
              }
              translate="no"
            >
              {formatLempirasUI(totalDifference)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {withDifference.length} {withDifference.length === 1 ? 'sesion con' : 'sesiones con'} diferencia · {openSessions.length} abiertas
            </p>
          </div>
        </div>

        {report.cash_sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin sesiones de caja en el periodo.</p>
        ) : (
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Cajero</TableHead>
                <TableHead>Apertura</TableHead>
                <TableHead>Cierre</TableHead>
                <TableHead className="text-right">Inicial</TableHead>
                <TableHead className="text-right">Esperado</TableHead>
                <TableHead className="text-right">Contado</TableHead>
                <TableHead className="text-right">Diferencia</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.cash_sessions.map((session, index) => {
                const diffSigned = formatSigned(session.difference ?? '0.00');
                const hasDiff = diffSigned.tone !== 'zero';

                return (
                  <TableRow key={session.id}>
                    <TableCell className="w-8 text-center text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-semibold">{session.cashier}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {session.opened_at ? new Date(session.opened_at).toLocaleString('es-HN') : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {session.closed_at ? new Date(session.closed_at).toLocaleString('es-HN') : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatLempirasUI(session.opening_amount)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatLempirasUI(session.expected_cash)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {session.counted_cash !== null ? formatLempirasUI(session.counted_cash) : '-'}
                    </TableCell>
                    <TableCell
                      className={
                        'text-right font-mono tabular-nums font-semibold ' +
                        (hasDiff
                          ? diffSigned.tone === 'pos'
                            ? 'text-secondary'
                            : 'text-destructive'
                          : 'text-muted-foreground')
                      }
                    >
                      <span className="flex items-center justify-end gap-1">
                        {hasDiff ? (
                          diffSigned.tone === 'pos' ? (
                            <CheckCircle2 className="size-3 text-secondary" aria-hidden="true" />
                          ) : (
                            <AlertTriangle className="size-3 text-destructive" aria-hidden="true" />
                          )
                        ) : (
                          <Minus className="size-3 text-muted-foreground" aria-hidden="true" />
                        )}
                        {diffSigned.display}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={session.status === 'open' ? 'success' : session.status === 'closed' ? 'secondary' : 'destructive'}>
                        {session.status === 'open' ? 'Abierta' : session.status === 'closed' ? 'Cerrada' : session.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
