import { Link } from 'react-router';
import { Banknote } from 'lucide-react';
import { formatTime } from '@/lib/dates';
import { PAYMENT_METHOD_LABEL, type CashMovement, type CashMovementType, type PaymentMethod, type Reconciliation } from '@/api/types';
import { Badge, DataTable, Money, type Column, type GlyphShape, type Tone } from '@/ui';
import { MethodBars } from '@/features/reportes/MethodBars';


const METHODS: PaymentMethod[] = ['cash', 'transfer', 'card', 'other'];

/** Tab "Resumen": cobros por método. Only cash goes into the drawer. */
export function ResumenTab({ reconciliation }: { reconciliation: Reconciliation }) {
  const totals = reconciliation.method_totals;
  const rows = METHODS.map((m) => ({ method: m, amount_cents: totals?.[m] ?? 0 }));
  return (
    <div className="grid overflow-hidden rounded-[var(--radius-md)] border border-junta bg-junta gap-px lg:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-labelledby="cobros-metodo" className="flex flex-col bg-surface">
        <h3 id="cobros-metodo" className="flex min-h-11 items-center border-b border-junta px-4 text-[15px] font-bold text-ink">
          Cobros por método
        </h3>
        <div className="p-4">
          <MethodBars rows={rows} label="Cobros por método en este turno" />
        </div>
      </section>
      <aside className="flex flex-col bg-surface text-[13.5px]">
        <p className="flex min-h-11 items-start gap-2 border-b border-junta px-4 py-2.5 text-[13px] text-ink-2">
          <Banknote className="mt-[2px] size-4 shrink-0 text-ink-3" aria-hidden="true" />
          <span>
            Solo el <strong className="font-semibold text-ink">efectivo</strong> entra a la gaveta. Transferencias, tarjetas y otros
            métodos no se cuentan en el arqueo.
          </span>
        </p>
        <dl className="flex flex-col">
          <div className="flex justify-between gap-3 border-b border-junta px-4 py-2.5">
            <dt className="text-ink-2">Apertura</dt>
            <dd>
              <Money cents={reconciliation.opening_cents} />
            </dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-junta px-4 py-2.5">
            <dt className="text-ink-2">+ Cobros en efectivo</dt>
            <dd>
              <Money cents={totals?.cash ?? 0} />
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 px-4 py-3 font-semibold text-ink">
            <dt>Efectivo esperado</dt>
            <dd className="text-[18px]">
              <Money cents={reconciliation.expected_cash_cents} />
            </dd>
          </div>
        </dl>
      </aside>
    </div>
  );
}

export const MOVEMENT_TYPE_LABEL: Record<CashMovementType, string> = {
  opening: 'Apertura',
  payment: 'Cobro',
  payment_void: 'Cobro anulado',
  closing: 'Cierre',
};

const MOVEMENT_SHAPE: Record<CashMovementType, GlyphShape> = {
  opening: 'dot',
  payment: 'filled',
  payment_void: 'struck',
  closing: 'dot',
};

const MOVEMENT_TONE: Record<CashMovementType, Tone> = {
  opening: 'neutral',
  payment: 'ok',
  payment_void: 'danger',
  closing: 'neutral',
};

/** Tab "Movimientos": Hora, Tipo, Referencia, Método, Monto. */
export function MovimientosTab({ movements, loading }: { movements: CashMovement[] | undefined; loading: boolean }) {
  const columns: Column<CashMovement>[] = [
    { key: 'time', header: 'Hora', width: '80px', cell: (m) => <span className="num">{formatTime(m.occurred_at)}</span> },
    {
      key: 'type',
      header: 'Tipo',
      cell: (m) => (
        <Badge tone={MOVEMENT_TONE[m.type]} shape={MOVEMENT_SHAPE[m.type]}>
          {MOVEMENT_TYPE_LABEL[m.type]}
        </Badge>
      ),
    },
    {
      key: 'ref',
      header: 'Referencia',
      cell: (m) => (
        <span className="flex flex-col">
          {m.invoice_number ? (
            m.invoice_id ? (
              <Link to={`/recibos/${m.invoice_id}`} className="num font-medium text-slate-text underline-offset-2 hover:underline">
                {m.invoice_number}
              </Link>
            ) : (
              <span className="num">{m.invoice_number}</span>
            )
          ) : null}
          {(m.reference || m.notes) && <span className="text-[12px] text-ink-3">{m.reference || m.notes}</span>}
          {!m.invoice_number && !m.reference && !m.notes && <span className="text-ink-3">—</span>}
        </span>
      ),
    },
    { key: 'method', header: 'Método', cell: (m) => (m.method ? PAYMENT_METHOD_LABEL[m.method] : <span className="text-ink-3">—</span>) },
    { key: 'amount', header: 'Monto', numeric: true, cell: (m) => <Money cents={m.amount_cents} signed toneNegative /> },
  ];
  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-junta bg-surface">
      <DataTable
        caption="Movimientos del turno"
        columns={columns}
        rows={movements}
        rowKey={(m) => m.id}
        loading={loading}
        density="compact"
      />
    </div>
  );
}
