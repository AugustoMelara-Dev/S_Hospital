import { type FormEvent } from 'react';
import { TriangleAlertIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { DataTable, type InstitutionalColumn } from '@/design-system/patterns/DataTable';
import { formatLocalizedDateTime } from '../../../lib/format/formatDate';
import type { CashSession, CashSessionReport } from '../../../lib/api/types';
import { formatLempirasUIFromCents, parseCents } from '../../../lib/moneyCents';
import { AccountingControlPanel } from '../../../modules/accounting/components/AccountingControlPanel';
import { ReportExportMenu } from './ReportExportMenu';

function StatGrid({ items }: { className?: string; items: Array<{ label: string; value: React.ReactNode; helper?: string; tone?: string }> }) { return <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{items.map((item) => <div className="rounded-xl border border-border bg-card p-4" key={item.label}><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</dt><dd className="mt-2 text-xl font-semibold tabular-nums">{item.value}</dd>{item.helper ? <p className="mt-1 text-xs text-muted-foreground">{item.helper}</p> : null}</div>)}</dl>; }

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

function ReportTableCard({ children, description, title }: { children: React.ReactNode; description: string; title: string }) {
  return <section aria-label={title}><Card><CardHeader><CardTitle><h3>{title}</h3></CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{children}</CardContent></Card></section>;
}

type MethodTotalRow = {
  method: string;
  total: string;
};

type RegisteredPayment = CashSessionReport['payments'][number];
type CashMovement = CashSessionReport['movements'][number];

const methodTotalColumns: InstitutionalColumn<MethodTotalRow>[] = [
  { accessorKey: 'method', header: 'Método', cell: ({ row }) => methodLabel(row.original.method) },
  { accessorKey: 'total', header: 'Total', meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums">{moneyLabel(row.original.total)}</span> },
];

const paymentColumns: InstitutionalColumn<RegisteredPayment>[] = [
  { id: 'invoice', header: 'Factura', cell: ({ row }) => fallbackText(row.original.invoice?.invoice_number, 'Sin factura') },
  { id: 'patient', header: 'Paciente', cell: ({ row }) => fallbackText(row.original.invoice?.patient_name, 'Sin paciente') },
  { accessorKey: 'method', header: 'Método', cell: ({ row }) => methodLabel(row.original.method) },
  { accessorKey: 'amount', header: 'Monto', meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums">{moneyLabel(row.original.amount)}</span> },
  { accessorKey: 'paid_at', header: 'Fecha', cell: ({ row }) => formatDate(row.original.paid_at) },
];

const movementColumns: InstitutionalColumn<CashMovement>[] = [
  { accessorKey: 'type', header: 'Tipo', cell: ({ row }) => movementTypeLabel(row.original.type) },
  { accessorKey: 'method', header: 'Método', cell: ({ row }) => movementMethodLabel(row.original.method) },
  { accessorKey: 'amount', header: 'Monto', meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums">{signedMoneyLabel(row.original.amount)}</span> },
  { accessorKey: 'notes', header: 'Notas', cell: ({ row }) => fallbackText(row.original.notes, 'Sin nota') },
  { id: 'user', header: 'Usuario', cell: ({ row }) => fallbackText(row.original.user?.name, 'Sin usuario') },
  { accessorKey: 'occurred_at', header: 'Fecha', cell: ({ row }) => formatDate(row.original.occurred_at) },
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
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border bg-card p-4" aria-label="Consulta de caja">
          <form onSubmit={onSubmit}>
            <FieldGroup className="grid gap-4 sm:grid-cols-2 sm:items-end">
              {hasRecentCashSessions ? (
                <Field>
                  <FieldLabel htmlFor="cash-session-id">Caja reciente</FieldLabel>
                  <Select value={cashReportId} onValueChange={onCashReportIdChange} disabled={lookupLocked || sessionsLoading}>
                    <SelectTrigger id="cash-session-id" className="w-full"><SelectValue placeholder="Seleccione una caja" /></SelectTrigger>
                    <SelectContent><SelectGroup>{recentCashSessions.map((session) => <SelectItem key={session.id} value={String(session.id)}>{cashSessionOptionLabel(session)}</SelectItem>)}</SelectGroup></SelectContent>
                  </Select>
                  <FieldDescription>Seleccione una caja reciente. La más nueva queda lista para consultar.</FieldDescription>
                </Field>
              ) : (
                <Field>
                  <FieldLabel htmlFor="cash-session-id">Número de caja</FieldLabel>
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
                  <FieldDescription id="cash-session-id-help">Use el número que aparece en Caja al abrir o cerrar turno.</FieldDescription>
                </Field>
              )}
              <Button type="submit" className="w-full sm:w-auto" disabled={lookupLocked}>{loading ? <Spinner data-icon="inline-start" /> : null}Ver caja</Button>
            </FieldGroup>
          </form>
          {error ? (
            <Alert variant="destructive" className="mt-3"><AlertTitle>No se pudo cargar la caja</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
          ) : null}
      </section>

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

          <AccountingControlPanel reconciliation={cashSession} />

          <CashDenominationBreakdown breakdown={cashSession.cash_session.closing_breakdown} />

          {cashSession.cash_session.difference_amount && (parseCents(cashSession.cash_session.difference_amount) ?? 0) !== 0 ? (
            <Alert variant="destructive" aria-labelledby="cash-difference-title">
                <TriangleAlertIcon aria-hidden="true" />
                <AlertTitle id="cash-difference-title">Diferencia</AlertTitle>
                <AlertDescription>
                <div className="text-3xl font-bold tabular-nums">
                  {moneyLabel(cashSession.cash_session.difference_amount)}
                </div>
                {cashSession.cash_session.closing_notes?.trim() ? (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {cashSession.cash_session.closing_notes.trim()}
                  </p>
                ) : null}
                </AlertDescription>
            </Alert>
          ) : null}

          <ReportTableCard title="Totales por método" description="Distribución de lo cobrado por forma de pago."><DataTable ariaLabel="Totales por método" data={methodTotalRows} columns={methodTotalColumns} getRowId={(row) => row.method} emptyTitle="Sin totales por método" /></ReportTableCard>

          <ReportTableCard title={`Pagos registrados (${cashSession.payments.length})`} description="Pagos asociados a esta sesión de caja."><DataTable ariaLabel="Pagos registrados" data={cashSession.payments} columns={paymentColumns} getRowId={(payment) => String(payment.id)} emptyTitle="Sin pagos registrados" /></ReportTableCard>

          <ReportTableCard title={`Movimientos (${cashSession.movements.length})`} description="Entradas, salidas, reversos y ajustes auditados."><DataTable ariaLabel="Movimientos de caja" data={cashSession.movements} columns={movementColumns} getRowId={(movement) => String(movement.id)} emptyTitle="Sin movimientos de caja" /></ReportTableCard>

          <div className="flex flex-wrap justify-end gap-2">
            {canExport ? (
              <ReportExportMenu
                disabled={exporting}
                exporting={exportingType !== null}
                onExportPdf={onExportPdf}
                onExportExcel={onExport}
              />
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

function CashDenominationBreakdown({
  breakdown,
}: {
  breakdown: CashSession['closing_breakdown'];
}) {
  if (!breakdown) return null;

  const billEntries = Object.entries(breakdown.bills)
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => Number(right) - Number(left));
  const billsTotalCents = billEntries.reduce(
    (total, [denomination, count]) => total + (Number(denomination) * count * 100),
    0,
  );
  const otherCents = parseCents(breakdown.other_amount) ?? 0;
  const totalCents = billsTotalCents + otherCents;

  return (
    <section
      aria-labelledby="cash-denomination-report-title"
      className="border border-operational-border bg-operational-surface p-4"
    >
      <h3 id="cash-denomination-report-title" className="text-base font-semibold">Desglose del conteo físico</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Conteo auditado al cerrar la sesión. Solo se muestran denominaciones con unidades registradas.
      </p>
      <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {billEntries.map(([denomination, count]) => (
          <div key={denomination} className="flex flex-wrap justify-between gap-x-3 border-b border-border py-2">
            <dt className="font-medium">Billetes de L {denomination}</dt>
            <dd className="text-right font-semibold tabular-nums">
              {moneyLabel(String(Number(denomination) * count))}
            </dd>
            <dd className="w-full text-xs text-muted-foreground">
              {count} {count === 1 ? 'billete' : 'billetes'}
            </dd>
          </div>
        ))}
        <div className="flex justify-between gap-x-3 border-b border-border py-2">
          <dt className="font-medium">Monedas y otros</dt>
          <dd className="text-right font-semibold tabular-nums">{moneyLabel(breakdown.other_amount)}</dd>
        </div>
        <div className="flex justify-between gap-x-3 border-l-2 border-primary bg-muted/40 px-3 py-2 sm:col-span-2 xl:col-span-3">
          <dt className="font-semibold">Total contado por desglose</dt>
          <dd className="text-right text-lg font-bold tabular-nums">
            {formatLempirasUIFromCents(totalCents)}
          </dd>
        </div>
      </dl>
    </section>
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
