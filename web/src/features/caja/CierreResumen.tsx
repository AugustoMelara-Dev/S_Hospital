import { useState, type ReactNode } from 'react';
import { CircleCheck, Printer } from 'lucide-react';
import { downloadFile, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/dates';
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from '@/api/types';
import { Badge, Button, Card, Money, toast } from '@/ui';
import { DENOMINATIONS, DIFFERENCE_LABEL, DIFFERENCE_TONE, denominationSubtotal, differenceKind, type DenominationKey } from './arqueo';
import { operatorName, registerName, type CashSessionRow } from './types';

export async function printSummary(id: number): Promise<void> {
  try {
    await downloadFile(`/cash-sessions/${id}/summary.pdf`, { filename: `cierre-caja-${id}.pdf` });
  } catch (e) {
    toast.error({ title: 'No se pudo generar el resumen.', description: errorMessage(e) });
  }
}

function Row({ label, children, strong }: { label: string; children: ReactNode; strong?: boolean }) {
  return (
    <div className={strong ? 'flex justify-between gap-3 font-semibold text-ink' : 'flex justify-between gap-3'}>
      <dt className={strong ? undefined : 'text-ink-2'}>{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

/** "Resumen de cierre": closed-session figures, count breakdown and print button. */
export function CierreResumen({ session, actions, justClosed }: { session: CashSessionRow; actions?: ReactNode; justClosed?: boolean }) {
  const [printing, setPrinting] = useState(false);
  const diff = session.difference_cents ?? 0;
  const kind = differenceKind(diff);
  const bills = session.closing_breakdown?.bills ?? {};
  const methods = session.method_totals;

  async function onPrint() {
    setPrinting(true);
    await printSummary(session.id);
    setPrinting(false);
  }

  return (
    <Card
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
      <div className="grid gap-6 md:grid-cols-2">
        <dl className="flex flex-col gap-2 text-[13.5px]">
          <Row label="Apertura del turno">
            <span className="num">{formatDateTime(session.opened_at)}</span>
          </Row>
          <Row label="Cierre del turno">
            <span className="num">{session.closed_at ? formatDateTime(session.closed_at) : '—'}</span>
          </Row>
          <Row label="Monto de apertura">
            <Money cents={session.opening_cents} />
          </Row>
          <Row label="Cobros registrados">
            <Money cents={session.payments_total_cents} />
          </Row>
          <div className="my-1 border-t border-line" />
          <Row label="Efectivo esperado">
            <Money cents={session.expected_cash_cents} />
          </Row>
          <Row label="Total contado" strong>
            <Money cents={session.counted_cents} />
          </Row>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-ink-2">Diferencia</dt>
            <dd className="flex items-center gap-2">
              <Badge tone={DIFFERENCE_TONE[kind]} dot>
                {DIFFERENCE_LABEL[kind]}
              </Badge>
              <Money cents={session.difference_cents} signed className="font-semibold" />
            </dd>
          </div>
          {session.closing_notes && (
            <div className="mt-2 rounded-[var(--radius-sm)] bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
              <span className="font-medium text-ink">Nota de cierre: </span>
              {session.closing_notes}
            </div>
          )}
        </dl>

        <div className="flex flex-col gap-4">
          {methods && (
            <dl className="flex flex-col gap-1.5 text-[13.5px]">
              <p className="text-[12px] font-medium tracking-[0.04em] text-ink-3 uppercase">Cobros por método</p>
              {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
                <Row key={m} label={PAYMENT_METHOD_LABEL[m]}>
                  <Money cents={methods[m] ?? 0} />
                </Row>
              ))}
            </dl>
          )}
          {session.closing_breakdown && (
            <dl className="flex flex-col gap-1 text-[13px]">
              <p className="text-[12px] font-medium tracking-[0.04em] text-ink-3 uppercase">Desglose del conteo</p>
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
          )}
        </div>
      </div>
    </Card>
  );
}
