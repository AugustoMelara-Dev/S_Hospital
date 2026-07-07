import { ServerCog, WalletCards, Wifi, WifiOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { type CashSession } from '../../lib/api';

type OperationalStatusProps = {
  cashSession: CashSession | null;
  isOnline: boolean;
  lastCheck: Date | null;
  status: string;
};

export function OperationalStatus({
  cashSession,
  isOnline,
  lastCheck,
  status,
}: OperationalStatusProps) {
  const cashIsOpen = cashSession?.status === 'open';
  const cashLabel = cashSession?.status === 'open' ? `Caja #${cashSession.id}` : 'Sin caja abierta';
  const localConnectionStatusTitle = isOnline
    ? `Conexion local disponible${lastCheck ? `. Ultima revision: ${lastCheck.toLocaleTimeString()}` : ''}`
    : `Sin conexion al servidor local. Estado: ${status}`;

  return (
    <div
      data-slot="topbar-operational-status"
      className="flex shrink-0 items-center gap-1.5 rounded-panel border border-operational-border bg-operational-panel/80 p-1 shadow-sm"
      aria-label="Indicadores operativos"
    >
      <div
        className={cn(
          'flex size-9 items-center justify-center rounded-md border text-xs font-semibold sm:w-auto sm:px-2.5 sm:py-1.5',
          isOnline
            ? 'border-success/45 bg-success/10 text-foreground'
            : 'border-destructive/40 bg-destructive/10 text-destructive',
        )}
        title={localConnectionStatusTitle}
        aria-label={localConnectionStatusTitle}
      >
        {isOnline ? <Wifi data-icon aria-hidden="true" /> : <WifiOff data-icon aria-hidden="true" />}
        <span className="sr-only sm:not-sr-only sm:ml-1.5">{isOnline ? 'Conexion local activa' : 'Sin conexion'}</span>
      </div>

      <div
        className={cn(
          'hidden items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold text-foreground md:flex',
          cashIsOpen ? 'border-secondary/45 bg-secondary/10' : 'border-warning/45 bg-warning/10',
        )}
        title={cashLabel}
      >
        <WalletCards data-icon aria-hidden="true" />
        <span>{cashLabel}</span>
      </div>

      {!isOnline && (
        <div className="hidden items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive lg:flex">
          <ServerCog data-icon aria-hidden="true" />
          <span>Revisar servidor</span>
        </div>
      )}
    </div>
  );
}
