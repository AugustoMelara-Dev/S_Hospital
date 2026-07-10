import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { finiteNumber, formatLempirasUI } from '@/lib/money';
import { cn } from '@/lib/utils';

export type CashMovement = {
  id: number;
  cash_session_id: number;
  payment_id: number | null;
  invoice_id?: number | null;
  invoice_number?: string | null;
  user_id: number;
  type: string;
  method: string | null;
  amount: string;
  notes: string | null;
  occurred_at: string;
};

interface CashMovementsTableProps {
  canViewInvoices?: boolean;
  movements: CashMovement[];
}

const movementColumns: Array<DataTableColumn<CashMovement>> = [
  {
    key: 'occurred_at',
    header: 'Hora',
    cellClassName: 'whitespace-nowrap font-medium tabular-nums',
    render: (movement) => formatMovementTime(movement.occurred_at),
  },
  {
    key: 'type',
    header: 'Tipo',
    render: (movement) => {
      const direction = movementDirection(movement.type);
      return <Badge variant={movementBadgeVariant(direction)}>{movementLabel(movement.type)}</Badge>;
    },
  },
  {
    key: 'reference',
    header: 'Referencia',
    render: (movement) => <MovementReference canViewInvoices={false} movement={movement} />,
  },
  {
    key: 'method',
    header: 'Método',
    render: (movement) => methodLabel(movement.method),
  },
  {
    key: 'notes',
    header: 'Detalle auditado',
    render: (movement) => movement.notes
      ? <span className="text-sm text-foreground">{movement.notes}</span>
      : <span className="text-sm text-muted-foreground">Sin nota registrada</span>,
  },
  {
    key: 'amount',
    header: 'Monto',
    numeric: true,
    cellClassName: 'text-base font-semibold',
    render: (movement) => <MovementAmount movement={movement} />,
  },
];

export function CashMovementsTable({ canViewInvoices = false, movements }: CashMovementsTableProps) {
  const columns = useMemo(() => movementColumns.map((column) => column.key === 'reference'
    ? { ...column, render: (movement: CashMovement) => <MovementReference canViewInvoices={canViewInvoices} movement={movement} /> }
    : column), [canViewInvoices]);

  return (
    <section className="overflow-hidden rounded-2xl border border-operational-border bg-operational-surface shadow-operational">
      <div className="border-b border-border bg-muted/35 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Trazabilidad</p>
        <h2 id="cash-movements-title" className="mt-1 text-lg font-semibold leading-tight">
          Movimientos de caja
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Cada movimiento conserva su hora, método y referencia de pago o factura.
        </p>
      </div>

      <div className="p-4 sm:p-5">
      {movements.length === 0 ? (
        <DataTable
          caption="Movimientos registrados para la sesión de caja actual."
          columns={columns}
          containerLabel="Movimientos de caja"
          emptyDescription="Entradas, salidas y ajustes aparecerán cuando la sesión tenga actividad."
          emptyTitle="Sin movimientos de caja"
          getRowKey={(movement) => movement.id}
          rows={movements}
        />
      ) : (
        <>
          <div className="hidden md:block">
            <DataTable
              caption="Movimientos registrados para la sesión de caja actual."
              columns={columns}
              containerLabel="Movimientos de caja"
              getRowKey={(movement) => movement.id}
              rows={movements}
              tableClassName="min-w-[800px]"
            />
          </div>

          <ol className="space-y-2 md:hidden" aria-label="Movimientos de caja en móvil">
            {movements.map((movement) => {
              const direction = movementDirection(movement.type);
              return (
                <li key={movement.id} className="grid gap-3 rounded-xl border border-border bg-card px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <Badge className="w-fit" variant={movementBadgeVariant(direction)}>{movementLabel(movement.type)}</Badge>
                      <span className="text-xs text-muted-foreground">{formatMovementTime(movement.occurred_at)} · {methodLabel(movement.method)}</span>
                    </div>
                    <MovementAmount movement={movement} />
                  </div>
                  <MovementReference canViewInvoices={canViewInvoices} movement={movement} />
                  {movement.notes ? <p className="text-xs leading-relaxed text-muted-foreground">{movement.notes}</p> : null}
                </li>
              );
            })}
          </ol>
        </>
      )}
      </div>
    </section>
  );
}

function MovementReference({
  canViewInvoices,
  movement,
}: {
  canViewInvoices: boolean;
  movement: CashMovement;
}) {
  const invoiceLabel = movement.invoice_number ?? (movement.invoice_id ? `#${movement.invoice_id}` : null);

  if (!movement.payment_id && !movement.invoice_id) {
    return <span className="text-sm text-muted-foreground">Movimiento #{movement.id}</span>;
  }

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      {movement.invoice_id && canViewInvoices ? (
        <Link
          className="min-h-11 content-center font-medium text-hospital-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-0"
          to={`/invoices?invoice=${movement.invoice_id}`}
        >
          Factura {invoiceLabel}
        </Link>
      ) : movement.invoice_id ? (
        <span className="font-medium text-foreground">Factura {invoiceLabel}</span>
      ) : null}
      {movement.payment_id ? <span className="text-muted-foreground">Pago #{movement.payment_id}</span> : null}
    </span>
  );
}

function MovementAmount({ movement }: { movement: CashMovement }) {
  const direction = movementDirection(movement.type);
  const sign = direction === 'positive' ? '+' : direction === 'negative' ? '-' : '';
  const amount = direction === 'neutral'
    ? formatLempirasUI(movement.amount)
    : formatLempirasUI(Math.abs(finiteNumber(movement.amount)));

  return (
    <span
      className={cn(
        'whitespace-nowrap font-semibold tabular-nums',
        direction === 'positive' && 'text-success-foreground',
        direction === 'negative' && 'text-destructive',
        direction === 'neutral' && 'text-muted-foreground',
      )}
    >
      {sign ? `${sign} ` : ''}{amount}
    </span>
  );
}

function movementDirection(type: string): 'positive' | 'negative' | 'neutral' {
  if (['income', 'opening', 'payment', 'cash_in'].includes(type)) return 'positive';
  if (['expense', 'payment_void', 'cash_out', 'refund', 'void'].includes(type)) return 'negative';
  return 'neutral';
}

function movementBadgeVariant(direction: 'positive' | 'negative' | 'neutral'): 'success' | 'destructive' | 'secondary' {
  if (direction === 'positive') return 'success';
  if (direction === 'negative') return 'destructive';
  return 'secondary';
}

function movementLabel(type: string): string {
  const labels: Record<string, string> = {
    cash_in: 'Entrada',
    cash_out: 'Salida',
    closing: 'Cierre',
    expense: 'Egreso',
    income: 'Ingreso',
    opening: 'Apertura',
    payment: 'Pago',
    payment_void: 'Reverso de pago',
    refund: 'Devolución',
    void: 'Anulación',
  };
  return labels[type] ?? 'Movimiento';
}

function methodLabel(method: string | null): string {
  const labels: Record<string, string> = {
    card: 'Tarjeta',
    cash: 'Efectivo',
    closing: 'Cierre',
    other: 'Otro',
    transfer: 'Transferencia',
  };
  return method ? labels[method] ?? method : 'Sin método';
}

function formatMovementTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Hora no disponible';

  return new Intl.DateTimeFormat('es-HN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}
