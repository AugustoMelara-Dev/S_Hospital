import { RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import type { CashSession } from '@/lib/api';

type CashSessionHeaderProps = {
  canCloseAnyCash: boolean;
  canCreateInvoices: boolean;
  isOwnSession: boolean;
  isLoading: boolean;
  onRefresh: () => void;
  session: CashSession | null;
};

export function CashSessionHeader({
  canCloseAnyCash,
  canCreateInvoices,
  isOwnSession,
  isLoading,
  onRefresh,
  session,
}: CashSessionHeaderProps) {
  const isOpen = session?.status === 'open';
  const cashier = session
    ? session.user?.name ?? session.user?.username ?? `Cajero #${session.user_id}`
    : null;

  return (
    <PageHeader
      title="Caja"
      description="Conciliación del turno, movimientos auditados y cierre de efectivo."
      secondary={(
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <StatusBadge status={isOpen ? 'open' : 'closed'}>
            {isOpen ? 'Caja abierta' : 'Caja cerrada'}
          </StatusBadge>
          <p className="text-muted-foreground" role="status" aria-live="polite">
            {isLoading
              ? 'Actualizando estado de caja.'
              : isOpen && session
                ? `Abierta ${formatLocalDateTime(session.opened_at)}`
                : 'No hay una caja abierta actualmente.'}
          </p>
          {isOpen && cashier ? (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{cashier}</span>
              {' · '}
              {isOwnSession
                ? 'Caja propia'
                : canCloseAnyCash
                  ? 'Supervisión habilitada'
                  : 'Sesión de otro cajero'}
            </p>
          ) : null}
        </div>
      )}
      actions={(
        <>
          {isOpen && isOwnSession && canCreateInvoices ? (
            <Button asChild size="sm">
              <Link to="/billing/new">Nueva factura</Link>
            </Button>
          ) : null}
          <Button type="button" variant="secondary" size="sm" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw data-icon aria-hidden="true" className={isLoading ? 'animate-spin' : undefined} />
            Actualizar
          </Button>
        </>
      )}
    />
  );
}

function formatLocalDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'en hora no disponible';

  return new Intl.DateTimeFormat('es-HN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
