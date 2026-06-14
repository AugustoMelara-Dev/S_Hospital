import { type FormEvent } from 'react';
import { AlertTriangle, ClipboardList, Database, Download, Printer, RotateCcw, Users } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/data-table';
import { EmptyState } from '../../../components/ui/states';
import { KPICard } from './KPICard';
import type { OperationsReport } from '../../../lib/api/types';
import { formatLempirasFromCents, parseCents } from '../../../lib/moneyCents';
import { formatLocalizedDateTime } from '../../../lib/format/formatDate';

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
      (operations.catalog_changes?.length ?? 0) > 0 ||
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 xl:grid-cols-7">
            <KPICard title="Anulaciones" value={operations.summary.void_count} icon={<AlertTriangle className="h-4 w-4" />} />
            <KPICard title="Reimpresiones" value={operations.summary.reprint_count} icon={<Printer className="h-4 w-4" />} />
            <KPICard title="Reversos" value={operations.summary.payment_void_count ?? 0} icon={<RotateCcw className="h-4 w-4" />} />
            <KPICard title="Catalogo" value={operations.summary.service_change_count ?? 0} icon={<ClipboardList className="h-4 w-4" />} />
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

          {(operations.catalog_changes?.length ?? 0) > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Cambios de catálogo</CardTitle>
                <CardDescription>Servicios modificados en el rango consultado</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Servicio</TableHead>
                      <TableHead>Cambio</TableHead>
                      <TableHead>Antes</TableHead>
                      <TableHead>Despues</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Fecha</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operations.catalog_changes?.map((change, index) => (
                      <TableRow key={`catalog-${change.service}-${change.created_at ?? index}`}>
                        <TableCell className="max-w-[180px] break-words font-medium">{change.service}</TableCell>
                        <TableCell>{catalogActionLabel(change.action)}</TableCell>
                        <TableCell>{catalogValuesList(change.old_values)}</TableCell>
                        <TableCell>{catalogValuesList(change.new_values)}</TableCell>
                        <TableCell className="max-w-[220px] break-words">{catalogReason(change.new_values)}</TableCell>
                        <TableCell>{change.user ?? 'Sin usuario'}</TableCell>
                        <TableCell>{formatDate(change.created_at)}</TableCell>
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
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${backup.status === 'success' ? 'border-success/30 bg-success/10 text-success' : backup.status === 'failed' ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-warning/30 bg-warning/10 text-warning'}`}>
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
          description="No hay anulaciones, reversos, reimpresiones, cambios de catálogo, respaldos ni actividad de cajeros para el rango seleccionado."
            />
          )}

          {canExport ? (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onExport}>
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
              <Button type="button" variant="outline" onClick={onExportPdf}>
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
  return formatLocalizedDateTime(value);
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

const CATALOG_VALUE_LABELS: Record<string, string> = {
  name: 'Nombre',
  aliases: 'Alias',
  price: 'Precio',
  taxable: 'Con impuesto',
  active: 'Activo',
  visible_in_billing: 'Visible en caja',
  is_billable: 'Facturable',
  special_rule_code: 'Regla especial',
  category: 'Categoria',
  area: 'Area',
};

function catalogActionLabel(action: string): string {
  return {
    'service.created': 'Servicio creado',
    'service.updated': 'Servicio actualizado',
    'service.price_updated': 'Precio actualizado',
    'service.active_updated': 'Estado actualizado',
    'service.visibility_updated': 'Visibilidad actualizada',
    'service.billability_updated': 'Facturacion actualizada',
  }[action] ?? 'Cambio de servicio';
}

function catalogValuesList(values: Record<string, unknown>) {
  const entries = Object.entries(values)
    .filter(([key]) => key !== 'price_change_reason' && key in CATALOG_VALUE_LABELS)
    .map(([key, value]) => ({
      key,
      label: CATALOG_VALUE_LABELS[key],
      value: catalogValueLabel(key, value),
    }));

  if (entries.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <ul className="max-w-[260px] space-y-1 text-sm">
      {entries.map((entry) => (
        <li key={entry.key} className="break-words">
          <span className="font-medium">{entry.label}:</span> {entry.value}
        </li>
      ))}
    </ul>
  );
}

function catalogValueLabel(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return 'Sin dato';
  }

  if (field === 'price') {
    return moneyLabel(String(value));
  }

  if (field === 'special_rule_code') {
    return String(value) === 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION'
      ? 'Eritropoyetina con receta de diálisis'
      : 'Configuración especial';
  }

  if (typeof value === 'boolean') {
    return value ? 'Si' : 'No';
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(String).join(', ') : 'Sin dato';
  }

  return String(value);
}

function catalogReason(values: Record<string, unknown>): string {
  const reason = values.price_change_reason;
  return typeof reason === 'string' && reason.trim() !== '' ? reason : 'No aplica';
}
