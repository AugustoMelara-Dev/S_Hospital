import { type FormEvent } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banknote, DollarSign, FileText, Download, CircleSlash } from 'lucide-react';
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
  onExport: () => void;
  onExportPdf: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function DailyReportTab({ canExport, daily, dailyDate, error, loading, onDateChange,
  onExport, onExportPdf, onSubmit }: DailyReportTabProps) {

  const paymentsByMethod = daily?.payments_by_method || {
    cash: '0.00',
    transfer: '0.00',
    card: '0.00',
    other: '0.00',
  };
  const invoicesByStatus = daily?.invoices_by_status || {
    issued: { count: 0, total: '0.00' },
    partial: { count: 0, total: '0.00' },
    paid: { count: 0, total: '0.00' },
    void: { count: 0, total: '0.00' },
  };

  const chartData = daily
    ? Object.entries(paymentsByMethod).map(([method, amount]) => ({
        method: methodLabel(method),
        amount: Number.parseFloat(amount as string) || 0,
      }))
    : [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Resumen del dia</h2>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="flex items-end gap-4">
            <div className="w-[200px]">
              <Label htmlFor="daily-date">Fecha</Label>
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <KPICard
              title="Facturado"
              value={`L. ${daily.total_billed}`}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <KPICard
              title="Cobrado"
              value={`L. ${daily.total_collected}`}
              icon={<Banknote className="h-4 w-4" />}
            />
            <KPICard
              title="Pendiente"
              value={`L. ${daily.total_pending}`}
              description="Facturas emitidas o parciales"
              icon={<DollarSign className="h-4 w-4" />}
            />
            <KPICard
              title="Facturas"
              value={daily.invoice_count}
              description={`${invoicesByStatus.paid?.count ?? 0} pagadas, ${invoicesByStatus.partial?.count ?? 0} parciales`}
              icon={<FileText className="h-4 w-4" />}
            />
            <KPICard
              title="Anulado"
              value={`L. ${daily.total_voided}`}
              description={`${invoicesByStatus.void?.count ?? 0} facturas anuladas`}
              icon={<CircleSlash className="h-4 w-4" />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lectura financiera</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Pagos registrados</TableCell>
                    <TableCell className="text-right">{daily.payment_count}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Facturas parciales</TableCell>
                    <TableCell className="text-right">L. {daily.total_partial}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Saldo pendiente</TableCell>
                    <TableCell className="text-right">L. {daily.total_pending}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cobros por metodo</CardTitle>
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
                  {Object.entries(paymentsByMethod).map(([method, amount]) => (
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
                  {Object.entries(invoicesByStatus).map(([status, data]) => (
                    <TableRow key={status}>
                      <TableCell className="font-medium">{statusLabel(status)}</TableCell>
                      <TableCell className="text-right">{(data as { count: number; total: string })?.count ?? 0}</TableCell>
                      <TableCell className="text-right">L. {(data as { count: number; total: string })?.total ?? '0.00'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Grafico por metodo</CardTitle>
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

          <div className="flex justify-end gap-2">
            {canExport ? (
              <>
                <Button variant="outline" onClick={onExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Excel
                </Button>
                <Button variant="outline" onClick={onExportPdf}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar PDF
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Exportación requiere permiso de exportación de reportes.
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
