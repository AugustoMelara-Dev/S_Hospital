import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DollarSign, TrendingUp, Calendar, Download, CircleSlash } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/data-table';
import { KPICard } from './KPICard';
import type {
  Area,
  AreaIncomeReport,
  Category,
  CategoryReport,
  IncomeReport,
  ReportFilters,
} from '../../../lib/api/types';
import { formatCents, formatLempirasFromCents, parseCents } from '../../../lib/moneyCents';

interface IncomeReportTabProps {
  canExport: boolean;
  dateFrom: string;
  dateTo: string;
  categoryId: string;
  areaId: string;
  cashSessionId: string;
  cashierId: string;
  method: NonNullable<ReportFilters['method']>;
  status: NonNullable<ReportFilters['status']>;
  categoryOptions: Category[];
  areaOptions: Area[];
  loading: boolean;
  income: IncomeReport | null;
  categories: CategoryReport | null;
  areas: AreaIncomeReport | null;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onAreaChange: (value: string) => void;
  onCashSessionChange: (value: string) => void;
  onCashierChange: (value: string) => void;
  onMethodChange: (value: NonNullable<ReportFilters['method']>) => void;
  onExport: () => void;
  onExportPdf: () => void;
  onStatusChange: (value: NonNullable<ReportFilters['status']>) => void;
  onSubmit: () => void;
}

export function IncomeReportTab({
  canExport,
  dateFrom,
  dateTo,
  categoryId,
  areaId,
  cashSessionId,
  cashierId,
  method,
  status,
  categoryOptions,
  areaOptions,
  loading,
  income,
  categories,
  areas,
  onDateFromChange,
  onDateToChange,
  onCategoryChange,
  onAreaChange,
  onCashSessionChange,
  onCashierChange,
  onMethodChange,
  onExport,
  onExportPdf,
  onStatusChange,
  onSubmit,
}: IncomeReportTabProps) {

  const daysInRange = Math.max(1, Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const averagePerDay = income
    ? formatCents(Math.round((parseCents(income.total_collected) ?? 0) / daysInRange))
    : '0.00';

  const paymentsByMethod = income?.payments_by_method ?? {
    cash: '0.00',
    transfer: '0.00',
    card: '0.00',
    other: '0.00',
  };
  const categoryAmountLabel = categories?.amount_label ?? 'Total';
  const areaAmountLabel = areas?.amount_label ?? 'Total';

  const chartData = income
    ? Object.entries(paymentsByMethod).map(([method, amount]) => ({
        method: methodLabel(method),
        amount: (parseCents(amount) ?? 0) / 100,
      }))
    : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <Label htmlFor="income-date-from">Desde</Label>
              <Input id="income-date-from" type="date" value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="income-date-to">Hasta</Label>
              <Input id="income-date-to" type="date" value={dateTo} onChange={(e) => onDateToChange(e.target.value)} />
            </div>
            <div className="w-[180px]">
              <Label>Categoría</Label>
              <Select value={categoryId || 'all'} onValueChange={(v) => onCategoryChange(v === 'all' ? '' : v)}>
                <SelectTrigger id="income-category" aria-label="Categoría">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categoryOptions.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[180px]">
              <Label>Area</Label>
              <Select value={areaId || 'all'} onValueChange={(v) => onAreaChange(v === 'all' ? '' : v)}>
                <SelectTrigger id="income-area" aria-label="Area">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {areaOptions.map((area) => (
                    <SelectItem key={area.id} value={String(area.id)}>{area.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-[180px]">
              <Label htmlFor="income-method">Metodo de pago</Label>
              <Select value={method || 'all'} onValueChange={(v) => {
                const mapped = v === 'all' ? '' : v;
                onMethodChange(mapped as NonNullable<ReportFilters['method']>);
              }}>
                <SelectTrigger id="income-method" aria-label="Método de pago">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="card">Tarjeta</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[180px]">
              <Label htmlFor="income-status">Estado</Label>
              <Select value={status || 'all'} onValueChange={(v) => {
                const mapped = v === 'all' ? '' : v;
                onStatusChange(mapped as NonNullable<ReportFilters['status']>);
              }}>
                <SelectTrigger id="income-status" aria-label="Estado">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="issued">Emitida</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                  <SelectItem value="paid">Pagada</SelectItem>
                  <SelectItem value="void">Anulada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <Label htmlFor="income-cashier-id">No. de cajero</Label>
              <Input
                id="income-cashier-id"
                type="number"
                inputMode="numeric"
                min="1"
                placeholder="Todos"
                value={cashierId}
                onChange={(e) => onCashierChange(e.target.value)}
              />
            </div>
            <div className="w-[150px]">
              <Label htmlFor="income-cash-session-id">No. de caja</Label>
              <Input
                id="income-cash-session-id"
                type="number"
                inputMode="numeric"
                min="1"
                placeholder="Todas"
                value={cashSessionId}
                onChange={(e) => onCashSessionChange(e.target.value)}
              />
            </div>
            <Button onClick={onSubmit} disabled={loading}>
              {loading ? 'Consultando...' : 'Ver rango'}
            </Button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">Puede consultar hasta 31 dias por busqueda.</p>
        </CardContent>
      </Card>

      {income && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <KPICard
              title="Facturado"
              value={moneyLabel(income.total_billed)}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <KPICard
              title="Cobrado"
              value={moneyLabel(income.total_collected)}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <KPICard
              title="Pendiente"
              value={moneyLabel(income.total_pending)}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <KPICard
              title="Dias en rango"
              value={daysInRange}
              icon={<Calendar className="h-4 w-4" />}
            />
            <KPICard
              title="Anulado"
              value={moneyLabel(income.total_voided)}
              description={`Parcial: ${moneyLabel(income.total_partial)}; promedio cobrado: L. ${averagePerDay}`}
              icon={<CircleSlash className="h-4 w-4" />}
            />
          </div>

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
                      <TableCell className="text-right">{moneyLabel(amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {categories && categories.categories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Por Categoría</CardTitle>
                {categories.amount_source ? (
                  <p className="text-sm text-muted-foreground">{categories.amount_source}</p>
                ) : null}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="text-right">ISV</TableHead>
                      <TableHead className="text-right">{categoryAmountLabel}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.categories.map((cat) => (
                      <TableRow key={cat.category}>
                        <TableCell className="font-medium">{cat.category}</TableCell>
                        <TableCell className="text-right">{cat.item_count}</TableCell>
                        <TableCell className="text-right">{moneyLabel(cat.subtotal)}</TableCell>
                        <TableCell className="text-right">{moneyLabel(cat.tax_amount)}</TableCell>
                        <TableCell className="text-right">{moneyLabel(cat.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {areas && areas.areas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Por Area</CardTitle>
                {areas.amount_source ? (
                  <p className="text-sm text-muted-foreground">{areas.amount_source}</p>
                ) : null}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Area</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Cantidad</TableHead>
                      <TableHead className="text-right">{areaAmountLabel}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {areas.areas.map((area) => (
                      <TableRow key={`${area.area_id ?? 'none'}-${area.area}`}>
                        <TableCell className="font-medium">{area.area}</TableCell>
                        <TableCell className="text-right">{area.item_count}</TableCell>
                        <TableCell className="text-right">{area.quantity}</TableCell>
                        <TableCell className="text-right">{moneyLabel(area.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

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
                    <Tooltip formatter={(value) => [moneyLabel(value as number), 'Monto']} />
                    <Bar dataKey="amount" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {canExport && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onExport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
              <Button variant="outline" onClick={onExportPdf}>
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function methodLabel(method: string): string {
  return { cash: 'Efectivo', transfer: 'Transferencia', card: 'Tarjeta', other: 'Otro' }[method] ?? method;
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasFromCents(parseCents(value));
}
