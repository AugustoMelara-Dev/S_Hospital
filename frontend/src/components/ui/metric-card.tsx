import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { Badge } from './badge';
import { Card, CardContent } from './card';
import { cn } from '../../lib/utils';

interface MetricCardProps {
  className?: string;
  helper: ReactNode;
  icon: ReactNode;
  label: ReactNode;
  trend?: {
    label: ReactNode;
    tone?: 'neutral' | 'positive' | 'negative';
  };
  value: ReactNode;
  variant?: 'neutral' | 'success' | 'warning' | 'info';
}

export function MetricCard({
  className,
  icon,
  helper,
  label,
  trend,
  value,
  variant = 'neutral',
}: MetricCardProps) {
  const badgeText = {
    neutral: 'Listo',
    success: 'Abierta',
    warning: 'Atencion',
    info: 'Activo',
  }[variant];
  const TrendIcon = getTrendIcon(trend?.tone);

  return (
    <Card data-slot="metric-card" className={cn('border-border/80 transition-[border-color,box-shadow] duration-200 hover:shadow-md', className)}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="text-secondary [&_svg]:size-4">
              {icon}
            </span>
            <span className="truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground sm:text-xs">{label}</span>
          </div>
          <Badge variant={variant === 'warning' ? 'warning' : variant === 'success' ? 'success' : variant === 'info' ? 'info' : 'secondary'}>
            {badgeText}
          </Badge>
        </div>
        <div className="mt-4 flex flex-col gap-1">
          <strong className="text-lg font-bold tracking-tight text-foreground tabular-nums sm:text-xl">{value}</strong>
          <span className="text-xs text-muted-foreground">{helper}</span>
          {trend ? (
            <span data-slot="metric-card-trend" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <TrendIcon data-icon aria-hidden="true" className={cn('size-3.5', trend.tone === 'positive' && 'text-success-foreground', trend.tone === 'negative' && 'text-destructive')} />
              {trend.label}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function getTrendIcon(tone?: 'neutral' | 'positive' | 'negative'): LucideIcon {
  if (tone === 'positive') return ArrowUpRight;
  if (tone === 'negative') return ArrowDownRight;
  return ArrowRight;
}
