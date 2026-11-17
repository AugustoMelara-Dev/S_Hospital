import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Calculator, Lock, TriangleAlert } from 'lucide-react';
import { api, errorMessage, newIdempotencyKey } from '@/lib/api';
import type { CashSession, Reconciliation } from '@/api/types';
import { Button, ConfirmDialog, Field, Money, StatusGlyph, Textarea, toast } from '@/ui';
import { ArqueoSummary } from './ArqueoTab';
import { arqueoReady, arqueoTotal, DIFFERENCE_LABEL, differenceCents, differenceKind, toBreakdown, type ArqueoState } from './arqueo';
import { invalidateCash } from './queries';
import { operatorName, registerName } from './types';

export type CierreTabProps = {
  session: CashSession;
  reconciliation: Reconciliation;
  arqueo: ArqueoState;
  onGoToArqueo: () => void;
  onClosed: (closed: CashSession) => void;
  /** False when the user may view but not close this session. */
  canClose: boolean;
};

export const MIN_NOTE = 5;

export function CierreTab({ session, reconciliation, arqueo, onGoToArqueo, onClosed, canClose }: CierreTabProps) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef<string>(newIdempotencyKey());

  const counted = arqueoTotal(arqueo);
  const ready = arqueoReady(arqueo);
  const expected = reconciliation.expected_cash_cents;
  const diff = differenceCents(counted, expected);
  const kind = differenceKind(diff);
  const blockers = reconciliation.blockers ?? [];
  const noteRequired = ready && diff !== 0;
  const noteError = noteRequired && notes.trim().length < MIN_NOTE ? 'Explique la diferencia (mínimo 5 caracteres).' : null;

  function requestClose() {
    setTouched(true);
    setError(null);
    if (!ready || blockers.length > 0 || noteError) return;
    keyRef.current = newIdempotencyKey(); // one key per confirmation attempt
    setConfirmOpen(true);
  }

  async function confirmClose() {
    setError(null);
    try {
      const closed = await api.post<CashSession>(
        `/cash-sessions/${session.id}/close`,
        {
          counted_cents: counted,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          breakdown: toBreakdown(arqueo),
        },
        { idempotencyKey: keyRef.current },
      );
      setConfirmOpen(false);
      toast.success('Caja cerrada.');
      onClosed({
        ...session,
        ...closed,
        status: 'closed',
        counted_cents: closed?.counted_cents ?? counted,
        expected_cash_cents: closed?.expected_cash_cents ?? expected,
        difference_cents: closed?.difference_cents ?? diff,
      });
      void invalidateCash(qc);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (!ready) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-md)] border border-junta bg-surface px-4 py-3.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-[14px] font-semibold text-ink">Primero haga el arqueo</p>
          <p className="max-w-[75ch] text-[13px] text-ink-2">
            El monto contado se toma del arqueo. Cuente el efectivo de la gaveta, o confirme el conteo en cero si no hay efectivo.
          </p>
        </div>
        <Button leftIcon={<Calculator />} onClick={onGoToArqueo}>
          Ir al arqueo
        </Button>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-4">
        {blockers.length > 0 && (
          <section aria-labelledby="cierre-bloqueos" className="overflow-hidden rounded-[var(--radius-md)] border border-junta bg-surface">
            <header className="flex min-h-11 items-center justify-between gap-3 border-b border-junta bg-warn-soft px-4 py-2.5">
              <h3 id="cierre-bloqueos" className="flex items-center gap-2 text-[14px] font-bold text-warn">
                <TriangleAlert className="size-4" aria-hidden="true" />
                No se puede cerrar todavía
              </h3>
              <span className="num text-[12.5px] font-semibold text-warn">
                {blockers.length} {blockers.length === 1 ? 'bloqueo' : 'bloqueos'}
              </span>
            </header>
            <ul className="flex flex-col">
              {blockers.map((b) => (
                <li
                  key={b.code}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-junta px-4 py-2.5 text-[13.5px] last:border-b-0"
                >
                  <span className="flex min-w-0 items-center gap-2.5 text-ink">
                    <StatusGlyph shape="hollow" className="text-warn" />
                    {b.message}
                    {b.count > 0 && <span className="num text-ink-2">({b.count})</span>}
                  </span>
                  <Link
                    to="/recibos?pending=1"
                    className="inline-flex items-center gap-1 text-[13px] font-semibold text-slate-text underline-offset-2 hover:underline"
                  >
                    Resolver en Recibos
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-junta bg-surface p-4">
          <Field
            label="Nota de cierre"
            required={noteRequired}
            hint={noteRequired ? 'Obligatoria porque hay diferencia entre lo contado y lo esperado.' : 'Opcional cuando la caja cuadra.'}
            error={touched ? noteError : null}
          >
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} maxLength={255} disabled={!canClose} />
          </Field>

          {error && !confirmOpen && (
            <p role="alert" className="rounded-[var(--radius-sm)] border border-danger/30 bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="ghost" leftIcon={<Calculator />} onClick={onGoToArqueo}>
              Revisar arqueo
            </Button>
            {canClose ? (
              <Button variant="primary" size="lg" leftIcon={<Lock />} onClick={requestClose} disabled={blockers.length > 0}>
                Cerrar caja
              </Button>
            ) : (
              <p className="text-[13px] text-ink-3">No tiene permiso para cerrar esta caja.</p>
            )}
          </div>
        </div>
      </div>

      <ArqueoSummary totalCents={counted} expectedCents={expected} />

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Cierre de caja"
        description="Al cerrar, el turno queda inmutable y no podrá registrar más cobros en él."
        confirmLabel="Cerrar caja"
        onConfirm={confirmClose}
        error={error}
      >
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13.5px]">
          <dt className="text-ink-2">Caja</dt>
          <dd className="text-right">{registerName(session)}</dd>
          <dt className="text-ink-2">Operador</dt>
          <dd className="text-right">{operatorName(session)}</dd>
          <dt className="text-ink-2">Efectivo esperado</dt>
          <dd className="text-right">
            <Money cents={expected} />
          </dd>
          <dt className="text-ink-2">Total contado</dt>
          <dd className="text-right">
            <Money cents={counted} />
          </dd>
          <dt className="text-ink-2">Diferencia</dt>
          <dd className="text-right">
            <span className="mr-2 text-ink-2">{DIFFERENCE_LABEL[kind]}</span>
            <Money cents={diff} signed className="font-semibold" />
          </dd>
        </dl>
      </ConfirmDialog>
    </div>
  );
}
