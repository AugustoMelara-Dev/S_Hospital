import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, TrendingUp } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/data-table';
import { EmptyState } from '../../../components/ui/states';
import { KPICard } from './KPICard';
import type { ServiceSalesReport, CategoryReport } from '../../../lib/api/types';

interface ServiceSalesTabProps {
  dateFrom: string;
  dateTo: string;
  categories: CategoryReport | null;
  serviceSales: ServiceSalesReport | null;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onSubmit: () => void;
}

export function ServiceSalesTab({ dateFrom, dateTo, categories, serviceSales, onDateFromChange, onDateToChange, onSubmit }: ServiceSalesTabProps) {
  function exportCSV() {
    if (!serviceSales) return;
    const rows = [
      ['Servicio', 'Categoría', 'Cantidad', 'Total'],
      ...serviceSales.services.map((s) => [s.service, s.category, s.quantity, s.total]),
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-servicios-${dateFrom}-a-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const chartData = serviceSales
    ? serviceSales.services.slice(0, 10).map((s) => ({
        service: s.service.length > 18 ? `${s.service.slice(0, 18)}...` : s.service,
        total: Number.parseFloat(s.total),
      }))
    : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="flex items-end gap-4">
            <div>
              <Label htmlFor="service-date-from">Desde</Label>
              <Input
                id="service-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="service-date-to">Hasta</Label>
              <Input
                id="service-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
              />
            </div>
            <Button type="submit">Actualizar</Button>
          </form>
        </CardContent>
      </Card>

      {serviceSales && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPICard
              title="Total Servicios"
              value={serviceSales.services.length}
              description="servicios cobrados"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <KPICard
              title="Unidades Totales"
              value={serviceSales.services.reduce((acc, s) => acc + Number.parseInt(s.quantity), 0)}
            />
            <KPICard
              title="Monto Total"
              value={`L. ${serviceSales.services.reduce((acc, s) => acc + Number.parseFloat(s.total), 0).toFixed(2)}`}
            />
          </div>
        </>
      )}

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
                  <TableHead className="text-right">Unidades</TableHead>
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
                    <TableCell className="text-right">{cat.quantity}</TableCell>
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

      {categories && categories.categories.length === 0 && (
        <EmptyState
          title="Sin categorias cobradas"
          description="No hay ingresos agrupados por categoria para el rango y filtros seleccionados."
        />
      )}

      {serviceSales && serviceSales.services.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Servicios Más Vendidos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceSales.services.map((s, i) => (
                    <TableRow key={`${s.service}-${s.category}-${i}`}>
                      <TableCell className="font-medium">{s.service}</TableCell>
                      <TableCell>{s.category}</TableCell>
                      <TableCell className="text-right">{s.quantity}</TableCell>
                      <TableCell className="text-right">L. {s.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Servicios</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="service" tickLine={false} interval={0} height={70} angle={-20} textAnchor="end" />
                    <YAxis tickLine={false} width={64} />
                    <Tooltip formatter={(value) => [`L. ${value}`, 'Total']} />
                    <Bar dataKey="total" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </>
      )}

      {serviceSales && serviceSales.services.length === 0 && (
        <EmptyState
          title="Sin servicios cobrados"
          description="No hay servicios facturados para el rango y filtros seleccionados."
        />
      )}
    </div>
  );
}
