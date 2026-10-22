import { EyeIcon } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AdminChip,
  AdminDialog,
  AdminPanel,
  AdminPanelHeader,
  AdminSearch,
  AdminTable,
  AdminToolbar,
  StatusStamp,
  type AdminColumn,
  type AdminSortState,
  type AdminStatus,
} from '@/design-system/admin/components';
import { CASH_AMOUNT_FALLBACK, cashSignedAmountCents, formatCashCents } from '../cashMoney';
import { normalizeSearchText } from '@/lib/normalizeText';
import { ICON_BUTTON, LINK_BUTTON, LINK_INLINE, SECONDARY_BUTTON } from '../cashUi';

export type CashMovement = { id: number; cash_session_id: number; payment_id: number | null; invoice_id?: number | null; invoice_number?: string | null; user_id: number; type: string; method: string | null; amount: string; notes: string | null; occurred_at: string };
interface CashMovementsTableProps { canViewInvoices?: boolean; movements: CashMovement[] }

export function CashMovementsTable({ canViewInvoices = false, movements }: CashMovementsTableProps) {
  const [selectedMovement, setSelectedMovement] = useState<CashMovement | null>(null);
  const [search, setSearch] = useState('');
  const [mobilePage, setMobilePage] = useState(1);
  const [sort, setSort] = useState<AdminSortState | null>(null);
  const normalizedSearch = normalizeSearchText(search);
  const filteredMovements = normalizedSearch === '' ? movements : movements.filter((movement) => movementSearchText(movement).includes(normalizedSearch));
  // El orden vive en la pantalla (no dentro de AdminTable) para que la tabla
  // de escritorio y la lista móvil muestren exactamente la misma secuencia.
  const orderedMovements = useMemo(() => sortMovements(filteredMovements, sort), [filteredMovements, sort]);
  const mobilePageSize = 10;
  const mobilePageCount = Math.max(1, Math.ceil(orderedMovements.length / mobilePageSize));
  const safeMobilePage = Math.min(mobilePage, mobilePageCount);
  const mobilePageStart = (safeMobilePage - 1) * mobilePageSize;
  const mobileMovements = orderedMovements.slice(mobilePageStart, mobilePageStart + mobilePageSize);
  const columns: Array<AdminColumn<CashMovement>> = [
    { key: 'occurred_at', header: 'Hora', sortable: true, sortValue: (movement) => movementTimeValue(movement.occurred_at), cell: (movement) => formatMovementTime(movement.occurred_at) },
    { key: 'type', header: 'Tipo', sortable: true, sortValue: (movement) => movementLabel(movement.type), cell: (movement) => <MovementStamp type={movement.type} /> },
    { key: 'reference', header: 'Referencia', sortable: true, sortValue: (movement) => referenceText(movement), cell: (movement) => <MovementReference canViewInvoices={canViewInvoices} movement={movement} /> },
    { key: 'method', header: 'Método', sortable: true, sortValue: (movement) => methodLabel(movement.method), cell: (movement) => methodLabel(movement.method) },
    { key: 'amount', header: 'Monto', align: 'right', sortable: true, sortValue: (movement) => cashSignedAmountCents(movement.amount), cell: (movement) => <strong className="tabular-nums">{movementAmount(movement)}</strong> },
    { key: 'detail', header: 'Detalle', align: 'center', cell: (movement) => <button type="button" data-ui-press className={ICON_BUTTON} aria-label="Ver detalle del movimiento" onClick={() => setSelectedMovement(movement)}><EyeIcon aria-hidden="true" data-icon className="size-4" /></button> },
  ];

  return <AdminPanel aria-labelledby="cash-movements-title">
    <AdminPanelHeader
      id="cash-movements-title"
      title="Movimientos de caja"
      description="Cada movimiento conserva su hora, método y referencia de pago o factura."
      actions={<AdminChip>{`${orderedMovements.length} ${orderedMovements.length === 1 ? 'movimiento' : 'movimientos'}`}</AdminChip>}
    />
    <AdminToolbar className="border-b border-[var(--ui-line)] px-4 py-3">
      <AdminSearch
        id="cash-movements-search"
        label="Buscar movimientos"
        value={search}
        onValueChange={(value) => { setSearch(value); setMobilePage(1); }}
        placeholder="Buscar por tipo, método, factura o nota"
        className="w-full max-w-md"
      />
    </AdminToolbar>
    <div className="hidden p-4 md:block">
      <AdminTable
        caption="Movimientos de caja"
        columns={columns}
        rows={orderedMovements}
        getRowKey={(movement) => String(movement.id)}
        mobileCards={false}
        sort={sort}
        onSortChange={(next) => {
          setSort(next);
          setMobilePage(1);
        }}
        empty={(
          <span className="flex flex-col gap-1">
            <strong>{search ? 'Sin movimientos que coincidan con la búsqueda' : 'Sin movimientos de caja'}</strong>
            <span>{search ? 'Ajuste la búsqueda para ver otros movimientos.' : 'Entradas, salidas y ajustes aparecerán cuando la sesión tenga actividad.'}</span>
          </span>
        )}
      />
    </div>
    <ol className="md:hidden" aria-label="Movimientos de caja en móvil">{mobileMovements.map((movement) => <li key={movement.id} className="block border-b border-[var(--ui-line)] p-4 last:border-b-0"><div className="flex justify-between gap-3"><div><MovementStamp type={movement.type} /><p className="mt-1 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">{formatMovementTime(movement.occurred_at)} · {methodLabel(movement.method)}</p></div><strong className="tabular-nums text-[color:var(--ui-ink)]">{movementAmount(movement)}</strong></div><div className="mt-2"><MovementReference canViewInvoices={canViewInvoices} movement={movement} /></div>{movement.notes ? <p className="mt-2 line-clamp-2 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">{movement.notes}</p> : null}<button type="button" data-ui-press className={`mt-1 ${LINK_BUTTON}`} onClick={() => setSelectedMovement(movement)} aria-label="Ver detalle del movimiento">Ver detalle</button></li>)}</ol>
    {orderedMovements.length > mobilePageSize ? <nav aria-label="Paginación de movimientos" className="flex items-center justify-between gap-3 border-t border-[var(--ui-line)] p-4 md:hidden"><span className="text-[length:var(--ui-text-xs)] tabular-nums text-[color:var(--ui-ink-soft)]">{mobilePageStart + 1}–{Math.min(mobilePageStart + mobilePageSize, orderedMovements.length)} de {orderedMovements.length} movimientos</span><div className="flex gap-2"><button type="button" data-ui-press className={SECONDARY_BUTTON} aria-label="Página anterior" disabled={safeMobilePage === 1} onClick={() => setMobilePage((page) => Math.max(1, page - 1))}>Anterior</button><button type="button" data-ui-press className={SECONDARY_BUTTON} aria-label="Página siguiente" disabled={safeMobilePage === mobilePageCount} onClick={() => setMobilePage((page) => Math.min(mobilePageCount, page + 1))}>Siguiente</button></div></nav> : null}
    {orderedMovements.length === 0 && search ? <p className="p-4 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)] md:hidden">Sin movimientos que coincidan con la búsqueda.</p> : null}
    <AdminDialog
      open={selectedMovement !== null}
      onOpenChange={(open) => { if (!open) setSelectedMovement(null); }}
      title="Detalle del movimiento"
      description="Información registrada para este movimiento de caja."
      footer={<button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={() => setSelectedMovement(null)}>Cerrar</button>}
    >
      {selectedMovement ? <dl className="grid gap-x-4 gap-y-3 text-[length:var(--ui-text-sm)]"><MovementDetail label="Hora">{formatMovementTime(selectedMovement.occurred_at)}</MovementDetail><MovementDetail label="Tipo">{movementLabel(selectedMovement.type)}</MovementDetail><MovementDetail label="Método">{methodLabel(selectedMovement.method)}</MovementDetail><MovementDetail label="Monto"><strong className="tabular-nums">{movementAmount(selectedMovement)}</strong></MovementDetail><MovementDetail label="Referencia"><MovementReference canViewInvoices={canViewInvoices} movement={selectedMovement} /></MovementDetail><MovementDetail label="Detalle auditado">{selectedMovement.notes || 'Sin nota registrada'}</MovementDetail></dl> : null}
    </AdminDialog>
  </AdminPanel>;
}

function MovementStamp({ type }: { type: string }) {
  const value = direction(type);
  const status: AdminStatus = value < 0 ? 'anulado' : value > 0 ? 'cobrado' : 'borrador';

  return <StatusStamp status={status} label={movementLabel(type)} />;
}
function MovementDetail({ children, label }: { children: ReactNode; label: string }) { return <><dt className="text-[color:var(--ui-ink-soft)]">{label}</dt><dd className="min-w-0 break-words">{children}</dd></>; }
function MovementReference({ canViewInvoices, movement }: { canViewInvoices: boolean; movement: CashMovement }) {
  const hasPublicInvoiceNumber = Boolean(movement.invoice_number?.trim());
  if (!movement.payment_id && !movement.invoice_id) return <span>Movimiento manual</span>;

  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {movement.invoice_id && hasPublicInvoiceNumber && canViewInvoices ? (
        <Link className={LINK_INLINE} to={`/recibos?operacion=${movement.invoice_id}`}>
          Factura {movement.invoice_number}
        </Link>
      ) : movement.invoice_id && hasPublicInvoiceNumber ? (
        `Factura ${movement.invoice_number}`
      ) : movement.invoice_id ? (
        'Factura asociada'
      ) : null}
      {movement.payment_id ? <span>Pago asociado</span> : null}
    </span>
  );
}
function referenceText(movement?: CashMovement) {
  return movement
    ? [movement.invoice_number?.trim() ? `Factura ${movement.invoice_number}` : movement.invoice_id ? 'Factura asociada' : '', movement.payment_id ? 'Pago asociado' : ''].filter(Boolean).join(' ') || 'Movimiento manual'
    : '';
}
function direction(type: string) { return ['income', 'opening', 'payment', 'cash_in'].includes(type) ? 1 : ['expense', 'payment_void', 'cash_out', 'refund', 'void'].includes(type) ? -1 : 0; }
function movementAmount(movement: CashMovement) { const sign = direction(movement.type); const cents = cashSignedAmountCents(movement.amount); if (cents === null) return CASH_AMOUNT_FALLBACK; if (sign === 0) return formatCashCents(cents); const magnitude = formatCashCents(Math.abs(cents)); return `${sign > 0 ? '+ ' : '- '}${magnitude}`; }
function movementLabel(type: string) { return ({ cash_in: 'Entrada', cash_out: 'Salida', closing: 'Cierre', expense: 'Egreso', income: 'Ingreso', opening: 'Apertura', payment: 'Pago', payment_void: 'Reverso de pago', refund: 'Devolución', void: 'Anulación' } as Record<string, string>)[type] ?? 'Movimiento'; }
function methodLabel(method: string | null) { return method ? ({ card: 'Tarjeta', cash: 'Efectivo', closing: 'Cierre', opening: 'Apertura', other: 'Otro', transfer: 'Transferencia' } as Record<string, string>)[method] ?? method : 'Sin método'; }
function formatMovementTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Hora no disponible' : new Intl.DateTimeFormat('es-HN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date); }
function movementSearchText(movement: CashMovement) { return normalizeSearchText([movementLabel(movement.type), methodLabel(movement.method), referenceText(movement), movement.notes ?? '', formatMovementTime(movement.occurred_at), movementAmount(movement)].join(' ')); }
function movementTimeValue(value: string) { const time = new Date(value).getTime(); return Number.isNaN(time) ? null : time; }
function movementSortValue(movement: CashMovement, key: string): string | number | null {
  switch (key) {
    case 'occurred_at': return movementTimeValue(movement.occurred_at);
    case 'type': return movementLabel(movement.type);
    case 'reference': return referenceText(movement);
    case 'method': return methodLabel(movement.method);
    case 'amount': return cashSignedAmountCents(movement.amount);
    default: return null;
  }
}
/** Orden local de la pantalla; la misma secuencia alimenta tabla y lista móvil. */
function sortMovements(movements: CashMovement[], sort: AdminSortState | null): CashMovement[] {
  if (!sort) return movements;

  return [...movements].sort((left, right) => {
    const a = movementSortValue(left, sort.key);
    const b = movementSortValue(right, sort.key);
    const aEmpty = a === null || a === undefined || a === '';
    const bEmpty = b === null || b === undefined || b === '';
    const result = aEmpty && bEmpty ? 0 : aEmpty ? 1 : bEmpty ? -1
      : typeof a === 'number' && typeof b === 'number' ? a - b
        : String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
    return sort.direction === 'asc' ? result : -result;
  });
}
