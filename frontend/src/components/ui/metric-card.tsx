import { type ReactNode } from 'react';
import { Card, CardContent } from './card';
import { Badge } from './badge';

interface MetricCardProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  helper: string;
  variant?: 'neutral' | 'success' | 'warning' | 'info';
}

export function MetricCard({
  icon,
  helper,
  label,
  value,
  variant = 'neutral',
}: MetricCardProps) {
  const badgeText = {
    neutral: 'Listo',
    success: 'Abierta',
    warning: 'Atención',
    info: 'Activo',
  }[variant];

  return (
    <Card className="border-border/80 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
          </div>
          <Badge variant={variant === 'warning' ? 'warning' : variant === 'success' ? 'success' : 'secondary'}>
            {badgeText}
          </Badge>
        </div>
        <div className="mt-4 flex flex-col gap-0.5">
          <strong className="text-lg sm:text-xl font-bold tracking-tight text-foreground">{value}</strong>
          <span className="text-xs text-muted-foreground">{helper}</span>
        </div>
      </CardContent>
    </Card>
  );
}
