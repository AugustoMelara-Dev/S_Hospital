import { type FormEvent } from 'react';
import { Download, DollarSign, User, AlertTriangle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/data-table';
import { KPICard } from './KPICard';
import type { CashSessionReport } from '../../../lib/api/types';
import { formatLempirasFromCents, parseCents } from '../../../lib/moneyCents';
import { formatLocalizedDateTime } from '../../../lib/format/formatDate';

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
              {loading ? 'Consultando...' : 'Ver caja'}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {cashSession && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
            <KPICard
              title="Cajero"
              value={cashSession.cash_session.user?.name ?? 'Sin asignar'}
              icon={<User className="h-4 w-4" />}
            />
            <KPICard
              title="Apertura"
              value={moneyLabel(cashSession.cash_session.opening_amount)}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <KPICard
              title="Esperado"
              value={moneyLabel(cashSession.expected_cash_amount)}
              description="Apertura mas cobros en efectivo"
            />
            <KPICard
              title="Cobrado"
              value={moneyLabel(cashSession.payments_total)}
              description={`${cashSession.payments_count} ${cashSession.payments_count === 1 ? 'pago' : 'pagos'}`}
            />
            <KPICard
              title="Pendiente"
              value={moneyLabel(cashSession.pending_amount)}
              description={pendingInvoiceLabel(cashSession.pending_invoice_count)}
            />
            <KPICard
              title="Contado"
              value={cashSession.cash_session.closing_amount === null ? 'Pendiente' : moneyLabel(cashSession.cash_session.closing_amount)}
            />
          </div>

          {cashSession.cash_session.difference_amount && (parseCents(cashSession.cash_session.difference_amount) ?? 0) !== 0 && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Diferencia
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-destructive">
                  {moneyLabel(cashSession.cash_session.difference_amount)}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Totales por metodo</CardTitle>
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
                      <TableCell className="text-right">{moneyLabel(total)}</TableCell>
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
                        <TableCell className="text-right">{moneyLabel(p.amount)}</TableCell>
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
                        <TableCell className="font-medium">{movementTypeLabel(m.type)}</TableCell>
                        <TableCell>{movementMethodLabel(m.method)}</TableCell>
                        <TableCell className="text-right">{signedMoneyLabel(m.amount)}</TableCell>
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
                Exportación Excel requiere permiso de exportación de reportes.
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

function movementTypeLabel(type: string): string {
  return {
    opening: 'Apertura de caja',
    payment: 'Cobro registrado',
    payment_void: 'Reverso de pago',
    closing: 'Cierre de caja',
    adjustment: 'Ajuste',
  }[type] ?? humanizeEnum(type);
}

function movementMethodLabel(method: string | null): string {
  if (!method) {
    return '—';
  }

  return { ...methodLabels(), closing: 'Cierre de caja' }[method] ?? humanizeEnum(method);
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasFromCents(parseCents(value));
}

function signedMoneyLabel(value: string | number | null | undefined): string {
  return formatLempirasFromCents(parseSignedCents(value));
}

function parseSignedCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value * 100) : null;
  }

  const trimmed = value.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }

  return Math.round(Number(trimmed) * 100);
}

function pendingInvoiceLabel(count: number): string {
  return `${count} ${count === 1 ? 'factura' : 'facturas'}`;
}

function methodLabels(): Record<string, string> {
  return { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', other: 'Otro' };
}

function humanizeEnum(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDate(value: string): string {
  return formatLocalizedDateTime(value);
}
