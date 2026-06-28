import { Badge } from '../../components/ui/badge';
import { finiteNumber, formatLempirasUI } from '../../lib/money';

type TopServiceData = {
  service_name: string;
  category_name: string;
  quantity: string;
  total: string;
};

type TopServicesChartProps = {
  services: TopServiceData[];
};

export function TopServicesChart({ services }: TopServicesChartProps) {
  if (services.length === 0) {
    return (
      <div className="flex h-[300px] flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/20 px-6 text-center text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">Sin servicios facturados este mes</span>
        <span>Cuando existan facturas pagadas, aqui se mostraran los servicios con mayor movimiento.</span>
      </div>
    );
  }

  const visibleServices = services.slice(0, 5);
  const maxTotal = Math.max(...visibleServices.map((s) => finiteNumber(s.total) || 1));

  return (
    <div className="flex flex-col gap-4">
      <ol className="sr-only">
        {visibleServices.map((service) => (
          <li key={`${service.service_name}-${service.category_name}`}>
            {service.service_name}, {service.category_name}, {finiteNumber(service.quantity).toFixed(0)} unidades,
            {formatLempirasUI(service.total)}
          </li>
        ))}
      </ol>

      {visibleServices.map((service, index) => {
        const totalVal = finiteNumber(service.total);
        const pct = Math.min(100, Math.max(0, (totalVal / maxTotal) * 100));

        return (
          <div key={`${service.service_name}-${index}`} className="group flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3 text-sm">
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-hospital-primary/10 text-xs font-bold text-hospital-primary">
                    {index + 1}
                  </span>
                  <span className="truncate font-semibold text-foreground" title={service.service_name}>
                    {service.service_name}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pl-8">
                  <Badge variant="outline" className="h-5 px-2 py-0 text-[10px]">
                    {service.category_name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {finiteNumber(service.quantity).toFixed(0)} unds
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="font-bold text-foreground">{formatLempirasUI(service.total)}</span>
              </div>
            </div>

            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-hospital-primary transition-[width,background-color] duration-500 group-hover:bg-chart-2"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
