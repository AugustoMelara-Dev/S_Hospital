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
    <Card className="hover:shadow-md transition-all duration-200 border-slate-200/60 dark:border-slate-800/60">
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
