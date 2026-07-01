import { formatLempirasUI } from '@/lib/moneyCents';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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

function ServiceRow({ index, service }: { index: number; service: ExecutiveReport['services']['top_by_amount'][number] }) {
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
      <TableCell className="text-right font-mono tabular-nums">{formatLempirasUI(service.quantity)}</TableCell>
      <TableCell className="text-right font-mono tabular-nums font-semibold">
        {formatLempirasUI(service.total)}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-foreground">
        {formatLempirasUI(service.collected)}
      </TableCell>
    </TableRow>
  );
}

function CategoryRow({ index, row }: { index: number; row: ExecutiveReport['services']['by_category'][number] }) {
  return (
    <TableRow>
      <TableCell className="w-8 text-center text-muted-foreground">{index + 1}</TableCell>
      <TableCell className="font-semibold text-foreground">{row.category}</TableCell>
      <TableCell className="text-right tabular-nums">{row.item_count}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">{formatLempirasUI(row.quantity)}</TableCell>
      <TableCell className="text-right font-mono tabular-nums font-semibold">
        {formatLempirasUI(row.total)}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-foreground">
        {formatLempirasUI(row.collected)}
      </TableCell>
    </TableRow>
  );
}

function AreaRow({ index, row }: { index: number; row: ExecutiveReport['services']['by_area'][number] }) {
  return (
    <TableRow>
      <TableCell className="w-8 text-center text-muted-foreground">{index + 1}</TableCell>
      <TableCell className="font-semibold text-foreground">{row.area}</TableCell>
      <TableCell className="text-right tabular-nums">{row.item_count}</TableCell>
      <TableCell className="text-right font-mono tabular-nums">{formatLempirasUI(row.quantity)}</TableCell>
      <TableCell className="text-right font-mono tabular-nums font-semibold">
        {formatLempirasUI(row.total)}
      </TableCell>
    </TableRow>
  );
}

export function ServiceRanking({ report }: ServiceRankingProps) {
  const hasData =
    report.services.top_by_amount.length > 0 ||
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
            Top servicios por monto, cantidad, categoria y area. Responde: que servicios generan mas ingresos.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="amount">
          <div className="overflow-x-auto pb-2">
          <TabsList className="min-w-max">
            <TabsTrigger value="amount">Por monto</TabsTrigger>
            <TabsTrigger value="quantity">Por cantidad</TabsTrigger>
            <TabsTrigger value="category">Por categoria</TabsTrigger>
            <TabsTrigger value="area">Por area</TabsTrigger>
          </TabsList>
          </div>
          <TabsContent value="amount">
            <div className="overflow-x-auto">
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
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      Sin datos
                    </TableCell>
                  </TableRow>
                ) : (
                  report.services.top_by_amount.map((service, index) => (
                    <ServiceRow key={`${service.service}-${index}`} index={index} service={service} />
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </TabsContent>
          <TabsContent value="quantity">
            <div className="overflow-x-auto">
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
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      Sin datos
                    </TableCell>
                  </TableRow>
                ) : (
                  report.services.top_by_quantity.map((service, index) => (
                    <TableRow key={`${service.service}-qty-${index}`}>
                      <TableCell className="w-8 text-center text-muted-foreground">{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">{service.service}</span>
                          <span className="text-xs text-muted-foreground">{service.category}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{service.item_count}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {formatLempirasUI(service.quantity)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-semibold">
                        {formatLempirasUI(service.total)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </TabsContent>
          <TabsContent value="category">
            <div className="overflow-x-auto">
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
                  <TableRow>
                    <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                      Sin datos
                    </TableCell>
                  </TableRow>
                ) : (
                  report.services.by_category.map((row, index) => (
                    <CategoryRow key={row.category} index={index} row={row} />
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </TabsContent>
          <TabsContent value="area">
            <div className="overflow-x-auto">
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
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      Sin datos
                    </TableCell>
                  </TableRow>
                ) : (
                  report.services.by_area.map((row, index) => (
                    <AreaRow key={`${row.area}-${index}`} index={index} row={row} />
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </TabsContent>
        </Tabs>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">Lectura</Badge>
          <span>
            Top {report.services.top_by_amount.length} servicios sobre el total facturado. Categorias
            y areas muestran cobertura por linea operativa.
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
