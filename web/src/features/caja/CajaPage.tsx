import { useState } from 'react';
import { RefreshCw, Wallet } from 'lucide-react';
import { errorMessage } from '@/lib/api';
import { usePermissions } from '@/auth/hooks';
import { Button, Card, EmptyState, PageHeader, Skeleton } from '@/ui';
import { AperturaPanel } from './AperturaPanel';
import { CierreResumen } from './CierreResumen';
import { Historico } from './Historico';
import { useCurrentSession } from './queries';
import { SessionView } from './SessionView';
import type { CashSession } from '@/api/types';

/** /caja — apertura, turno abierto (resumen, movimientos, arqueo, cierre) e histórico. */
export default function CajaPage() {
  const { can } = usePermissions();
  const current = useCurrentSession();
  const [closed, setClosed] = useState<CashSession | null>(null);

  let body;
  if (closed) {
    body = (
      <CierreResumen
        session={closed}
        justClosed
        actions={
          <Button variant="ghost" onClick={() => setClosed(null)}>
            {can('cash.open') ? 'Abrir nueva caja' : 'Volver'}
          </Button>
        }
      />
    );
  } else if (current.isPending) {
    body = (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-5 w-72" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[86px] rounded-[var(--radius-md)]" />
          ))}
        </div>
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
      <PageHeader title="Caja" description="Apertura, movimientos, arqueo y cierre del turno." />
      <div className="flex flex-col gap-8">
        <section aria-label="Turno actual">{body}</section>
        <Historico />
      </div>
    </>
  );
}
