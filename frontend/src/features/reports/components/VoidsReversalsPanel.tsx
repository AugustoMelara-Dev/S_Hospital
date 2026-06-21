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

type VoidsReversalsPanelProps = {
  report: ExecutiveReport;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('es-HN');
  } catch {
    return value;
  }
}

export function VoidsReversalsPanel({ report }: VoidsReversalsPanelProps) {
  const items = report.voids_and_reversals;
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">Anulaciones y reversas</CardTitle>
          <p className="text-xs text-muted-foreground">
            Operaciones fuera del ingreso neto. Cada una con usuario, autorizador y motivo.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin anulaciones ni reversas en el periodo.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead># Factura</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Autorizado por</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Fecha</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={`${item.invoice_number}-${index}`}>
                  <TableCell>
                    <Badge variant={item.kind === 'reversal' ? 'warning' : 'destructive'}>
                      {item.kind === 'reversal' ? 'Reversa' : 'Anulacion'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.invoice_number}</TableCell>
                  <TableCell className="font-semibold">{item.patient ?? '-'}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-semibold">
                    {formatLempirasUI(item.amount)}
                  </TableCell>
                  <TableCell className="text-xs">{item.user ?? '-'}</TableCell>
                  <TableCell className="text-xs">{item.authorized_by ?? '-'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-md truncate" title={item.reason ?? ''}>
                    {item.reason ?? '-'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(item.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
