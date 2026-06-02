import { type FormEvent } from 'react';
import { AlertTriangle, Database, Download, Printer, RotateCcw, Users } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/data-table';
import { EmptyState } from '../../../components/ui/states';
import { KPICard } from './KPICard';
import type { OperationsReport } from '../../../lib/api/types';
import { formatLempirasFromCents, parseCents } from '../../../lib/moneyCents';

interface AuditoriaTabProps {
  canExport: boolean;
  operations: OperationsReport | null;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onExport: () => void;
  onExportPdf: () => void;
  onSubmit: () => void;
}

export function AuditoriaTab({
  canExport,
  operations,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onExport,
  onExportPdf,
  onSubmit,
}: AuditoriaTabProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  const hasOperationalEvents = operations
    ? operations.voids.length > 0 ||
      operations.reprints.length > 0 ||
      (operations.payment_voids?.length ?? 0) > 0 ||
      operations.backups.length > 0 ||
      operations.cashiers.length > 0
    : false;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
            <div>
              <Label htmlFor="audit-date-from">Desde</Label>
              <Input
                id="audit-date-from"
                type="date"
                value={dateFrom}
                onChange={(event) => onDateFromChange(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="audit-date-to">Hasta</Label>
              <Input
                id="audit-date-to"
                type="date"
                value={dateTo}
                onChange={(event) => onDateToChange(event.target.value)}
              />
            </div>
            <Button type="submit">Actualizar</Button>
          </form>
        </CardContent>
      </Card>

      {!operations && (
        <EmptyState
          title="Consulte auditoria operativa"
          description="Seleccione un rango de fechas para revisar anulaciones, reimpresiones, respaldos y actividad de cajeros."
        />
      )}

      {operations && (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            <KPICard title="Anulaciones" value={operations.summary.void_count} icon={<AlertTriangle className="h-4 w-4" />} />
            <KPICard title="Reimpresiones" value={operations.summary.reprint_count} icon={<Printer className="h-4 w-4" />} />
            <KPICard title="Reversos" value={operations.summary.payment_void_count ?? 0} icon={<RotateCcw className="h-4 w-4" />} />
            <KPICard title="Respaldos" value={operations.summary.backup_count} icon={<Database className="h-4 w-4" />} />
            <KPICard title="Fallidos" value={operations.summary.failed_backup_count} />
            <KPICard title="Cajeros activos" value={operations.summary.cashier_count} icon={<Users className="h-4 w-4" />} />
          </div>

          {operations.voids.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Facturas anuladas</CardTitle>
                <CardDescription>Anulaciones en el rango consultado</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Factura</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operations.voids.map((voidedInvoice, index) => (
                      <TableRow key={`void-${voidedInvoice.invoice_number ?? index}-${voidedInvoice.voided_at ?? 'sin-fecha'}`}>
                        <TableCell className="font-medium">{voidedInvoice.invoice_number}</TableCell>
                        <TableCell>{voidedInvoice.patient_name}</TableCell>
                        <TableCell className="text-right">{moneyLabel(voidedInvoice.total)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{voidedInvoice.reason ?? 'Sin motivo'}</TableCell>
                        <TableCell>{voidedInvoice.user ?? 'Sin usuario'}</TableCell>
                        <TableCell>{formatDate(voidedInvoice.voided_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {operations.reprints.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Reimpresiones</CardTitle>
                <CardDescription>Reimpresiones de facturas en el rango</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Factura</TableHead>
                      <TableHead>Ancho</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operations.reprints.map((reprint, index) => (
                      <TableRow key={`reprint-${reprint.invoice_number ?? index}-${reprint.created_at ?? 'sin-fecha'}`}>
                        <TableCell className="font-medium">{reprint.invoice_number ?? '-'}</TableCell>
                        <TableCell>{reprint.width ?? '-'}</TableCell>
                        <TableCell>{reprint.reason ?? 'Sin motivo'}</TableCell>
                        <TableCell>{reprint.user ?? 'Sin usuario'}</TableCell>
                        <TableCell>{formatDate(reprint.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {(operations.payment_voids?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Reversos de pago</CardTitle>
                <CardDescription>Pagos corregidos en el rango consultado</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Factura</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Reversado por</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operations.payment_voids?.map((paymentVoid, index) => (
                      <TableRow key={`${paymentVoid.invoice_number ?? 'sin-factura'}-${index}`}>
                        <TableCell className="font-medium">{paymentVoid.invoice_number ?? '-'}</TableCell>
                        <TableCell>{paymentVoid.patient_name ?? '-'}</TableCell>
                        <TableCell>{paymentMethodLabel(paymentVoid.method)}</TableCell>
                        <TableCell className="text-right">{moneyLabel(paymentVoid.amount)}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{paymentVoid.reason ?? 'Sin motivo'}</TableCell>
                        <TableCell>{paymentVoid.voided_by ?? 'Sin usuario'}</TableCell>
                        <TableCell>{formatDate(paymentVoid.voided_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {operations.backups.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Respaldos</CardTitle>
                <CardDescription>Respaldos realizados en el rango</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Archivo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Tamaño</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operations.backups.map((backup, index) => (
                      <TableRow key={`backup-${backup.filename ?? index}-${backup.created_at ?? 'sin-fecha'}`}>
                        <TableCell className="max-w-[200px] truncate font-medium">{backup.filename}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${backup.status === 'success' ? 'bg-green-100 text-green-800' : backup.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {backupStatusLabel(backup.status)}
                          </span>
                        </TableCell>
                        <TableCell>{formatBytes(backup.size_bytes)}</TableCell>
                        <TableCell>{backupTypeLabel(backup.type)}</TableCell>
                        <TableCell>{backup.creator ?? 'Sistema'}</TableCell>
                        <TableCell>{formatDate(backup.completed_at ?? backup.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {operations.cashiers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Actividad de cajeros</CardTitle>
                <CardDescription>Cajeros con movimiento en el rango consultado</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead className="text-right">Pagos</TableHead>
                      <TableHead className="text-right">Cajas</TableHead>
                      <TableHead className="text-right">Facturas</TableHead>
                      <TableHead className="text-right">Total Cobrado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operations.cashiers.map((cashier, index) => (
                      <TableRow key={`cashier-${cashier.username || cashier.name || index}`}>
                        <TableCell className="font-medium">{cashier.name}</TableCell>
                        <TableCell>{cashier.username}</TableCell>
                        <TableCell className="text-right">{cashier.payment_count}</TableCell>
                        <TableCell className="text-right">{cashier.cash_session_count}</TableCell>
                        <TableCell className="text-right">{cashier.invoice_count}</TableCell>
                        <TableCell className="text-right">{moneyLabel(cashier.total_collected)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {!hasOperationalEvents && (
            <EmptyState
              title="Sin eventos operativos"
              description="No hay anulaciones, reversos, reimpresiones, respaldos ni actividad de cajeros para el rango seleccionado."
            />
          )}

          {canExport ? (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onExport}>
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
              <Button variant="outline" onClick={onExportPdf}>
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          ) : (
            <p className="text-right text-sm text-muted-foreground">
              La exportación requiere permiso de reportes.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('es-HN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function backupStatusLabel(status: string): string {
  return { pending: 'Pendiente', success: 'Completado', failed: 'Fallido' }[status] ?? status;
}

function backupTypeLabel(type: string): string {
  return { manual: 'Manual', scheduled: 'Automatico' }[type] ?? 'Operativo';
}

function paymentMethodLabel(method: string): string {
  return { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', other: 'Otro' }[method] ?? method;
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasFromCents(parseCents(value));
}

function formatBytes(size: number | null): string {
  if (size === null) return '-';
  return size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`;
}
