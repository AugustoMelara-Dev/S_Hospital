import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatLempirasUIFromCents, parseCents } from '@/lib/moneyCents';
import { cn } from '@/lib/utils';
import {
  AdminCallout,
  AdminPanel,
  AdminPanelHeader,
  MoneyText,
  StatusStamp,
} from '@/design-system/admin/components';
import {
  buildReconciliationStatus,
  type ReconciliationInput,
} from '../application/reconciliationStatus';

type AccountingControlPanelProps = {
  canViewInvoices?: boolean;
  reconciliation: ReconciliationInput;
  historyHref?: string;
};

/** Foco visible admin (2px + offset 2, `--ui-focus`), nunca el teal de R2. */
const FOCUS_RING =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]';

/**
 * Acción de resolución dentro del aviso de bloqueo. Es cromo secundario
 * (borde hairline + ink), no el acento de acción de la pantalla: el cierre
 * de caja sigue siendo la única acción primaria de Caja.
 */
const RESOLUTION_LINK = `inline-flex h-[var(--ui-control-h)] shrink-0 items-center justify-center rounded-[var(--ui-radius-control)] border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] px-3 text-[length:var(--ui-text-base)] font-medium text-[color:var(--ui-ink)] transition-[transform,background-color,border-color] duration-[var(--ui-duration-press)] ease-[var(--ui-ease-out)] hover:bg-[var(--ui-surface-alt)] active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`;

/**
 * Control de cierre de la caja. No repite los totales del turno (cobros y
 * saldo viven en la banda del turno): aquí solo va lo que decide si el cierre
 * puede confirmarse — recibos por emitir, reversos por revisar y el estado del
 * cierre con su diferencia. Un contador en cero no dibuja contenedor.
 *
 * El producto no modela egresos operativos: por eso no existe fila de gastos
 * ni acción que pueda confundirse con registrarlos.
 */
export function AccountingControlPanel({
  canViewInvoices = false,
  reconciliation,
  historyHref = '/invoices',
}: AccountingControlPanelProps) {
  const status = buildReconciliationStatus(reconciliation);
  const missingReceipts = status.blockers.find((blocker) => blocker.kind === 'missing_receipts');
  const hasDifference =
    reconciliation.difference_amount !== null && reconciliation.difference_amount !== undefined;
  // Centavos con signo para no perder el faltante; `parseCents` puro rechaza
  // el "-" inicial del decimal de intercambio.
  const differenceCents = signedCents(reconciliation.difference_amount);
  const differenceDescription = !hasDifference
    ? 'Conteo pendiente'
    : differenceCents === null
      ? 'Diferencia no disponible'
      : differenceCents === 0
        ? 'Sin diferencia'
        : differenceCents > 0
          ? 'Sobrante de caja'
          : 'Faltante de caja';

  const reversedCents = parseCents(status.reversedPayments.total);
  const closed = reconciliation.status === 'closed';

  const facts: Array<{ key: string; label: string; value: ReactNode; detail: ReactNode; detailId?: string; detailDescription?: string; detailClassName?: string }> = [];

  if (missingReceipts?.kind === 'missing_receipts') {
    facts.push({
      key: 'receipts',
      label: 'Recibos pendientes',
      value: <span className="tabular-nums">{missingReceipts.count}</span>,
      detail:
        missingReceipts.count === 1
          ? '1 recibo institucional por emitir'
          : `${missingReceipts.count} recibos institucionales por emitir`,
    });
  }

  if (status.reversedPayments.count > 0) {
    facts.push({
      key: 'reversed',
      label: 'Pagos reversados',
      value: <MoneyText cents={reversedCents} />,
      detail:
        status.reversedPayments.count === 1
          ? '1 pago reversado por revisar'
          : `${status.reversedPayments.count} pagos reversados por revisar`,
    });
  }

  facts.push({
    key: 'closing',
    label: 'Estado del cierre',
    value: (
      <StatusStamp
        status={closed ? 'cobrado' : 'borrador'}
        label={closed ? 'Cierre confirmado' : 'Cierre en preparación'}
      />
    ),
    detail: !hasDifference
      ? 'Ingrese el conteo físico'
      : differenceCents === null
        ? 'No disponible'
        : formatSignedCents(differenceCents),
    detailId: 'accounting-difference-description',
    detailDescription: differenceDescription,
    detailClassName: cn(
      hasDifference && differenceCents !== null && differenceCents < 0 && 'text-[color:var(--ui-danger)]',
      hasDifference && differenceCents !== null && differenceCents > 0 && 'text-[color:var(--ui-warn)]',
      hasDifference && differenceCents === 0 && 'text-[color:var(--ui-success)]',
    ),
  });

  return (
    <AdminPanel aria-labelledby="accounting-control-title">
      <AdminPanelHeader
        id="accounting-control-title"
        title="Control del cierre"
        description="Recibos y reversos que deben quedar resueltos, y el estado del arqueo."
      />

      <dl className="divide-y divide-[var(--ui-line)]">
        {facts.map((fact) => (
          <Fact
            key={fact.key}
            label={fact.label}
            value={fact.value}
            detail={fact.detail}
            detailClassName={fact.detailClassName}
            detailDescription={fact.detailDescription}
            detailId={fact.detailId}
          />
        ))}
      </dl>

      <div className="border-t border-[var(--ui-line)] px-4 py-4 sm:px-5">
        {status.state === 'blocked' ? (
          <AdminCallout tone="warn" title="Cierre bloqueado por conciliación pendiente">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="flex-1">
                Resuelva las facturas o recibos indicados antes de cerrar la caja.
              </span>
              {canViewInvoices ? (
                <Link to={historyHref} data-ui-press className={RESOLUTION_LINK}>
                  Resolver en Historial
                </Link>
              ) : (
                <span className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]">
                  Solicite apoyo a un usuario con acceso al Historial.
                </span>
              )}
            </div>
          </AdminCallout>
        ) : hasDifference ? (
          /*
           * V16: «sin bloqueos documentales» no es lo mismo que «arqueo completo».
           * El aviso verde solo corresponde cuando el conteo físico ya está
           * registrado; antes salía en verde aunque el cajero todavía no hubiera
           * contado nada.
           */
          <AdminCallout tone="success" title="Conteo y conciliación completos">
            No hay pendientes documentales y el conteo físico está registrado. Revise la diferencia
            antes de confirmar el cierre.
          </AdminCallout>
        ) : (
          <AdminCallout tone="info" title="Sin pendientes documentales">
            Los cobros y recibos están conciliados. Falta ingresar el conteo físico para completar
            el arqueo antes de cerrar.
          </AdminCallout>
        )}
      </div>
    </AdminPanel>
  );
}

function Fact({
  detail,
  detailClassName,
  detailDescription,
  detailId,
  label,
  value,
}: {
  detail: ReactNode;
  detailClassName?: string;
  detailDescription?: string;
  detailId?: string;
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 py-3.5 transition-[background-color] duration-[var(--ui-duration-state)] ease-[var(--ui-ease-out)] hover:bg-[var(--ui-surface-alt)] sm:px-5">
      <dt className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">{label}</dt>
      <dd className="text-right font-semibold tabular-nums text-[color:var(--ui-ink)]">{value}</dd>
      <dd
        aria-describedby={detailId}
        className={cn(
          'col-span-2 text-[length:var(--ui-text-xs)] leading-relaxed text-[color:var(--ui-ink-soft)]',
          detailClassName,
        )}
      >
        {detail}
      </dd>
      {detailDescription ? (
        <dd id={detailId} className="sr-only">
          {detailDescription}
        </dd>
      ) : null}
    </div>
  );
}

/**
 * Convierte un decimal de intercambio con signo ("-5.00") o número a centavos
 * enteros. Ausente o mal formado → `null`; cero legítimo → `0`.
 */
function signedCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value * 100) : null;
  }

  const trimmed = value.trim();
  const negative = trimmed.startsWith('-');
  const cents = parseCents(negative ? trimmed.slice(1) : trimmed);

  if (cents === null) return null;

  return negative ? -cents : cents;
}

/**
 * Diferencia con signo humano a partir de centavos: "+ L. 5.00", "- L. 5.00".
 * Cero legítimo conserva el formato monetario canónico; nunca inventa un
 * sobrante/faltante.
 */
function formatSignedCents(cents: number): string {
  const magnitude = formatLempirasUIFromCents(Math.abs(cents));
  if (magnitude === null) return 'No disponible';
  if (cents === 0) return magnitude;

  return `${cents > 0 ? '+' : '-'} ${magnitude}`;
}
