import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import type { CashSession } from '@/lib/api';

type CashSessionHeaderProps = {
  isLoading: boolean;
  onRefresh: () => void;
  session: CashSession | null;
};

export function CashSessionHeader({ isLoading, onRefresh, session }: CashSessionHeaderProps) {
  const isOpen = session?.status === 'open';

  return (
    <PageHeader
      title="Caja"
      description="Operación de caja, conciliación de efectivo y movimientos de la sesión actual."
      secondary={(
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
            {isLoading
              ? 'Actualizando estado de caja.'
              : isOpen
                ? `Caja abierta desde ${formatLocalDateTime(session.opened_at)}`
                : 'Caja cerrada; sin sesión activa.'}
          </p>
          <StatusBadge status={isOpen ? 'open' : 'closed'}>
            {isOpen ? 'Caja abierta' : 'Caja cerrada'}
          </StatusBadge>
        </div>
      )}
      actions={(
        <Button type="button" variant="secondary" size="sm" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw data-icon aria-hidden="true" className={isLoading ? 'animate-spin' : undefined} />
          Actualizar
        </Button>
      )}
    />
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
