import { useState } from 'react';
import { Clock, User, Wallet } from 'lucide-react';
import { formatDateTime, formatTime } from '@/lib/dates';
import type { Reconciliation } from '@/api/types';
import { Badge, KpiTile, Tabs } from '@/ui';
import { ArqueoTab } from './ArqueoTab';
import { CierreTab } from './CierreTab';
import { EMPTY_ARQUEO, type ArqueoState } from './arqueo';
import { useSessionDetail } from './queries';
import { MovimientosTab, ResumenTab } from './SessionTabs';
import { operatorName, registerName, type CashSessionRow } from './types';

type TabValue = 'resumen' | 'movimientos' | 'arqueo' | 'cierre';

export type SessionViewProps = {
  session: CashSessionRow;
  canClose: boolean;
  onClosed: (closed: CashSessionRow) => void;
  /** Movements already loaded (history detail). */
  movementsPreloaded?: boolean;
};

function fallbackReconciliation(s: CashSessionRow): Reconciliation {
  return {
    opening_cents: s.opening_cents,
    expected_cash_cents: s.expected_cash_cents ?? s.opening_cents,
    method_totals: s.method_totals ?? { cash: 0, transfer: 0, card: 0, other: 0 },
    payments_count: s.payments_count ?? 0,
    payments_total_cents: s.payments_total_cents ?? 0,
    pending_count: 0,
    pending_cents: 0,
    missing_receipts_count: 0,
    can_close: s.status === 'open',
    blockers: [],
  };
}

/** Open session: header, stat band and the Resumen / Movimientos / Arqueo / Cierre tabs. */
export function SessionView({ session, canClose, onClosed, movementsPreloaded }: SessionViewProps) {
  const [tab, setTab] = useState<TabValue>('resumen');
  const [arqueo, setArqueo] = useState<ArqueoState>(EMPTY_ARQUEO);
  const rec = session.reconciliation ?? fallbackReconciliation(session);
  const detail = useSessionDetail(!movementsPreloaded && tab === 'movimientos' ? session.id : null, { poll: true });
  const movements = movementsPreloaded ? session.movements : detail.data?.movements;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-ink-2">
        <span className="flex items-center gap-2 font-semibold text-ink">
          <Wallet className="size-4 text-ink-3" aria-hidden="true" />
          {registerName(session)}
        </span>
        <span className="flex items-center gap-1.5">
          <User className="size-4 text-ink-3" aria-hidden="true" />
          {operatorName(session)}
        </span>
        <span className="flex items-center gap-1.5" title={formatDateTime(session.opened_at)}>
          <Clock className="size-4 text-ink-3" aria-hidden="true" />
          Abierta desde <span className="num text-ink">{formatTime(session.opened_at)}</span>
        </span>
        <Badge tone="ok" dot>
          Turno abierto
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Apertura" cents={rec.opening_cents} />
        <KpiTile
          label="Cobros registrados"
          cents={rec.payments_total_cents}
          tone="brand"
          hint={`${rec.payments_count} ${rec.payments_count === 1 ? 'cobro' : 'cobros'}`}
        />
        <KpiTile label="Efectivo esperado" cents={rec.expected_cash_cents} tone="ok" hint="Apertura + efectivo cobrado" />
        <KpiTile
          label="Saldo pendiente"
          cents={rec.pending_cents}
          tone={rec.pending_count > 0 ? 'warn' : 'neutral'}
          hint={rec.pending_count > 0 ? `${rec.pending_count} sin cobrar` : 'Sin pendientes'}
        />
      </div>

      <Tabs<TabValue>
        label="Secciones de la caja"
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'resumen', label: 'Resumen', content: <ResumenTab reconciliation={rec} /> },
          {
            value: 'movimientos',
            label: 'Movimientos',
            content: <MovimientosTab movements={movements} loading={!movementsPreloaded && detail.isPending} />,
          },
          {
            value: 'arqueo',
            label: 'Arqueo',
            content: (
              <ArqueoTab
                value={arqueo}
                onChange={setArqueo}
                expectedCents={rec.expected_cash_cents}
                onContinue={() => setTab('cierre')}
              />
            ),
          },
          {
            value: 'cierre',
            label: 'Cierre',
            count: rec.blockers.length > 0 ? rec.blockers.length : undefined,
            content: (
              <CierreTab
                session={session}
                reconciliation={rec}
                arqueo={arqueo}
                onGoToArqueo={() => setTab('arqueo')}
                onClosed={onClosed}
                canClose={canClose}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
