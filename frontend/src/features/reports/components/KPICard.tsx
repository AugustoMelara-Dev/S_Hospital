import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function KPICard({ title, value, description, icon, className }: KPICardProps) {
  return (
    <Card className={cn('rounded-panel border-operational-border bg-operational-surface shadow-operational', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</CardTitle>
        {icon && <div className="text-hospital-primary [&_svg]:size-4">{icon}</div>}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums text-foreground" translate="no">{value}</div>
        {description && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
