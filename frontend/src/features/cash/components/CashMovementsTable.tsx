import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { formatLempirasUI } from '@/lib/money';
import { cn } from '@/lib/utils';

export type CashMovement = {
  id: number;
  cash_session_id: number;
  payment_id: number | null;
  user_id: number;
  type: string;
  method: string | null;
  amount: string;
  notes: string | null;
  occurred_at: string;
};

interface CashMovementsTableProps {
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

      return (
        <div className="flex flex-col gap-1">
          <Badge variant={movementBadgeVariant(direction)}>{movementLabel(movement.type)}</Badge>
        </div>
      );
    },
  },
  {
    key: 'method',
    header: 'Metodo',
    render: (movement) => methodLabel(movement.method),
  },
  {
    key: 'amount',
    header: 'Monto',
    numeric: true,
    cellClassName: 'text-base font-semibold',
    render: (movement) => {
      const direction = movementDirection(movement.type);
      const sign = direction === 'positive' ? '+' : direction === 'negative' ? '-' : '';

      return (
        <span
          className={cn(
            direction === 'positive' && 'text-success-foreground',
            direction === 'negative' && 'text-destructive',
            direction === 'neutral' && 'text-muted-foreground',
          )}
        >
          {sign ? `${sign} ` : ''}
          {formatLempirasUI(movement.amount)}
        </span>
      );
    },
  },
];

export function CashMovementsTable({ movements }: CashMovementsTableProps) {
  return (
    <section className="space-y-3">
      <div>
        <h2 id="cash-movements-title" className="text-lg font-semibold leading-tight">
          Movimientos de caja
        </h2>
        <p className="text-sm text-muted-foreground">
          Entradas, salidas y ajustes registrados para conciliacion de la sesion.
        </p>
      </div>

      <DataTable
        caption="Movimientos registrados para la sesion de caja actual."
        columns={movementColumns}
        containerLabel="Movimientos de caja"
        emptyDescription="Entradas, salidas y ajustes apareceran cuando la sesion tenga actividad."
        emptyTitle="Sin movimientos de caja"
        getRowKey={(movement) => movement.id}
        rows={movements}
        tableClassName="min-w-[720px]"
      />
    </section>
  );
}

function movementDirection(type: string): 'positive' | 'negative' | 'neutral' {
  if (['income', 'opening', 'payment', 'cash_in'].includes(type)) {
    return 'positive';
  }

  if (['expense', 'payment_void', 'cash_out', 'refund', 'void'].includes(type)) {
    return 'negative';
  }

  return 'neutral';
}

function movementBadgeVariant(direction: 'positive' | 'negative' | 'neutral'): 'success' | 'destructive' | 'secondary' {
  if (direction === 'positive') {
    return 'success';
  }

  if (direction === 'negative') {
    return 'destructive';
  }

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
    refund: 'Devolucion',
    void: 'Anulacion',
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

  return method ? labels[method] ?? method : '-';
}

function formatMovementTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Hora no disponible';
  }

  return new Intl.DateTimeFormat('es-HN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}
