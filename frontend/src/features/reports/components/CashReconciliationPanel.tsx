import { AlertTriangle, CheckCircle2, Minus } from 'lucide-react';
import { formatLempirasUI } from '@/lib/moneyCents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import type { ExecutiveReport } from '@/lib/api';
import { formatLocalizedDateTime } from '@/lib/format/formatDate';

type CashReconciliationPanelProps = {
  report: ExecutiveReport;
};

type CashSession = ExecutiveReport['cash_sessions'][number];
type CashSessionRow = CashSession & {
  position: number;
};

function formatSigned(value: string): { display: string; tone: 'pos' | 'neg' | 'zero' } {
  if (value.startsWith('-')) {
    return { display: `- ${formatLempirasUI(value.slice(1))}`, tone: 'neg' };
  }
  if (value === '0.00' || value === '0') {
    return { display: formatLempirasUI(value), tone: 'zero' };
  }
  return { display: `+ ${formatLempirasUI(value)}`, tone: 'pos' };
}

const cashSessionColumns: Array<DataTableColumn<CashSessionRow>> = [
  {
    key: 'position',
    header: '#',
    cellClassName: 'w-8 text-center text-muted-foreground',
    render: (session) => session.position,
  },
  {
    key: 'cashier',
    header: 'Cajero',
    cellClassName: 'font-semibold',
    render: (session) => session.cashier,
  },
  {
    key: 'opened_at',
    header: 'Apertura',
    cellClassName: 'text-xs text-muted-foreground',
    render: (session) => formatSessionDate(session.opened_at),
  },
  {
    key: 'closed_at',
    header: 'Cierre',
    cellClassName: 'text-xs text-muted-foreground',
    render: (session) => formatSessionDate(session.closed_at),
  },
  {
    key: 'opening_amount',
    header: 'Inicial',
    numeric: true,
    cellClassName: 'font-mono tabular-nums',
    render: (session) => formatLempirasUI(session.opening_amount),
  },
  {
    key: 'expected_cash',
    header: 'Esperado',
    numeric: true,
    cellClassName: 'font-mono tabular-nums',
    render: (session) => formatLempirasUI(session.expected_cash),
  },
  {
    key: 'counted_cash',
    header: 'Contado',
    numeric: true,
    cellClassName: 'font-mono tabular-nums',
    render: (session) => (session.counted_cash !== null ? formatLempirasUI(session.counted_cash) : '-'),
  },
  {
    key: 'difference',
    header: 'Diferencia',
    numeric: true,
    cellClassName: 'font-mono tabular-nums font-semibold',
    render: (session) => {
      const diffSigned = formatSigned(session.difference ?? '0.00');
      const hasDiff = diffSigned.tone !== 'zero';

      return (
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
          <span
            className={
              hasDiff ? (diffSigned.tone === 'pos' ? 'text-secondary' : 'text-destructive') : 'text-muted-foreground'
            }
          >
            {diffSigned.display}
          </span>
        </span>
      );
    },
  },
  {
    key: 'status',
    header: 'Estado',
    render: (session) => (
      <Badge variant={session.status === 'open' ? 'success' : session.status === 'closed' ? 'secondary' : 'destructive'}>
        {session.status === 'open' ? 'Abierta' : session.status === 'closed' ? 'Cerrada' : session.status}
      </Badge>
    ),
  },
];

export function CashReconciliationPanel({ report }: CashReconciliationPanelProps) {
  const withDifference = report.cash_sessions.filter(
    (s: CashSession) => s.difference && s.difference !== '0.00' && s.difference !== '0',
  );
  const totalExpected = report.cash_sessions.reduce(
    (acc: number, s: CashSession) => acc + Number(s.expected_cash),
    0,
  );
  const totalCounted = report.cash_sessions.reduce(
    (acc: number, s: CashSession) => acc + Number(s.counted_cash ?? 0),
    0,
  );
  const totalDifference = totalCounted - totalExpected;
  const openSessions = report.cash_sessions.filter((s: CashSession) => s.status === 'open');
  const cashSessionRows = report.cash_sessions.map((session, index) => ({ ...session, position: index + 1 }));

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

        <DataTable
          caption="Sesiones de caja conciliadas."
          columns={cashSessionColumns}
          containerLabel="Sesiones de caja"
          emptyDescription="Las sesiones conciliadas apareceran cuando el periodo tenga actividad de caja."
          emptyTitle="Sin sesiones de caja"
          getRowKey={(session) => session.id}
          rows={cashSessionRows}
          tableClassName="min-w-[980px]"
        />
      </CardContent>
    </Card>
  );
}

function formatSessionDate(value: string | null): string {
  if (!value) return 'Sin fecha';
  const formatted = formatLocalizedDateTime(value);

  return formatted === '-' ? 'Fecha no disponible' : formatted;
}
