import { Badge } from '../../components/ui/badge';
import { finiteNumber, formatLempiras } from '../../lib/money';

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
      <div className="flex h-[300px] items-center justify-center rounded-md border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        Sin servicios facturados este mes
      </div>
    );
  }

  const maxTotal = Math.max(...services.map((s) => finiteNumber(s.total) || 1));

  return (
    <div className="flex flex-col gap-4">
      {services.slice(0, 5).map((service, index) => {
        const totalVal = finiteNumber(service.total);
        const pct = Math.min(100, Math.max(0, (totalVal / maxTotal) * 100));

        return (
          <div key={`${service.service_name}-${index}`} className="group flex flex-col gap-1">
            <div className="flex items-start justify-between gap-3 text-sm">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="font-semibold text-foreground truncate" title={service.service_name}>
                  {service.service_name}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                    {service.category_name}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {finiteNumber(service.quantity).toFixed(0)} unds
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="font-bold text-foreground">
                  {formatLempiras(service.total)}
                </span>
              </div>
            </div>
            
            {/* Custom Premium progress bar */}
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary/80 transition-all duration-500 group-hover:bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
