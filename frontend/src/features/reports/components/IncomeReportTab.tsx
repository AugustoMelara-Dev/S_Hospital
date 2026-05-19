import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { DollarSign, TrendingUp, Calendar, Download } from 'lucide-react';
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
import type { Category, CategoryReport, IncomeReport, ReportFilters } from '../../../lib/api/types';

interface IncomeReportTabProps {
  canExport: boolean;
  dateFrom: string;
  dateTo: string;
  categoryId: string;
  cashSessionId: string;
  cashierId: string;
  method: NonNullable<ReportFilters['method']>;
  status: NonNullable<ReportFilters['status']>;
  categoryOptions: Category[];
  loading: boolean;
  income: IncomeReport | null;
  categories: CategoryReport | null;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onCashSessionChange: (value: string) => void;
  onCashierChange: (value: string) => void;
  onMethodChange: (value: NonNullable<ReportFilters['method']>) => void;
  onExport: () => void;
  onStatusChange: (value: NonNullable<ReportFilters['status']>) => void;
  onSubmit: () => void;
}

export function IncomeReportTab({
  canExport,
  dateFrom,
  dateTo,
  categoryId,
  cashSessionId,
  cashierId,
  method,
  status,
  categoryOptions,
  loading,
  income,
  categories,
  onDateFromChange,
  onDateToChange,
  onCategoryChange,
  onCashSessionChange,
  onCashierChange,
  onMethodChange,
  onExport,
  onStatusChange,
  onSubmit,
}: IncomeReportTabProps) {

  const daysInRange = Math.max(1, Math.ceil((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / (1000 * 60 * 60 * 24)) + 1);
  const averagePerDay = income ? (Number.parseFloat(income.total_collected) / daysInRange).toFixed(2) : '0.00';

  const chartData = income
    ? Object.entries(income.payments_by_method).map(([method, amount]) => ({
        method: methodLabel(method),
        amount: Number.parseFloat(amount),
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
              <Label htmlFor="income-cashier-id">Cajero ID</Label>
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
              <Label htmlFor="income-cash-session-id">Caja ID</Label>
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
          <p className="mt-3 text-sm text-muted-foreground">Rango máximo permitido: 31 dias.</p>
        </CardContent>
      </Card>

      {income && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPICard
              title="Total Ingresos"
              value={`L. ${income.total_collected}`}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <KPICard
              title="Días en Rango"
              value={daysInRange}
              icon={<Calendar className="h-4 w-4" />}
            />
            <KPICard
              title="Promedio/Día"
              value={`L. ${averagePerDay}`}
              icon={<TrendingUp className="h-4 w-4" />}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Por Método de Pago</CardTitle>
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
                  {Object.entries(income.payments_by_method).map(([method, amount]) => (
                    <TableRow key={method}>
                      <TableCell className="font-medium">{methodLabel(method)}</TableCell>
                      <TableCell className="text-right">L. {amount}</TableCell>
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
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                      <TableHead className="text-right">ISV</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.categories.map((cat) => (
                      <TableRow key={cat.category}>
                        <TableCell className="font-medium">{cat.category}</TableCell>
                        <TableCell className="text-right">{cat.item_count}</TableCell>
                        <TableCell className="text-right">L. {cat.subtotal}</TableCell>
                        <TableCell className="text-right">L. {cat.tax_amount}</TableCell>
                        <TableCell className="text-right">L. {cat.total}</TableCell>
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
                <CardTitle>Visualización por Método</CardTitle>
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

          {canExport && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={onExport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
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
