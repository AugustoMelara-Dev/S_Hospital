import { useState, type ReactNode } from 'react';
import { CircleCheck, Printer } from 'lucide-react';
import { downloadFile, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import { PAYMENT_METHOD_LABEL, type CashSession, type PaymentMethod } from '@/api/types';
import { Button, Card, Money, toast } from '@/ui';
import { cn } from '@/lib/cn';
import { DifferenceValue } from './ArqueoTab';
import { DENOMINATIONS, denominationSubtotal, type DenominationKey } from './arqueo';
import { operatorName, registerName } from './types';

export async function printSummary(id: number): Promise<void> {
  try {
    await downloadFile(`/cash-sessions/${id}/summary.pdf`, { filename: `cierre-caja-${id}.pdf` });
  } catch (e) {
    toast.error({ title: 'No se pudo generar el resumen.', description: errorMessage(e) });
  }
}

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3 border-b border-junta px-4 py-2 last:border-b-0', strong && 'font-semibold text-ink')}>
      <dt className={strong ? undefined : 'text-ink-2'}>{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col bg-surface">
      <h3 className="flex h-9 items-center border-b border-junta bg-surface-2 px-4 text-[12.5px] font-semibold text-ink-2">{title}</h3>
      {children}
    </div>
  );
}

/** "Resumen de cierre": closed-session figures, count breakdown and print button. */
export function CierreResumen({ session, actions, justClosed }: { session: CashSession; actions?: ReactNode; justClosed?: boolean }) {
  const [printing, setPrinting] = useState(false);
  const bills = session.closing_breakdown?.bills ?? {};
  const methods = session.method_totals;

  async function onPrint() {
    setPrinting(true);
    await printSummary(session.id);
    setPrinting(false);
  }

  return (
    <Card
      flush
      title={
        <span className="flex items-center gap-2">
          {justClosed && <CircleCheck className="size-4 text-ok" aria-hidden="true" />}
          Resumen de cierre
        </span>
      }
      description={`${registerName(session)} · ${operatorName(session)}`}
      actions={
        <>
          {actions}
          <Button variant="primary" leftIcon={<Printer />} loading={printing} onClick={() => void onPrint()}>
            Imprimir resumen
          </Button>
        </>
      }
    >
      <div className="grid gap-px overflow-hidden rounded-b-[var(--radius-md)] bg-junta text-[13.5px] md:grid-cols-3">
        <Block title="Turno">
          <dl className="flex flex-col">
            <Row label="Apertura del turno">
              <span className="num">{formatDateTime(session.opened_at)}</span>
            </Row>
            <Row label="Cierre del turno">
              {session.closed_at ? <span className="num">{formatDateTime(session.closed_at)}</span> : <span className="text-ink-3">—</span>}
            </Row>
            <Row label="Monto de apertura">
              <Money cents={session.opening_cents} />
            </Row>
            <Row label="Cobros registrados">
              <Money cents={session.payments_total_cents} />
            </Row>
            <Row label="Efectivo esperado">
              <Amount cents={session.expected_cash_cents} />
            </Row>
            <Row label="Total contado" strong>
              <Amount cents={session.counted_cents} />
            </Row>
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <dt className="text-ink-2">Diferencia</dt>
              <dd>{session.difference_cents == null ? <span className="text-ink-3">—</span> : <DifferenceValue cents={session.difference_cents} />}</dd>
            </div>
          </dl>
          {session.closing_notes && (
            <p className="border-t border-junta px-4 py-2.5 text-[13px] text-ink-2">
              <span className="font-semibold text-ink">Nota de cierre: </span>
              {session.closing_notes}
            </p>
          )}
        </Block>

        <Block title="Cobros por método">
          {methods ? (
            <dl className="flex flex-col">
              {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
                <Row key={m} label={PAYMENT_METHOD_LABEL[m]}>
                  <Money cents={methods[m] ?? 0} className={(methods[m] ?? 0) === 0 ? 'text-ink-3' : undefined} />
                </Row>
              ))}
            </dl>
          ) : (
            <p className="px-4 py-2.5 text-ink-3">—</p>
          )}
        </Block>

        <Block title="Desglose del conteo">
          {session.closing_breakdown ? (
            <dl className="flex flex-col">
              {DENOMINATIONS.filter((d) => (bills[String(d) as DenominationKey] ?? 0) > 0).map((d) => {
                const n = bills[String(d) as DenominationKey] ?? 0;
                return (
                  <Row key={d} label={`L ${d} × ${n}`}>
                    <Money cents={denominationSubtotal(d, n)} />
                  </Row>
                );
              })}
              <Row label="Monedas y otros">
                <Money cents={session.closing_breakdown.coins_cents} />
              </Row>
            </dl>
          ) : (
            <p className="px-4 py-2.5 text-ink-3">—</p>
          )}
        </Block>
      </div>
    </Card>
  );
}

function Amount({ cents }: { cents: number | null | undefined }) {
  return cents === null || cents === undefined ? <span className="text-ink-3">—</span> : <Money cents={cents} />;
}
