import { Building2, Download } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { EmptyState } from '../../../components/ui/states';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/data-table';
import { KPICard } from './KPICard';
import type { AreaReport } from '../../../lib/api/types';

type AreaReportTabProps = {
  areaReport: AreaReport | null;
  canExport: boolean;
  onExport: () => void;
  onExportPdf: () => void;
};

export function AreaReportTab({ areaReport, canExport, onExport, onExportPdf }: AreaReportTabProps) {
  const areas = areaReport?.areas ?? [];
  const total = areas.reduce((sum, area) => sum + Number.parseFloat(area.total), 0);
  const collected = areas.reduce((sum, area) => sum + Number.parseFloat(area.collected), 0);
  const balance = areas.reduce((sum, area) => sum + Number.parseFloat(area.balance_due), 0);

  if (!areaReport) {
    return (
      <EmptyState
        title="Sin reporte por areas"
        description="Consulte un rango para ver los ingresos agrupados por area."
      />
    );
  }

  if (areas.length === 0) {
    return (
      <EmptyState
        title="Sin ingresos por area"
        description="No hay servicios facturados por area para el rango y filtros seleccionados."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KPICard title="Facturado por areas" value={`L. ${total.toFixed(2)}`} icon={<Building2 className="h-4 w-4" />} />
        <KPICard title="Cobrado" value={`L. ${collected.toFixed(2)}`} />
        <KPICard title="Saldo" value={`L. ${balance.toFixed(2)}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Totales por area</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                <TableHead className="text-right">Facturas</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">ISV</TableHead>
                <TableHead className="text-right">Facturado</TableHead>
                <TableHead className="text-right">Cobrado</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areas.map((area) => (
                <TableRow key={`${area.area_id ?? 'none'}-${area.area}`}>
                  <TableCell className="font-medium">{area.area}</TableCell>
                  <TableCell className="text-right">{area.invoice_count}</TableCell>
                  <TableCell className="text-right">{area.item_count}</TableCell>
                  <TableCell className="text-right">L. {area.subtotal}</TableCell>
                  <TableCell className="text-right">L. {area.tax_amount}</TableCell>
                  <TableCell className="text-right">L. {area.total}</TableCell>
                  <TableCell className="text-right">L. {area.collected}</TableCell>
                  <TableCell className="text-right">L. {area.balance_due}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canExport ? (
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
      ) : (
        <p className="text-right text-sm text-muted-foreground">
          Exportacion requiere permiso de exportacion de reportes.
        </p>
      )}
    </div>
  );
}
