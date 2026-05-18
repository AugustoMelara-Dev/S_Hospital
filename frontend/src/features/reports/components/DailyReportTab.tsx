import { type FormEvent } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banknote, DollarSign, FileText, CreditCard, Download } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/data-table';
import { KPICard } from './KPICard';
import type { DailyReport } from '../../../lib/api/types';

interface DailyReportTabProps {
  canExport: boolean;
  daily: DailyReport | null;
  dailyDate: string;
  error: string;
  loading: boolean;
  onDateChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function DailyReportTab({ canExport, daily, dailyDate, error, loading, onDateChange, onSubmit }: DailyReportTabProps) {
  function exportCSV() {
    if (!canExport || !daily) return;
    const rows = [
      ['Fecha', daily.date],
      ['Total Facturado', daily.total_billed],
      ['Total Cobrado', daily.total_collected],
      ['Facturas', String(daily.invoice_count)],
      ['Pagos', String(daily.payment_count)],
      [],
      ['MÉTODO', 'CANTIDAD', 'MONTO'],
      ...Object.entries(daily.payments_by_method).map(([method, amount]) => [method, '1', amount]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-diario-${dailyDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const chartData = daily
    ? Object.entries(daily.payments_by_method).map(([method, amount]) => ({
        method: methodLabel(method),
        amount: Number.parseFloat(amount),
      }))
    : [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Reporte diario</h2>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="flex items-end gap-4">
            <div className="w-[200px]">
              <Label htmlFor="daily-date">Fecha diaria</Label>
              <Input
                id="daily-date"
                type="date"
                value={dailyDate}
                onChange={(e) => onDateChange(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Consultando...' : 'Actualizar'}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {daily && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Total Facturado"
              value={`L. ${daily.total_billed}`}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <KPICard
              title="Total Cobrado"
              value={`L. ${daily.total_collected}`}
              icon={<Banknote className="h-4 w-4" />}
            />
            <KPICard
              title="Facturas"
              value={daily.invoice_count}
              description={`${daily.invoices_by_status.paid.count + daily.invoices_by_status.partial.count} pagadas`}
              icon={<FileText className="h-4 w-4" />}
            />
            <KPICard
              title="Pagos"
              value={daily.payment_count}
              icon={<CreditCard className="h-4 w-4" />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Por Método de Pago</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Método</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(daily.payments_by_method).map(([method, amount]) => (
                    <TableRow key={method}>
                      <TableCell className="font-medium">{methodLabel(method)}</TableCell>
                      <TableCell className="text-right">L. {amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estado de Facturas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(daily.invoices_by_status).map(([status, data]) => (
                    <TableRow key={status}>
                      <TableCell className="font-medium">{statusLabel(status)}</TableCell>
                      <TableCell className="text-right">{data.count}</TableCell>
                      <TableCell className="text-right">L. {data.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Visualización por Método</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="method" tickLine={false} />
                    <YAxis tickLine={false} width={64} />
                    <Tooltip formatter={(value) => [`L. ${value}`, 'Monto']} />
                    <Bar dataKey="amount" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            {canExport ? (
              <Button variant="outline" onClick={exportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                Exportacion CSV requiere permiso de exportacion de reportes.
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

function statusLabel(status: string): string {
  return { issued: 'Emitida', partial: 'Parcial', paid: 'Pagada', void: 'Anulada' }[status] ?? status;
}
