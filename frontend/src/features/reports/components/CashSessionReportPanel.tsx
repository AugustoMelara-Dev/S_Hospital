import { type FormEvent } from 'react';
import { AlertTriangle, Download, FileText } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Alert } from '../../../components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { NativeSelect } from '../../../components/ui/select';
import { StatGrid } from '../../../components/shared';
import { formatLocalizedDateTime } from '../../../lib/format/formatDate';
import type { CashSession, CashSessionReport } from '../../../lib/api/types';
import { formatLempirasUIFromCents, parseCents } from '../../../lib/moneyCents';

interface CashSessionReportPanelProps {
  canExport: boolean;
  cashSession: CashSessionReport | null;
  cashReportId: string;
  recentCashSessions?: CashSession[];
  sessionsLoading?: boolean;
  loading: boolean;
  exporting?: boolean;
  exportingType?: 'excel' | 'pdf' | null;
  error: string;
  onCashReportIdChange: (value: string) => void;
  onExport: () => void;
  onExportPdf: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

type MethodTotalRow = {
  method: string;
  total: string;
};

type RegisteredPayment = CashSessionReport['payments'][number];
type CashMovement = CashSessionReport['movements'][number];

const methodTotalColumns: Array<DataTableColumn<MethodTotalRow>> = [
  {
    key: 'method',
    header: 'Metodo',
    cellClassName: 'font-medium',
    render: (row) => methodLabel(row.method),
  },
  {
    key: 'total',
    header: 'Total',
    numeric: true,
    render: (row) => moneyLabel(row.total),
  },
];

const paymentColumns: Array<DataTableColumn<RegisteredPayment>> = [
  {
    key: 'invoice',
    header: 'Factura',
    cellClassName: 'font-medium',
    render: (payment) => fallbackText(payment.invoice?.invoice_number, 'Sin factura'),
  },
  {
    key: 'patient',
    header: 'Paciente',
    render: (payment) => fallbackText(payment.invoice?.patient_name, 'Sin paciente'),
  },
  {
    key: 'method',
    header: 'Metodo',
    render: (payment) => methodLabel(payment.method),
  },
  {
    key: 'amount',
    header: 'Monto',
    numeric: true,
    render: (payment) => moneyLabel(payment.amount),
  },
  {
    key: 'paid_at',
    header: 'Fecha',
    cellClassName: 'text-xs text-muted-foreground',
    render: (payment) => formatDate(payment.paid_at),
  },
];

const movementColumns: Array<DataTableColumn<CashMovement>> = [
  {
    key: 'type',
    header: 'Tipo',
    cellClassName: 'font-medium',
    render: (movement) => movementTypeLabel(movement.type),
  },
  {
    key: 'method',
    header: 'Metodo',
    render: (movement) => movementMethodLabel(movement.method),
  },
  {
    key: 'amount',
    header: 'Monto',
    numeric: true,
    render: (movement) => signedMoneyLabel(movement.amount),
  },
  {
    key: 'notes',
    header: 'Notas',
    cellClassName: 'max-w-[150px] truncate',
    render: (movement) => fallbackText(movement.notes, 'Sin nota'),
  },
  {
    key: 'user',
    header: 'Usuario',
    render: (movement) => fallbackText(movement.user?.name, 'Sin usuario'),
  },
  {
    key: 'occurred_at',
    header: 'Fecha',
    cellClassName: 'text-xs text-muted-foreground',
    render: (movement) => formatDate(movement.occurred_at),
  },
];

export function CashSessionReportPanel({
  canExport,
  cashSession,
  cashReportId,
  recentCashSessions = [],
  sessionsLoading = false,
  loading,
  exporting = false,
  exportingType = null,
  error,
  onCashReportIdChange,
  onExport,
  onExportPdf,
  onSubmit,
}: CashSessionReportPanelProps) {
  const lookupLocked = loading || exporting;
  const hasRecentCashSessions = recentCashSessions.length > 0;
  const methodTotalRows = cashSession
    ? Object.entries(cashSession.totals_by_method).map(([method, total]) => ({ method, total }))
    : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[minmax(0,200px)_auto] sm:items-end">
            <div className="w-full">
              {hasRecentCashSessions ? (
                <>
                  <Label htmlFor="cash-session-id">Caja reciente</Label>
                  <NativeSelect
                    id="cash-session-id"
                    aria-describedby="cash-session-id-help"
                    value={cashReportId}
                    onChange={(event) => onCashReportIdChange(event.target.value)}
                    disabled={lookupLocked || sessionsLoading}
                  >
                    {recentCashSessions.map((session) => (
                      <option key={session.id} value={String(session.id)}>
                        {cashSessionOptionLabel(session)}
                      </option>
                    ))}
                  </NativeSelect>
                  <p id="cash-session-id-help" className="mt-1 text-xs text-muted-foreground">
                    Seleccione una caja reciente. La mas nueva queda lista para consultar.
                  </p>
                </>
              ) : (
                <>
                  <Label htmlFor="cash-session-id">Numero de Caja</Label>
                  <Input
                    id="cash-session-id"
                    type="text"
                    inputMode="numeric"
                    placeholder="Numero mostrado en caja"
                    aria-describedby="cash-session-id-help"
                    value={cashReportId}
                    onChange={(event) => onCashReportIdChange(event.target.value)}
                    disabled={lookupLocked}
                  />
                  <p id="cash-session-id-help" className="mt-1 text-xs text-muted-foreground">
                    Use el numero que aparece en Caja al abrir o cerrar turno.
                  </p>
                </>
              )}
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={lookupLocked}>
              {loading ? 'Consultando...' : 'Ver caja'}
            </Button>
          </form>
          {error ? (
            <div className="mt-3">
              <Alert variant="destructive" title="No se pudo cargar la caja">
                {error}
              </Alert>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {cashSession ? (
        <>
          <StatGrid
            className="sm:grid-cols-2 xl:grid-cols-6"
            items={[
              {
                label: 'Cajero',
                value: cashSession.cash_session.user?.name ?? 'Sin asignar',
              },
              {
                label: 'Apertura',
                value: moneyLabel(cashSession.cash_session.opening_amount),
              },
              {
                label: 'Esperado',
                value: moneyLabel(cashSession.expected_cash_amount),
                helper: 'Apertura mas cobros en efectivo',
              },
              {
                label: 'Cobrado',
                value: moneyLabel(cashSession.payments_total),
                helper: `${cashSession.payments_count} ${cashSession.payments_count === 1 ? 'pago' : 'pagos'}`,
                tone: 'success',
              },
              {
                label: 'Pendiente',
                value: moneyLabel(cashSession.pending_amount),
                helper: pendingInvoiceLabel(cashSession.pending_invoice_count),
                tone: cashSession.pending_invoice_count > 0 ? 'warning' : 'neutral',
              },
              {
                label: 'Contado',
                value:
                  cashSession.cash_session.closing_amount === null
                    ? 'Pendiente'
                    : moneyLabel(cashSession.cash_session.closing_amount),
                tone: cashSession.cash_session.closing_amount === null ? 'warning' : 'neutral',
              },
            ]}
          />

          {cashSession.cash_session.difference_amount && (parseCents(cashSession.cash_session.difference_amount) ?? 0) !== 0 ? (
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
                {cashSession.cash_session.closing_notes?.trim() ? (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {cashSession.cash_session.closing_notes.trim()}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Totales por metodo</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                caption="Totales por metodo de pago."
                columns={methodTotalColumns}
                containerLabel="Totales por metodo"
                emptyDescription="Los totales por metodo apareceran cuando la caja tenga datos de cobro."
                emptyTitle="Sin totales por metodo"
                getRowKey={(row) => row.method}
                rows={methodTotalRows}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pagos registrados ({cashSession.payments.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                caption="Pagos registrados en la caja."
                columns={paymentColumns}
                containerLabel="Pagos registrados"
                emptyDescription="Los pagos cobrados apareceran cuando esta caja tenga cobros publicados."
                emptyTitle="Sin pagos registrados"
                getRowKey={(payment) => payment.id}
                rows={cashSession.payments}
                tableClassName="min-w-[720px]"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Movimientos ({cashSession.movements.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                caption="Movimientos registrados en la caja."
                columns={movementColumns}
                containerLabel="Movimientos de caja"
                emptyDescription="Aperturas, cierres y ajustes apareceran cuando esta caja tenga movimientos registrados."
                emptyTitle="Sin movimientos de caja"
                getRowKey={(movement) => movement.id}
                rows={cashSession.movements}
                tableClassName="min-w-[860px]"
              />
            </CardContent>
          </Card>

          <div className="flex flex-wrap justify-end gap-2">
            {canExport ? (
              <>
                <Button type="button" variant="outline" onClick={onExportPdf} disabled={exporting}>
                  <FileText className="mr-2 h-4 w-4" />
                  {exportingType === 'pdf' ? 'Abriendo PDF...' : 'PDF caja'}
                </Button>
                <Button type="button" variant="outline" onClick={onExport} disabled={exporting}>
                  <Download className="mr-2 h-4 w-4" />
                  {exportingType === 'excel' ? 'Exportando Excel...' : 'Exportar Excel'}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Exportar caja requiere permiso de exportacion de reportes.
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

function cashSessionOptionLabel(session: CashSession): string {
  const cashier = session.user?.name?.trim() || 'Sin cajero';
  const status = session.status === 'open' ? 'abierta' : 'cerrada';
  const openedAt = formatDate(session.opened_at);

  return `Caja #${session.id} - ${cashier} - ${status} - ${openedAt}`;
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
    return 'Sin metodo';
  }

  return { ...methodLabels(), closing: 'Cierre de caja' }[method] ?? humanizeEnum(method);
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasUIFromCents(parseCents(value));
}

function signedMoneyLabel(value: string | number | null | undefined): string {
  const cents = parseSignedCents(value);
  if (cents === null || cents >= 0) {
    return formatLempirasUIFromCents(cents);
  }

  return `- ${formatLempirasUIFromCents(Math.abs(cents))}`;
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

function formatDate(value: string | null | undefined): string {
  const formatted = formatLocalizedDateTime(value);
  return formatted === '-' ? 'Sin fecha' : formatted;
}

function fallbackText(value: string | null | undefined, fallback: string): string {
  return value?.trim() || fallback;
}

