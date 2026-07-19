import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type InstitutionalColumn } from '@/design-system/patterns/DataTable';
import { formatLempirasUI, formatQuantity } from '@/lib/moneyCents';
import type { ExecutiveReport } from '@/lib/api';

type Props = { report: ExecutiveReport };
type Item = ExecutiveReport['services']['top_by_amount'][number];
const columns: Array<InstitutionalColumn<Item>> = [
  { accessorKey: 'service', header: 'Servicio' },
  { accessorKey: 'category', header: 'Categoría' },
  { accessorKey: 'item_count', header: 'Items', meta: { numeric: true } },
  { accessorKey: 'quantity', header: 'Cantidad', meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums">{formatQuantity(row.original.quantity)}</span> },
  { accessorKey: 'total', header: 'Facturado', meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums">{formatLempirasUI(row.original.total)}</span> },
  { accessorKey: 'collected', header: 'Cobrado', meta: { numeric: true }, cell: ({ row }) => <span className="tabular-nums">{formatLempirasUI(row.original.collected)}</span> },
];

export function ServiceRanking({ report }: Props) {
  const rows = report.services.top_by_amount;
  return (
    <section aria-labelledby="ranking-title">
      <Card>
        <CardHeader>
          <CardTitle><h3 id="ranking-title">Servicios facturados</h3></CardTitle>
          <CardDescription>Top de servicios que explican facturación y cobro del período.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable ariaLabel="Top de servicios por monto" data={rows} columns={columns} getRowId={(item) => `${item.service}-${item.category}`} emptyTitle="Sin servicios facturados en el período" emptyDescription="No se encontraron servicios para el rango seleccionado." />
        </CardContent>
      </Card>
    </section>
  );
}
