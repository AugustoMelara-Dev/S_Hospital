import { type FormEvent } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banknote, CalendarDays, CircleSlash, Download, FileText, TrendingUp } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Alert } from '../../../components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { EmptyState } from '../../../components/ui/states';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/data-table';
import { finiteNumber, formatLempirasUI } from '../../../lib/money';
import { KPICard } from './KPICard';
import type { MonthlyReport } from '../../../lib/api/types';

interface MonthlyReportTabProps {
  canExport: boolean;
  error: string;
  exporting?: boolean;
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
  exporting = false,
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
    cobrado: finiteNumber(day.total_collected),
    pendiente: finiteNumber(day.total_pending),
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
          {error ? (
            <div className="mt-3">
              <Alert variant="destructive" title="No se pudo cargar el reporte mensual">
                {error}
              </Alert>
            </div>
          ) : null}
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
            <KPICard title="Facturado" value={formatLempirasUI(monthly.total_billed)} icon={<FileText className="h-4 w-4" />} />
            <KPICard title="Cobrado" value={formatLempirasUI(monthly.total_collected)} icon={<Banknote className="h-4 w-4" />} />
            <KPICard
              title="Pendiente"
              value={formatLempirasUI(monthly.total_pending)}
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
              value={formatLempirasUI(monthly.total_voided)}
              description={`Parcial: ${formatLempirasUI(monthly.total_partial)}`}
              icon={<CircleSlash className="h-4 w-4" />}
            />
          </div>

          <Card className="rounded-panel border-operational-border bg-operational-surface shadow-operational">
            <CardHeader>
              <CardTitle>Cobros por método</CardTitle>
            </CardHeader>
            <CardContent>
              <Table className="w-full text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4 py-3 text-left">Método</TableHead>
                    <TableHead className="px-4 py-3 text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(paymentsByMethod).map(([method, amount]) => (
                    <TableRow key={method}>
                      <TableCell className="px-4 py-2 font-medium">{methodLabel(method)}</TableCell>
                      <TableCell className="px-4 py-2 text-right">{formatLempirasUI(amount)}</TableCell>
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
              <Table className="w-full text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-4 py-3 text-left">Estado</TableHead>
                    <TableHead className="px-4 py-3 text-right">Cantidad</TableHead>
                    <TableHead className="px-4 py-3 text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(invoicesByStatus).map(([status, data]) => (
                    <TableRow key={status}>
                      <TableCell className="px-4 py-2 font-medium">{statusLabel(status)}</TableCell>
                      <TableCell className="px-4 py-2 text-right">{data.count}</TableCell>
                      <TableCell className="px-4 py-2 text-right">{formatLempirasUI(data.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="rounded-panel border-operational-border bg-operational-surface shadow-operational">
            <CardHeader>
              <CardTitle>Evolución por fecha</CardTitle>
            </CardHeader>
            <CardContent>
              {monthly.daily_totals.length > 0 ? (
                <div className="space-y-4">
                  <div className="sr-only">
                    <table>
                      <caption>Evolucion mensual por fecha</caption>
                      <thead>
                        <tr>
                          <th scope="col">Fecha</th>
                          <th scope="col">Cobrado</th>
                          <th scope="col">Pendiente</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chartData.map((day) => (
                          <tr key={day.date}>
                            <td>{day.date}</td>
                            <td>{formatLempirasUI(day.cobrado)}</td>
                            <td>{formatLempirasUI(day.pendiente)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div
                    role="img"
                    aria-label="Grafico de evolucion mensual por fecha; la tabla oculta contiene cobrado y pendiente."
                  >
                  <ResponsiveContainer width="100%" height={220} minWidth={1} minHeight={1}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tickLine={false} />
                      <YAxis tickLine={false} width={64} />
                      <Tooltip formatter={(value) => [formatLempirasUI(value as number), 'Monto']} />
                      <Bar dataKey="cobrado" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="pendiente" fill="var(--color-accent-foreground)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  </div>
                  <Table className="w-full text-sm">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-4 py-3 text-left">Fecha</TableHead>
                        <TableHead className="px-4 py-3 text-right">Facturado</TableHead>
                        <TableHead className="px-4 py-3 text-right">Cobrado</TableHead>
                        <TableHead className="px-4 py-3 text-right">Pendiente</TableHead>
                        <TableHead className="px-4 py-3 text-right">Anulado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthly.daily_totals.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell className="px-4 py-2 font-medium">{day.date}</TableCell>
                          <TableCell className="px-4 py-2 text-right">{formatLempirasUI(day.total_billed)}</TableCell>
                          <TableCell className="px-4 py-2 text-right">{formatLempirasUI(day.total_collected)}</TableCell>
                          <TableCell className="px-4 py-2 text-right">{formatLempirasUI(day.total_pending)}</TableCell>
                          <TableCell className="px-4 py-2 text-right">{formatLempirasUI(day.total_voided)}</TableCell>
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
                <Button type="button" variant="outline" onClick={onExport} disabled={exporting}>
                  <Download className="mr-2 h-4 w-4" />
                  {exporting ? 'Exportando...' : 'Exportar Excel'}
                </Button>
                <Button type="button" variant="outline" onClick={onExportPdf} disabled={exporting}>
                  <Download className="mr-2 h-4 w-4" />
                  {exporting ? 'Exportando...' : 'Exportar PDF'}
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
