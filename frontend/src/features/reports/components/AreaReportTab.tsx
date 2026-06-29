import { Building2, Download } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { EmptyState } from '../../../components/ui/states';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
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
  const columns: Array<DataTableColumn<AreaReport['areas'][number]>> = [
    { key: 'area', header: 'Area', cellClassName: 'font-medium', render: (area) => area.area },
    { key: 'invoice_count', header: 'Facturas', numeric: true, render: (area) => area.invoice_count },
    { key: 'item_count', header: 'Items', numeric: true, render: (area) => area.item_count },
    { key: 'subtotal', header: 'Subtotal', numeric: true, render: (area) => `L. ${area.subtotal}` },
    { key: 'tax_amount', header: 'ISV', numeric: true, render: (area) => `L. ${area.tax_amount}` },
    { key: 'total', header: 'Facturado', numeric: true, render: (area) => `L. ${area.total}` },
    { key: 'collected', header: 'Cobrado', numeric: true, render: (area) => `L. ${area.collected}` },
    { key: 'balance_due', header: 'Saldo', numeric: true, render: (area) => `L. ${area.balance_due}` },
  ];
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
          <DataTable
            containerLabel="Totales por area"
            rows={areas}
            columns={columns}
            getRowKey={(area) => `${area.area_id ?? 'none'}-${area.area}`}
          />
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
