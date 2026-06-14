import { Wallet } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';
import type { CashSession } from '@/lib/api';

interface SessionStatusCardProps {
  session: CashSession | null;
}

export function SessionStatusCard({ session }: SessionStatusCardProps) {
  const isOpen = session?.status === 'open';

  return (
    <Card className={cn(isOpen ? 'border-success/30 bg-success/10' : 'border-border')}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className={cn('rounded-full p-3', isOpen ? 'bg-success/15 text-success-foreground' : 'bg-muted text-muted-foreground')}>
              <Wallet className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-foreground">
                {isOpen ? 'Caja abierta' : 'Caja cerrada'}
              </h3>
              <p className="truncate text-sm text-muted-foreground">
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
