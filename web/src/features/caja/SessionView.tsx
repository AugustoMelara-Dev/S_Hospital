import { useState } from 'react';
import { formatDateTime, formatTime } from '@/lib/dates';
import type { CashSession, Reconciliation } from '@/api/types';
import { Badge, KpiGrid, KpiTile, Tabs, shiftStepsFromSession } from '@/ui';
import { ArqueoTab } from './ArqueoTab';
import { CierreTab } from './CierreTab';
import { arqueoReady, arqueoTotal, DIFFERENCE_LABEL, differenceCents, differenceKind } from './arqueo';
import { clearArqueoDraft, useArqueoDraft } from './arqueoDraft';
import { useSessionDetail } from './queries';
import { MovimientosTab, ResumenTab } from './SessionTabs';
import { Dash, ShiftBand } from './ShiftBand';
import { operatorName, registerName } from './types';
import { formatCents } from '@/lib/money';

type TabValue = 'resumen' | 'movimientos' | 'arqueo' | 'cierre';

export type SessionViewProps = {
  session: CashSession;
  canClose: boolean;
  onClosed: (closed: CashSession) => void;
  /** Movements already loaded (history detail). */
  movementsPreloaded?: boolean;
};

function fallbackReconciliation(s: CashSession): Reconciliation {
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

const DIFF_TONE = { balanced: 'ok', overage: 'warn', shortage: 'danger' } as const;

/** Open session: shift band, figures and the Resumen / Movimientos / Arqueo / Cierre tabs. */
export function SessionView({ session, canClose, onClosed, movementsPreloaded }: SessionViewProps) {
  const [tab, setTab] = useState<TabValue>('resumen');
  // The count lives in a shared per-session store so the top-bar chip and Resumen see it too.
  const [arqueo, setArqueo] = useArqueoDraft(session.id);
  const rec = session.reconciliation ?? fallbackReconciliation(session);
  const detail = useSessionDetail(!movementsPreloaded && tab === 'movimientos' ? session.id : null, { poll: true });
  const movements = (movementsPreloaded ? session.movements : detail.data?.movements) ?? undefined;

  const counted = arqueoTotal(arqueo);
  const ready = arqueoReady(arqueo);
  const kind = differenceKind(differenceCents(counted, rec.expected_cash_cents));
  const steps = shiftStepsFromSession({ ...session, reconciliation: rec }, ready);
  const blockers = rec.blockers.length;

  return (
    <div className="flex flex-col gap-4">
      <ShiftBand
        steps={steps}
        title={registerName(session)}
        subtitle={
          <>
            <span className="block">{operatorName(session)}</span>
            <span className="block" title={formatDateTime(session.opened_at)}>
              Abierta desde <span className="num text-ink">{formatTime(session.opened_at)}</span>
            </span>
          </>
        }
        stages={{
          apertura: { value: formatTime(session.opened_at), note: 'Completado' },
          cobros: {
            value: rec.payments_count,
            note: rec.payments_count > 0 ? (rec.payments_count === 1 ? 'cobro registrado' : 'cobros registrados') : 'Sin cobros aún',
          },
          arqueo: ready
            ? { value: formatCents(counted), note: DIFFERENCE_LABEL[kind], tone: DIFF_TONE[kind] }
            : { value: <Dash />, note: 'Sin conteo' },
          cierre:
            blockers > 0
              ? { value: blockers, note: blockers === 1 ? 'bloqueo pendiente' : 'bloqueos pendientes', tone: 'warn' }
              : { value: <Dash />, note: ready ? 'Listo para cerrar' : 'Pendiente' },
        }}
        aside={
          <Badge tone="ok" shape="filled">
            Turno abierto
          </Badge>
        }
      />

      <KpiGrid columns={4} aria-label="Cifras del turno">
        <KpiTile label="Apertura" cents={rec.opening_cents} hint="Fondo inicial de la gaveta" />
        <KpiTile
          label="Cobros registrados"
          cents={rec.payments_total_cents}
          hint={`${rec.payments_count} ${rec.payments_count === 1 ? 'cobro' : 'cobros'}`}
        />
        <KpiTile label="Efectivo esperado" cents={rec.expected_cash_cents} tone="info" hint="Apertura + efectivo cobrado" />
        <KpiTile
          label="Saldo pendiente"
          cents={rec.pending_cents}
          tone={rec.pending_count > 0 ? 'warn' : 'neutral'}
          hint={rec.pending_count > 0 ? `${rec.pending_count} sin cobrar` : 'Sin pendientes'}
        />
      </KpiGrid>

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
                onClosed={(closed) => {
                  clearArqueoDraft(session.id);
                  onClosed(closed);
                }}
                canClose={canClose}
              />
            ),
          },
        ]}
      />
    </div>
  );
}
