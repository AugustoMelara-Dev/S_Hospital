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
import { formatCents, formatLempirasFromCents, formatQuantity, parseCents, parseQuantityUnits } from '../../../lib/moneyCents';

interface ServiceSalesTabProps {
  canExport: boolean;
  dateFrom: string;
  dateTo: string;
  categories: CategoryReport | null;
  serviceSales: ServiceSalesReport | null;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onExport: () => void;
  onExportPdf: () => void;
  onSubmit: () => void;
}

export function ServiceSalesTab({ canExport, dateFrom, dateTo, categories, serviceSales, onDateFromChange, onDateToChange,
  onExport, onExportPdf, onSubmit }: ServiceSalesTabProps) {

  const totalQuantity = serviceSales?.services.reduce((acc, service) => acc + (parseQuantityUnits(service.quantity) ?? 0), 0) ?? 0;
  const totalBilledCents = serviceSales?.services.reduce((acc, service) => acc + (parseCents(service.total) ?? 0), 0) ?? 0;
  const serviceAmountLabel = serviceSales?.amount_label ?? 'Monto Facturado';
  const categoryAmountLabel = categories?.amount_label ?? 'Monto Facturado';
  const chartData = serviceSales
    ? serviceSales.services.slice(0, 10).map((s) => ({
        service: s.service.length > 18 ? `${s.service.slice(0, 18)}...` : s.service,
        total: (parseCents(s.total) ?? 0) / 100,
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
              description="servicios facturados"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <KPICard
              title="Unidades Totales"
              value={formatQuantity(totalQuantity)}
            />
            <KPICard
              title={serviceAmountLabel}
              value={`L. ${formatCents(totalBilledCents)}`}
            />
          </div>
        </>
      )}

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
                  <TableHead className="text-right">Unidades</TableHead>
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
                    <TableCell className="text-right">{quantityLabel(cat.quantity)}</TableCell>
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

      {categories && categories.categories.length === 0 && (
        <EmptyState
          title="Sin categorias facturadas"
          description="No hay facturacion agrupada por categoria para el rango y filtros seleccionados."
        />
      )}

      {serviceSales && serviceSales.services.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{serviceSales.amount_basis === 'collected_prorated' ? 'Servicios con cobro asignado' : 'Servicios Más Facturados'}</CardTitle>
              {serviceSales.amount_source ? (
                <p className="text-sm text-muted-foreground">{serviceSales.amount_source}</p>
              ) : null}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Servicio</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">{serviceAmountLabel}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {serviceSales.services.map((s, i) => (
                    <TableRow key={`${s.service}-${s.category}-${i}`}>
                      <TableCell className="font-medium">{s.service}</TableCell>
                      <TableCell>{s.category}</TableCell>
                      <TableCell className="text-right">{quantityLabel(s.quantity)}</TableCell>
                      <TableCell className="text-right">{moneyLabel(s.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {chartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Servicios por {serviceAmountLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="service" tickLine={false} interval={0} height={70} angle={-20} textAnchor="end" />
                    <YAxis tickLine={false} width={64} />
                    <Tooltip formatter={(value) => [moneyLabel(value as number), serviceAmountLabel]} />
                    <Bar dataKey="total" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {canExport ? (
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onExport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
              <Button type="button" variant="outline" onClick={onExportPdf}>
                <Download className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          ) : (
            <p className="text-right text-sm text-muted-foreground">
              Exportación requiere permiso de exportación de reportes.
            </p>
          )}
        </>
      )}

      {serviceSales && serviceSales.services.length === 0 && (
        <EmptyState
          title="Sin servicios facturados"
          description="No hay servicios facturados para el rango y filtros seleccionados."
        />
      )}
    </div>
  );
}

function moneyLabel(value: string | number | null | undefined): string {
  return formatLempirasFromCents(parseCents(value));
}

function quantityLabel(value: string | number | null | undefined): string {
  return formatQuantity(parseQuantityUnits(value) ?? 0);
}
