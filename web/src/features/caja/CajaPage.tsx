import { useState } from 'react';
import { RefreshCw, Wallet } from 'lucide-react';
import { errorMessage } from '@/lib/api';
import { formatTime } from '@/lib/dates';
import { formatCents } from '@/lib/money';
import { usePermissions } from '@/auth/hooks';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '@/ui';
import { AperturaPanel } from './AperturaPanel';
import { DIFFERENCE_LABEL, differenceKind } from './arqueo';
import { CierreResumen } from './CierreResumen';
import { Historico } from './Historico';
import { useCurrentSession } from './queries';
import { SessionView } from './SessionView';
import { Dash, ShiftBand } from './ShiftBand';
import { operatorName, registerName } from './types';
import type { CashSession } from '@/api/types';

const DIFF_TONE = { balanced: 'ok', overage: 'warn', shortage: 'danger' } as const;
const ALL_DONE = { apertura: true, cobros: true, arqueo: true, cierre: true };

/** The four quarters filled: the shift that just closed. */
function ClosedBand({ session }: { session: CashSession }) {
  const diff = session.difference_cents;
  const kind = diff === null || diff === undefined ? null : differenceKind(diff);
  const count = session.payments_count ?? 0;
  return (
    <ShiftBand
      steps={{ ...ALL_DONE, cobros: count > 0 }}
      title={registerName(session)}
      subtitle={operatorName(session)}
      stages={{
        apertura: { value: formatTime(session.opened_at), note: 'Completado' },
        cobros: { value: count, note: count === 1 ? 'cobro registrado' : 'cobros registrados' },
        arqueo:
          session.counted_cents === null || kind === null
            ? { value: <Dash />, note: 'Sin conteo' }
            : { value: formatCents(session.counted_cents), note: DIFFERENCE_LABEL[kind], tone: DIFF_TONE[kind] },
        cierre: { value: session.closed_at ? formatTime(session.closed_at) : <Dash />, note: 'Turno cerrado' },
      }}
      aside={<Badge shape="struck">Caja cerrada</Badge>}
    />
  );
}

/** /caja — apertura, turno abierto (resumen, movimientos, arqueo, cierre) e histórico. */
export default function CajaPage() {
  const { can } = usePermissions();
  const current = useCurrentSession();
  const [closed, setClosed] = useState<CashSession | null>(null);

  let body;
  if (closed) {
    body = (
      <div className="flex flex-col gap-4">
        <ClosedBand session={closed} />
        <CierreResumen
          session={closed}
          justClosed
          actions={
            <Button variant="ghost" onClick={() => setClosed(null)}>
              {can('cash.open') ? 'Abrir nueva caja' : 'Volver'}
            </Button>
          }
        />
      </div>
    );
  } else if (current.isPending) {
    body = (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-[90px] rounded-[var(--radius-md)]" />
        <Skeleton className="h-[86px] rounded-[var(--radius-md)]" />
      </div>
    );
  } else if (current.isError) {
    body = (
      <Card>
        <EmptyState
          icon={<Wallet />}
          title="No se pudo consultar el estado de caja"
          description={errorMessage(current.error)}
          action={
            <Button leftIcon={<RefreshCw />} onClick={() => void current.refetch()}>
              Reintentar
            </Button>
          }
        />
      </Card>
    );
  } else if (current.data && current.data.status === 'open') {
    const s = current.data;
    body = <SessionView key={s.id} session={s} canClose={can(['cash.close', 'cash.close_any'])} onClosed={setClosed} />;
  } else {
    body = <AperturaPanel />;
  }

  return (
    <>
      <PageHeader title="Caja" />
      <div className="flex flex-col gap-6">
        <section aria-label="Turno actual">{body}</section>
        <Historico />
      </div>
    </>
  );
}
