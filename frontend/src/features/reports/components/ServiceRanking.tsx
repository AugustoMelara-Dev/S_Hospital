import { formatLempirasUI, formatQuantity } from '@/lib/moneyCents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

function ServiceRow({ index, service }: { index: number; service: ServiceAmountRow }) {
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
      <TableCell className="text-right font-mono tabular-nums text-foreground">
        {formatLempirasUI(service.collected)}
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
  const topServices = report.services.top_by_amount;

  if (topServices.length === 0) {
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
            Top de servicios que explican facturacion y cobro del periodo.
          </p>
        </div>
      </CardHeader>
      <CardContent>
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
              {topServices.length === 0 ? (
                <EmptyRow colSpan={6} />
              ) : (
                topServices.map((service, index) => (
                  <ServiceRow key={`${service.service}-${index}`} index={index} service={service} />
                ))
              )}
            </TableBody>
          </Table>
        </RankingSection>
      </CardContent>
    </Card>
  );
}
