import { type FormEvent } from 'react';
import { DownloadOutlined, FilePdfOutlined, WarningOutlined } from '@ant-design/icons';
import { Alert, Button, Col, Form, Input, Row, Select, Statistic, Typography } from 'antd';
import { InstitutionalDataGrid, type InstitutionalColumn } from '@/design-system/ag-grid';
import { formatLocalizedDateTime } from '../../../lib/format/formatDate';
import type { CashSession, CashSessionReport } from '../../../lib/api/types';
import { formatLempirasUIFromCents, parseCents } from '../../../lib/moneyCents';
import { AccountingControlPanel } from '../../../modules/accounting/components/AccountingControlPanel';

function StatGrid({ items }: { className?: string; items: Array<{ label: string; value: React.ReactNode; helper?: string; tone?: string }> }) { return <Row gutter={[12, 12]}>{items.map((item) => <Col xs={24} sm={12} xl={4} key={item.label}><Statistic title={item.label} value={String(item.value)} /><Typography.Text type="secondary">{item.helper}</Typography.Text></Col>)}</Row>; }

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

const methodTotalColumns: InstitutionalColumn<MethodTotalRow>[] = [
  {
    colId: 'method', headerName: 'Método', field: 'method', flex: 1,
    valueFormatter: ({ value }) => methodLabel(String(value)),
  },
  {
    colId: 'total', headerName: 'Total', field: 'total', priority: 'secondary',
    valueFormatter: ({ value }) => moneyLabel(String(value)),
  },
];

const paymentColumns: InstitutionalColumn<RegisteredPayment>[] = [
  {
    colId: 'invoice', headerName: 'Factura', flex: 1,
    valueGetter: ({ data }) => fallbackText(data?.invoice?.invoice_number, 'Sin factura'),
  },
  {
    colId: 'patient', headerName: 'Paciente', flex: 1,
    valueGetter: ({ data }) => fallbackText(data?.invoice?.patient_name, 'Sin paciente'),
  },
  {
    colId: 'method', headerName: 'Método', field: 'method',
    valueFormatter: ({ value }) => methodLabel(String(value)),
  },
  {
    colId: 'amount', headerName: 'Monto', field: 'amount', priority: 'secondary',
    valueFormatter: ({ value }) => moneyLabel(String(value)),
  },
  {
    colId: 'paid_at', headerName: 'Fecha', field: 'paid_at', priority: 'secondary',
    valueFormatter: ({ value }) => formatDate(String(value)),
  },
];

const movementColumns: InstitutionalColumn<CashMovement>[] = [
  {
    colId: 'type', headerName: 'Tipo', field: 'type', flex: 1,
    valueFormatter: ({ value }) => movementTypeLabel(String(value)),
  },
  {
    colId: 'method', headerName: 'Método', field: 'method',
    valueFormatter: ({ value }) => movementMethodLabel(value ? String(value) : null),
  },
  {
    colId: 'amount', headerName: 'Monto', field: 'amount', priority: 'secondary',
    valueFormatter: ({ value }) => signedMoneyLabel(String(value)),
  },
  {
    colId: 'notes', headerName: 'Notas', field: 'notes', flex: 1,
    valueFormatter: ({ value }) => fallbackText(value ? String(value) : null, 'Sin nota'),
  },
  {
    colId: 'user', headerName: 'Usuario',
    valueGetter: ({ data }) => fallbackText(data?.user?.name, 'Sin usuario'),
  },
  {
    colId: 'occurred_at', headerName: 'Fecha', field: 'occurred_at', priority: 'secondary',
    valueFormatter: ({ value }) => formatDate(value ? String(value) : null),
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
      <section className="overflow-hidden">
        <div className="bg-muted/40 pt-6">
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-[minmax(0,240px)_auto] sm:items-end">
            <div className="w-full">
              {hasRecentCashSessions ? (
                <Form.Item label="Caja reciente" htmlFor="cash-session-id" extra="Seleccione una caja reciente. La más nueva queda lista para consultar.">
                  <Select
                    id="cash-session-id"
                    aria-label="Caja reciente"
                    value={cashReportId}
                    onChange={onCashReportIdChange}
                    disabled={lookupLocked || sessionsLoading}
                    options={recentCashSessions.map((session) => ({
                      value: String(session.id),
                      label: cashSessionOptionLabel(session),
                    }))}
                  />
                </Form.Item>
              ) : (
                <Form.Item label="Número de caja" htmlFor="cash-session-id" extra="Use el número que aparece en Caja al abrir o cerrar turno.">
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
                </Form.Item>
              )}
            </div>
            <Button htmlType="submit" type="primary" size="large" className="w-full sm:w-auto" disabled={lookupLocked} loading={loading}>
              Ver caja
            </Button>
          </form>
          {error ? (
            <div className="mt-3">
              <Alert type="error" showIcon title="No se pudo cargar la caja" description={error} />
            </div>
          ) : null}
        </div>
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

          {cashSession.cash_session.difference_amount && (parseCents(cashSession.cash_session.difference_amount) ?? 0) !== 0 ? (
            <section className="border border-destructive/30 bg-destructive/5 p-4" aria-labelledby="cash-difference-title">
                <Typography.Title id="cash-difference-title" level={3} className="flex items-center gap-2 text-destructive">
                  <WarningOutlined aria-hidden />
                  Diferencia
                </Typography.Title>
                <div className="text-3xl font-bold text-destructive">
                  {moneyLabel(cashSession.cash_session.difference_amount)}
                </div>
                {cashSession.cash_session.closing_notes?.trim() ? (
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {cashSession.cash_session.closing_notes.trim()}
                  </p>
                ) : null}
            </section>
          ) : null}

          <section aria-labelledby="method-totals-title">
            <Typography.Title id="method-totals-title" level={3}>Totales por método</Typography.Title>
            <InstitutionalDataGrid ariaLabel="Totales por método" rows={methodTotalRows} columns={methodTotalColumns} getRowId={(row) => row.method} state={methodTotalRows.length ? 'ready' : 'empty'} emptyMessage="Sin totales por método" density="compact" gridOptions={{ pagination: false }} />
          </section>

          <section aria-labelledby="payments-title">
            <Typography.Title id="payments-title" level={3}>Pagos registrados ({cashSession.payments.length})</Typography.Title>
            <InstitutionalDataGrid ariaLabel="Pagos registrados" rows={cashSession.payments} columns={paymentColumns} getRowId={(payment) => String(payment.id)} state={cashSession.payments.length ? 'ready' : 'empty'} emptyMessage="Sin pagos registrados" density="compact" gridOptions={{ pagination: false }} />
          </section>

          <section aria-labelledby="movements-title">
            <Typography.Title id="movements-title" level={3}>Movimientos ({cashSession.movements.length})</Typography.Title>
            <InstitutionalDataGrid ariaLabel="Movimientos de caja" rows={cashSession.movements} columns={movementColumns} getRowId={(movement) => String(movement.id)} state={cashSession.movements.length ? 'ready' : 'empty'} emptyMessage="Sin movimientos de caja" density="compact" gridOptions={{ pagination: false }} />
          </section>

          <div className="flex flex-wrap justify-end gap-2">
            {canExport ? (
              <>
                <Button htmlType="button" onClick={onExportPdf} disabled={exporting}>
                  <FilePdfOutlined aria-hidden />
                  {exportingType === 'pdf' ? 'Abriendo PDF...' : 'PDF caja'}
                </Button>
                <Button htmlType="button" onClick={onExport} disabled={exporting}>
                  <DownloadOutlined aria-hidden />
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
