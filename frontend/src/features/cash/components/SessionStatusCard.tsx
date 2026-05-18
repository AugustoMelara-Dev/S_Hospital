import { Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { CashSession } from '@/lib/api';

interface SessionStatusCardProps {
  session: CashSession | null;
}

export function SessionStatusCard({ session }: SessionStatusCardProps) {
  const isOpen = session?.status === 'open';

  return (
    <Card className={cn(isOpen ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200')}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn('p-3 rounded-full', isOpen ? 'bg-emerald-100' : 'bg-slate-100')}>
              <Wallet className={cn('h-6 w-6', isOpen ? 'text-emerald-600' : 'text-slate-500')} />
            </div>
            <div>
              <h3 className={cn('text-lg font-semibold', isOpen ? 'text-emerald-800' : 'text-foreground')}>
                {isOpen ? 'Caja Abierta' : 'Caja Cerrada'}
              </h3>
              <p className={cn('text-sm', isOpen ? 'text-emerald-600' : 'text-muted-foreground')}>
                {isOpen
                  ? `Sesión #${session.id} - Abierta ${formatLocalDateTime(session.opened_at)}`
                  : 'No hay una caja abierta actualmente'}
              </p>
            </div>
          </div>
          {isOpen ? (
            <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">
              Activa
            </Badge>
          ) : (
            <Badge variant="secondary">Cerrada</Badge>
          )}
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
