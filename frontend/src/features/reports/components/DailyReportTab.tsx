import { type FormEvent } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Banknote, CircleSlash, DollarSign, Download, FileText } from 'lucide-react';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { finiteNumber, formatLempirasUI } from '../../../lib/money';
import type { DailyReport } from '../../../lib/api/types';
import { KPICard } from './KPICard';

interface DailyReportTabProps {
  canExport: boolean;
  daily: DailyReport | null;
  dailyDate: string;
  error: string;
  exporting?: boolean;
  loading: boolean;
  onDateChange: (value: string) => void;
  onExport: () => void;
  onExportPdf: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

type FinancialReadingRow = {
  key: string;
  label: string;
  value: number | string;
};

type PaymentMethodRow = {
  amount: string;
  method: string;
};

type InvoiceStatusRow = {
  count: number;
  status: string;
  total: string;
};

const financialReadingColumns: Array<DataTableColumn<FinancialReadingRow>> = [
  {
    key: 'label',
    header: 'Concepto',
    cellClassName: 'font-medium',
    render: (row) => row.label,
  },
  {
    key: 'value',
    header: 'Monto',
    numeric: true,
    render: (row) => (typeof row.value === 'number' ? row.value : formatLempirasUI(row.value)),
  },
];

const paymentMethodColumns: Array<DataTableColumn<PaymentMethodRow>> = [
  {
    key: 'method',
    header: 'Método',
    cellClassName: 'font-medium',
    render: (row) => methodLabel(row.method),
  },
  {
    key: 'amount',
    header: 'Monto',
    numeric: true,
    render: (row) => formatLempirasUI(row.amount),
  },
];

const invoiceStatusColumns: Array<DataTableColumn<InvoiceStatusRow>> = [
  {
    key: 'status',
    header: 'Estado',
    cellClassName: 'font-medium',
    render: (row) => statusLabel(row.status),
  },
  {
    key: 'count',
    header: 'Cantidad',
    numeric: true,
    render: (row) => row.count,
  },
  {
    key: 'total',
    header: 'Total',
    numeric: true,
    render: (row) => formatLempirasUI(row.total),
  },
];

export function DailyReportTab({
  canExport,
  daily,
  dailyDate,
  error,
  exporting = false,
  loading,
  onDateChange,
  onExport,
  onExportPdf,
  onSubmit,
}: DailyReportTabProps) {
  const paymentsByMethod = daily?.payments_by_method ?? {
    cash: '0.00',
    transfer: '0.00',
    card: '0.00',
    other: '0.00',
  };
  const invoicesByStatus = daily?.invoices_by_status ?? {
    issued: { count: 0, total: '0.00' },
    partial: { count: 0, total: '0.00' },
    paid: { count: 0, total: '0.00' },
    void: { count: 0, total: '0.00' },
  };

  const financialReadingRows: FinancialReadingRow[] = daily
    ? [
        { key: 'payments', label: 'Pagos registrados', value: daily.payment_count },
        { key: 'partial', label: 'Facturas parciales', value: daily.total_partial },
        { key: 'pending', label: 'Saldo pendiente', value: daily.total_pending },
      ]
    : [];
  const paymentMethodRows = Object.entries(paymentsByMethod).map(([method, amount]) => ({ method, amount }));
  const invoiceStatusRows = Object.entries(invoicesByStatus).map(([status, data]) => ({
    count: data?.count ?? 0,
    status,
    total: data?.total ?? '0.00',
  }));
  const chartData = daily
    ? paymentMethodRows.map((row) => ({
        method: methodLabel(row.method),
        amount: finiteNumber(row.amount),
      }))
    : [];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold tracking-tight">Resumen del día</h2>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[minmax(0,200px)_auto] sm:items-end">
            <div className="w-full">
              <Label htmlFor="daily-date">Fecha</Label>
              <Input
                id="daily-date"
                type="date"
                value={dailyDate}
                onChange={(event) => onDateChange(event.target.value)}
              />
            </div>
            <Button type="submit" className="w-full sm:w-auto" disabled={loading}>
              {loading ? 'Consultando...' : 'Actualizar'}
            </Button>
          </form>
          {error ? (
            <div className="mt-3">
              <Alert variant="destructive" title="No se pudo cargar el reporte diario">
                {error}
              </Alert>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {daily ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KPICard
              title="Facturado"
              value={formatLempirasUI(daily.total_billed)}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <KPICard
              title="Cobrado"
              value={formatLempirasUI(daily.total_collected)}
              icon={<Banknote className="h-4 w-4" />}
            />
            <KPICard
              title="Pendiente"
              value={formatLempirasUI(daily.total_pending)}
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
              value={formatLempirasUI(daily.total_voided)}
              description={`${invoicesByStatus.void?.count ?? 0} facturas anuladas`}
              icon={<CircleSlash className="h-4 w-4" />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lectura financiera</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                caption="Lectura financiera diaria."
                columns={financialReadingColumns}
                containerLabel="Lectura financiera"
                emptyDescription="Los indicadores financieros aparecerán cuando se cargue el reporte diario."
                emptyTitle="Sin lectura financiera"
                getRowKey={(row) => row.key}
                rows={financialReadingRows}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Cobros por método</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                caption="Cobros diarios por método."
                columns={paymentMethodColumns}
                containerLabel="Cobros por método"
                emptyDescription="Los cobros por método aparecerán cuando existan pagos en el día."
                emptyTitle="Sin cobros por método"
                getRowKey={(row) => row.method}
                rows={paymentMethodRows}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Estado de facturas</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                caption="Estado diario de facturas."
                columns={invoiceStatusColumns}
                containerLabel="Estado de facturas"
                emptyDescription="El estado de facturas aparecerá cuando se cargue el reporte diario."
                emptyTitle="Sin estado de facturas"
                getRowKey={(row) => row.status}
                rows={invoiceStatusRows}
              />
            </CardContent>
          </Card>

          {chartData.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Gráfico por método</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  role="img"
                  aria-label="Gráfico de montos por método de pago; la tabla anterior contiene los valores exactos."
                >
                  <ResponsiveContainer width="100%" height={200} minWidth={1} minHeight={1}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="method" tickLine={false} />
                      <YAxis tickLine={false} width={64} />
                      <Tooltip formatter={(value) => [formatLempirasUI(value as number), 'Monto']} />
                      <Bar dataKey="amount" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          ) : null}

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
