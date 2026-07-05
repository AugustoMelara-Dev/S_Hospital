import { formatLempirasUI, formatQuantity } from '@/lib/moneyCents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ExecutiveReport } from '@/lib/api';

type ServiceRankingProps = {
  report: ExecutiveReport;
};

type ServiceAmountRow = ExecutiveReport['services']['top_by_amount'][number];
type ServiceQuantityRow = ExecutiveReport['services']['top_by_quantity'][number];
type CategoryRowData = ExecutiveReport['services']['by_category'][number];
type AreaRowData = ExecutiveReport['services']['by_area'][number];

function ServiceRow({ index, service, showCollected = true }: { index: number; service: ServiceAmountRow | ServiceQuantityRow; showCollected?: boolean }) {
  return (
    <TableRow>
      <TableCell className="w-8 text-center text-muted-foreground">{index + 1}</TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-semibold text-foreground">{service.service}</span>
          <span className="text-xs text-muted-foreground">{service.category}</span>
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums">{service.item_count}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">{formatQuantity(service.quantity)}</TableCell>
      <TableCell className="text-right font-mono tabular-nums font-semibold">
        {formatLempirasUI(service.total)}
      </TableCell>
      {showCollected ? (
        <TableCell className="text-right font-mono tabular-nums text-foreground">
          {formatLempirasUI('collected' in service ? service.collected : '0.00')}
        </TableCell>
      ) : null}
    </TableRow>
  );
}

function CategoryRow({ index, row }: { index: number; row: CategoryRowData }) {
  return (
    <TableRow>
      <TableCell className="w-8 text-center text-muted-foreground">{index + 1}</TableCell>
      <TableCell className="font-semibold text-foreground">{row.category}</TableCell>
      <TableCell className="text-right tabular-nums">{row.item_count}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">{formatQuantity(row.quantity)}</TableCell>
      <TableCell className="text-right font-mono tabular-nums font-semibold">
        {formatLempirasUI(row.total)}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-foreground">
        {formatLempirasUI(row.collected)}
      </TableCell>
    </TableRow>
  );
}

function AreaRow({ index, row }: { index: number; row: AreaRowData }) {
  return (
    <TableRow>
      <TableCell className="w-8 text-center text-muted-foreground">{index + 1}</TableCell>
      <TableCell className="font-semibold text-foreground">{row.area}</TableCell>
      <TableCell className="text-right tabular-nums">{row.item_count}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">{formatQuantity(row.quantity)}</TableCell>
      <TableCell className="text-right font-mono tabular-nums font-semibold">
        {formatLempirasUI(row.total)}
      </TableCell>
    </TableRow>
  );
}

function RankingSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-md border border-operational-border bg-operational-panel/45 p-3" aria-labelledby={sectionId(title)}>
      <div>
        <h3 id={sectionId(title)} className="text-sm font-semibold text-foreground">
          {title}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function sectionId(title: string) {
  return `service-ranking-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-6 text-center text-sm text-muted-foreground">
        Sin datos
      </TableCell>
    </TableRow>
  );
}

export function ServiceRanking({ report }: ServiceRankingProps) {
  const hasData =
    report.services.top_by_amount.length > 0 ||
    report.services.top_by_quantity.length > 0 ||
    report.services.by_category.length > 0 ||
    report.services.by_area.length > 0;

  if (!hasData) {
    return (
      <Card className="rounded-panel border-operational-border bg-operational-surface shadow-operational">
        <CardHeader>
          <CardTitle className="text-base">Servicios facturados</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Sin servicios facturados en el periodo.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-panel border-operational-border bg-operational-surface shadow-operational">
      <CardHeader>
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">Servicios facturados</CardTitle>
          <p className="text-xs text-muted-foreground">
            Servicios que explican ingresos, volumen y concentracion operativa del periodo.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <RankingSection
          title="Top por monto"
          description="Servicios que generaron mas facturacion y cobro."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Cantidad</TableHead>
                <TableHead className="text-right">Facturado</TableHead>
                <TableHead className="text-right">Cobrado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.services.top_by_amount.length === 0 ? (
                <EmptyRow colSpan={6} />
              ) : (
                report.services.top_by_amount.map((service, index) => (
                  <ServiceRow key={`${service.service}-${index}`} index={index} service={service} />
                ))
              )}
            </TableBody>
          </Table>
        </RankingSection>

        <div className="grid gap-4 xl:grid-cols-3">
          <RankingSection
            title="Top por cantidad"
            description="Servicios con mayor volumen de atencion."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Facturado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.services.top_by_quantity.length === 0 ? (
                  <EmptyRow colSpan={5} />
                ) : (
                  report.services.top_by_quantity.map((service, index) => (
                    <ServiceRow key={`${service.service}-qty-${index}`} index={index} service={service} showCollected={false} />
                  ))
                )}
              </TableBody>
            </Table>
          </RankingSection>

          <RankingSection
            title="Por categoria"
            description="Concentracion de facturacion por familia de servicio."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Facturado</TableHead>
                  <TableHead className="text-right">Cobrado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.services.by_category.length === 0 ? (
                  <EmptyRow colSpan={6} />
                ) : (
                  report.services.by_category.map((row, index) => (
                    <CategoryRow key={row.category} index={index} row={row} />
                  ))
                )}
              </TableBody>
            </Table>
          </RankingSection>

          <RankingSection
            title="Por area"
            description="Area operativa con mas movimiento."
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead>Area</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Facturado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.services.by_area.length === 0 ? (
                  <EmptyRow colSpan={5} />
                ) : (
                  report.services.by_area.map((row, index) => (
                    <AreaRow key={`${row.area}-${index}`} index={index} row={row} />
                  ))
                )}
              </TableBody>
            </Table>
          </RankingSection>
        </div>

        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">Lectura</Badge>
          <span>
            Top {report.services.top_by_amount.length} servicios por monto. Las secciones inferiores
            complementan volumen, categoria y area sin ocultar datos en pestanas.
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
