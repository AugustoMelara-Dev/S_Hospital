import { LockKeyhole, Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import type { CashSession } from '@/lib/api';

interface SessionStatusCardProps {
  session: CashSession | null;
}

export function SessionStatusCard({ session }: SessionStatusCardProps) {
  const isOpen = session?.status === 'open';
  const Icon = isOpen ? Wallet : LockKeyhole;

  return (
    <Card className={cn(
      'overflow-hidden border-l-4',
      isOpen
        ? 'border-l-success bg-success/10 ring-1 ring-success/15'
        : 'border-l-warning bg-warning/10 ring-1 ring-warning/10',
    )}>
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className={cn(
              'flex size-12 shrink-0 items-center justify-center rounded bg-card shadow-sm ring-1',
              isOpen ? 'text-success-foreground ring-success/25' : 'text-warning-foreground ring-warning/25',
            )}>
              <Icon className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold leading-tight text-foreground">
                {isOpen ? 'Caja abierta' : 'Caja cerrada'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {isOpen
                  ? `Sesión #${session.id} - Abierta ${formatLocalDateTime(session.opened_at)}`
                  : 'No hay una caja abierta actualmente'}
              </p>
            </div>
          </div>
          <StatusBadge status={isOpen ? 'open' : 'closed'}>
            {isOpen ? 'Activa' : 'Cerrada'}
          </StatusBadge>
        </div>
      </CardContent>
    </Card>
  );
}

function formatLocalDateTime(value: string): string {
  return new Intl.DateTimeFormat('es-HN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}
