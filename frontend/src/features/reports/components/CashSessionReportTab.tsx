import { type FormEvent } from 'react';
import { Download, DollarSign, User, AlertTriangle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/data-table';
import { KPICard } from './KPICard';
import type { CashSessionReport } from '../../../lib/api/types';

interface CashSessionReportTabProps {
  canExport: boolean;
  cashSession: CashSessionReport | null;
  cashReportId: string;
  loading: boolean;
  error: string;
  onCashReportIdChange: (value: string) => void;
  onExport: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function CashSessionReportTab({
  canExport,
  cashSession,
  cashReportId,
  loading,
  error,
  onCashReportIdChange,
  onExport,
  onSubmit,
}: CashSessionReportTabProps) {

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="flex items-end gap-4">
            <div className="w-[200px]">
              <Label htmlFor="cash-session-id">Número de Caja</Label>
              <Input
                id="cash-session-id"
                type="number"
                inputMode="numeric"
                min="1"
                placeholder="Ej: 1"
                value={cashReportId}
                onChange={(e) => onCashReportIdChange(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Consultando...' : 'Ver Caja'}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {cashSession && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Cajero"
              value={cashSession.cash_session.user?.name ?? 'Sin asignar'}
              icon={<User className="h-4 w-4" />}
            />
            <KPICard
              title="Monto Apertura"
              value={`L. ${cashSession.cash_session.opening_amount}`}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <KPICard
              title="Total Esperado"
              value={`L. ${cashSession.cash_session.expected_amount ?? '0.00'}`}
            />
            <KPICard
              title="Total Contado"
              value={`L. ${cashSession.cash_session.closing_amount ?? '0.00'}`}
            />
          </div>

          {cashSession.cash_session.difference_amount && Number.parseFloat(cashSession.cash_session.difference_amount) !== 0 && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Diferencia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">
                  L. {cashSession.cash_session.difference_amount}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Totales por Método</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(cashSession.totals_by_method).map(([method, total]) => (
                    <TableRow key={method}>
                      <TableCell className="font-medium">{methodLabel(method)}</TableCell>
                      <TableCell className="text-right">L. {total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {cashSession.payments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pagos Registrados ({cashSession.payments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Factura</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashSession.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.invoice?.invoice_number ?? '—'}</TableCell>
                        <TableCell>{p.invoice?.patient_name ?? '—'}</TableCell>
                        <TableCell>{methodLabel(p.method)}</TableCell>
                        <TableCell className="text-right">L. {p.amount}</TableCell>
                        <TableCell>{formatDate(p.paid_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {cashSession.movements.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Movimientos ({cashSession.movements.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Notas</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashSession.movements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.type}</TableCell>
                        <TableCell>{m.method ?? '—'}</TableCell>
                        <TableCell className="text-right">L. {m.amount}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{m.notes ?? '—'}</TableCell>
                        <TableCell>{m.user?.name ?? '—'}</TableCell>
                        <TableCell>{formatDate(m.occurred_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            {canExport ? (
              <Button variant="outline" onClick={onExport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Exportación Excel requiere permiso de exportacion de reportes.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function methodLabel(method: string): string {
  return { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', other: 'Otro' }[method] ?? method;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-HN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}
