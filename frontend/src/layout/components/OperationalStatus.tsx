import { Clock3, ServerCog, WalletCards, Wifi, WifiOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { type CashSession } from '../../lib/api';

type OperationalStatusProps = {
  cashSession: CashSession | null;
  isOnline: boolean;
  lastCheck: Date | null;
  localTime: string;
  now: Date;
  status: string;
};

export function OperationalStatus({
  cashSession,
  isOnline,
  lastCheck,
  localTime,
  now,
  status,
}: OperationalStatusProps) {
  const cashLabel = cashSession?.status === 'open' ? `Caja #${cashSession.id}` : 'Sin caja abierta';
  const lanStatusTitle = isOnline
    ? `Red local disponible${lastCheck ? `. Ultima revision: ${lastCheck.toLocaleTimeString()}` : ''}`
    : `Sin conexion al servidor local. Estado: ${status}`;

  return (
    <div className="flex shrink-0 items-center gap-1.5" aria-label="Indicadores operativos">
      <div
        className={cn(
          'flex size-9 items-center justify-center rounded-md border text-xs font-semibold sm:w-auto sm:px-2.5 sm:py-1.5',
          isOnline
            ? 'border-secondary/40 bg-secondary/10 text-foreground'
            : 'border-destructive/40 bg-destructive/10 text-destructive',
        )}
        title={lanStatusTitle}
        aria-label={lanStatusTitle}
      >
        {isOnline ? <Wifi data-icon aria-hidden="true" /> : <WifiOff data-icon aria-hidden="true" />}
        <span className="sr-only sm:not-sr-only sm:ml-1.5">{isOnline ? 'Red local' : 'Sin red'}</span>
      </div>

      <div
        className="hidden items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs font-semibold text-foreground md:flex"
        title={cashLabel}
      >
        <WalletCards data-icon aria-hidden="true" />
        <span>{cashLabel}</span>
      </div>

      <div
        className="hidden items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 font-mono text-xs font-semibold tabular-nums text-muted-foreground xl:flex"
        title="Fecha y hora local del equipo"
      >
        <Clock3 data-icon aria-hidden="true" />
        <time dateTime={now.toISOString()}>{localTime}</time>
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
