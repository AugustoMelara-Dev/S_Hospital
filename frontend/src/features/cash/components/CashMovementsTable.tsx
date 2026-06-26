import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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

export function CashMovementsTable({ movements }: CashMovementsTableProps) {
  return (
    <Card className="border-operational-border">
      <CardHeader className="gap-1 border-b border-border">
        <CardTitle>Movimientos de caja</CardTitle>
        <p className="text-sm text-muted-foreground">
          Entradas, salidas y ajustes registrados para conciliación de la sesión.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <Table containerLabel="Movimientos de caja" className="min-w-[720px]">
          <TableCaption>
            Movimientos registrados para la sesión de caja actual.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Hora</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Método</TableHead>
              <TableHead data-numeric="true">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                  No hay movimientos en esta sesión
                </TableCell>
              </TableRow>
            ) : (
              movements.map((movement) => {
                const direction = movementDirection(movement.type);
                const sign = direction === 'positive' ? '+' : direction === 'negative' ? '-' : '';

                return (
                  <TableRow key={movement.id}>
                    <TableCell className="whitespace-nowrap font-medium tabular-nums">{formatMovementTime(movement.occurred_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={movementBadgeVariant(direction)}>{movementLabel(movement.type)}</Badge>
                      </div>
                    </TableCell>
                    <TableCell>{methodLabel(movement.method)}</TableCell>
                    <TableCell
                      data-numeric="true"
                      className={cn(
                        'text-base font-semibold',
                        direction === 'positive' && 'text-success-foreground',
                        direction === 'negative' && 'text-destructive',
                        direction === 'neutral' && 'text-muted-foreground',
                      )}
                    >
                      {sign ? `${sign} ` : ''}{formatLempirasUI(movement.amount)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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

  return method ? labels[method] ?? method : '-';
}

function formatMovementTime(value: string): string {
  return new Intl.DateTimeFormat('es-HN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}
