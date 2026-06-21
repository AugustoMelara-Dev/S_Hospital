import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/data-table';
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
    <Card>
      <CardHeader>
        <CardTitle>Movimientos de caja</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hora</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Método</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                  No hay movimientos en esta sesión
                </TableCell>
              </TableRow>
            ) : (
              movements.map((m) => {
                const direction = movementDirection(m.type);
                const sign = direction === 'positive' ? '+' : direction === 'negative' ? '-' : '';

                return (
                  <TableRow key={m.id}>
                    <TableCell>{formatMovementTime(m.occurred_at)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{m.type}</Badge>
                    </TableCell>
                    <TableCell>{m.method || '-'}</TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-medium',
                        direction === 'positive' && 'text-success-foreground',
                        direction === 'negative' && 'text-destructive',
                        direction === 'neutral' && 'text-muted-foreground',
                      )}
                    >
                      {sign ? `${sign} ` : ''}{formatLempirasUI(m.amount)}
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

function formatMovementTime(value: string): string {
  return new Intl.DateTimeFormat('es-HN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}
