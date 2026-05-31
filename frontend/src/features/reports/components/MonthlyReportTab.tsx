import { type FormEvent } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banknote, CalendarDays, CircleSlash, Download, FileText, TrendingUp } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { EmptyState } from '../../../components/ui/states';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/data-table';
import { KPICard } from './KPICard';
import type { MonthlyReport } from '../../../lib/api/types';

interface MonthlyReportTabProps {
  canExport: boolean;
  error: string;
  loading: boolean;
  month: string;
  monthly: MonthlyReport | null;
  onExport: () => void;
  onExportPdf: () => void;
  onMonthChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function MonthlyReportTab({
  canExport,
  error,
  loading,
  month,
  monthly,
  onExport,
  onExportPdf,
  onMonthChange,
  onSubmit,
}: MonthlyReportTabProps) {
  const chartData = monthly?.daily_totals.map((day) => ({
    date: day.date.slice(5),
    cobrado: Number.parseFloat(day.total_collected) || 0,
    pendiente: Number.parseFloat(day.total_pending) || 0,
  })) ?? [];

  const paymentsByMethod = monthly?.payments_by_method ?? {
    cash: '0.00',
    transfer: '0.00',
    card: '0.00',
    other: '0.00',
  };

  const invoicesByStatus = monthly?.invoices_by_status ?? {
    issued: { count: 0, total: '0.00' },
    partial: { count: 0, total: '0.00' },
    paid: { count: 0, total: '0.00' },
    void: { count: 0, total: '0.00' },
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Resumen mensual</h2>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-4">
            <div className="w-[200px]">
              <Label htmlFor="monthly-month">Mes</Label>
              <Input
                id="monthly-month"
                type="month"
                value={month}
                onChange={(event) => onMonthChange(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Consultando...' : 'Ver mes'}
            </Button>
          </form>
          {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      {!monthly && !loading ? (
        <EmptyState
          title="Seleccione un mes"
          description="El resumen mensual se calcula desde los hechos financieros del servidor."
        />
      ) : null}

      {monthly ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KPICard title="Facturado" value={`L. ${monthly.total_billed}`} icon={<FileText className="h-4 w-4" />} />
            <KPICard title="Cobrado" value={`L. ${monthly.total_collected}`} icon={<Banknote className="h-4 w-4" />} />
            <KPICard
              title="Pendiente"
              value={`L. ${monthly.total_pending}`}
              description="Facturas emitidas o parciales"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <KPICard
              title="Facturas"
              value={monthly.invoice_count}
              description={`${monthly.payment_count} pagos registrados`}
              icon={<CalendarDays className="h-4 w-4" />}
            />
            <KPICard
              title="Anulado"
              value={`L. ${monthly.total_voided}`}
              description={`Parcial: L. ${monthly.total_partial}`}
              icon={<CircleSlash className="h-4 w-4" />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Cobros por método</CardTitle>
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
              <CardTitle>Estados de factura</CardTitle>
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
                      <TableCell className="text-right">{data.count}</TableCell>
                      <TableCell className="text-right">L. {data.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evolución por fecha</CardTitle>
            </CardHeader>
            <CardContent>
              {monthly.daily_totals.length > 0 ? (
                <div className="space-y-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickLine={false} />
                      <YAxis tickLine={false} width={64} />
                      <Tooltip formatter={(value) => [`L. ${value}`, 'Monto']} />
                      <Bar dataKey="cobrado" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="pendiente" fill="var(--color-accent-foreground)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead className="text-right">Facturado</TableHead>
                        <TableHead className="text-right">Cobrado</TableHead>
                        <TableHead className="text-right">Pendiente</TableHead>
                        <TableHead className="text-right">Anulado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthly.daily_totals.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell className="font-medium">{day.date}</TableCell>
                          <TableCell className="text-right">L. {day.total_billed}</TableCell>
                          <TableCell className="text-right">L. {day.total_collected}</TableCell>
                          <TableCell className="text-right">L. {day.total_pending}</TableCell>
                          <TableCell className="text-right">L. {day.total_voided}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState title="Sin actividad mensual" description="No hay facturas ni cobros en el mes seleccionado." />
              )}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            {canExport ? (
              <>
                <Button variant="outline" onClick={onExport}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar Excel
                </Button>
                <Button variant="outline" onClick={onExportPdf}>
                  <Download className="mr-2 h-4 w-4" />
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
      ) : null}
    </div>
  );
}

function methodLabel(method: string): string {
  return { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', other: 'Otro' }[method] ?? method;
}

function statusLabel(status: string): string {
  return { issued: 'Emitida', partial: 'Parcial', paid: 'Pagada', void: 'Anulada' }[status] ?? status;
}
