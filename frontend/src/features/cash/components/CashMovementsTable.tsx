import { type ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { EyeOutlined } from '@ant-design/icons';
import { Button, Drawer, Input, Tag } from 'antd';
import type { InstitutionalColumn } from '@/design-system/ag-grid/InstitutionalDataGrid';
import { InstitutionalDataGrid } from '@/design-system/ag-grid/InstitutionalDataGrid';
import { finiteNumber, formatLempirasUI } from '@/lib/money';

export type CashMovement = {
  id: number; cash_session_id: number; payment_id: number | null; invoice_id?: number | null;
  invoice_number?: string | null; user_id: number; type: string; method: string | null;
  amount: string; notes: string | null; occurred_at: string;
};

interface CashMovementsTableProps { canViewInvoices?: boolean; movements: CashMovement[] }

export function CashMovementsTable({ canViewInvoices = false, movements }: CashMovementsTableProps) {
  const [selectedMovement, setSelectedMovement] = useState<CashMovement | null>(null);
  const [search, setSearch] = useState('');
  const [mobilePage, setMobilePage] = useState(1);
  const normalizedSearch = normalizeSearch(search);
  const filteredMovements = normalizedSearch === ''
    ? movements
    : movements.filter((movement) => movementSearchText(movement).includes(normalizedSearch));
  const mobilePageSize = 10;
  const mobilePageCount = Math.max(1, Math.ceil(filteredMovements.length / mobilePageSize));
  const safeMobilePage = Math.min(mobilePage, mobilePageCount);
  const mobilePageStart = (safeMobilePage - 1) * mobilePageSize;
  const mobileMovements = filteredMovements.slice(mobilePageStart, mobilePageStart + mobilePageSize);
  const columns: InstitutionalColumn<CashMovement>[] = [
    { field: 'occurred_at', headerName: 'Hora', width: 112, valueFormatter: ({ value }) => formatMovementTime(String(value)) },
    { field: 'type', headerName: 'Tipo', width: 128, valueFormatter: ({ value }) => movementLabel(String(value)) },
    {
      headerName: 'Referencia',
      valueGetter: ({ data }) => referenceText(data),
      cellRenderer: ({ data }: { data?: CashMovement }) => data ? <MovementReference canViewInvoices={canViewInvoices} movement={data} /> : null,
      flex: 1,
      minWidth: 210,
    },
    { field: 'method', headerName: 'Método', width: 130, valueFormatter: ({ value }) => methodLabel(value == null ? null : String(value)) },
    { field: 'amount', headerName: 'Monto', width: 138, type: 'numericColumn', valueFormatter: ({ data }) => data ? movementAmount(data) : '' },
    {
      headerName: 'Detalle',
      width: 88,
      sortable: false,
      filter: false,
      cellRenderer: ({ data }: { data?: CashMovement }) => data ? (
        <Button
          type="text"
          size="small"
          icon={<EyeOutlined />}
          aria-label={`Ver detalle del movimiento ${data.id}`}
          onClick={() => setSelectedMovement(data)}
        />
      ) : null,
    },
  ];

  return (
    <section className="border border-border bg-background" aria-labelledby="cash-movements-title">
      <header className="border-b border-border p-5">
        <h2 id="cash-movements-title" className="text-lg font-semibold">Movimientos de caja</h2>
        <p className="text-sm text-muted-foreground">Cada movimiento conserva su hora, método y referencia de pago o factura.</p>
        <Input.Search
          aria-label="Buscar movimientos"
          allowClear
          className="mt-4 max-w-md"
          placeholder="Buscar por tipo, método, factura o nota"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setMobilePage(1);
          }}
        />
      </header>
      <div className="hidden p-4 md:block">
        <InstitutionalDataGrid
          ariaLabel="Movimientos de caja"
          columns={columns}
          rows={filteredMovements}
          getRowId={(row) => String(row.id)}
          emptyMessage={search ? 'Sin movimientos que coincidan con la búsqueda' : 'Sin movimientos de caja'}
          density="compact"
          gridOptions={{
            pagination: filteredMovements.length > 25,
            paginationPageSize: 25,
            paginationPageSizeSelector: false,
          }}
        />
      </div>
      <ol className="md:hidden" aria-label="Movimientos de caja en móvil">
        {mobileMovements.map((movement) => (
          <li key={movement.id} className="block border-b border-border p-4">
            <div className="flex justify-between gap-3">
              <div><Tag color={movementColor(movement.type)}>{movementLabel(movement.type)}</Tag><p className="text-xs text-muted-foreground">{formatMovementTime(movement.occurred_at)} · {methodLabel(movement.method)}</p></div>
              <strong className="tabular-nums">{movementAmount(movement)}</strong>
            </div>
            <div className="mt-2"><MovementReference canViewInvoices={canViewInvoices} movement={movement} /></div>
            {movement.notes ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{movement.notes}</p> : null}
            <Button
              type="link"
              className="mt-1 h-auto p-0"
              onClick={() => setSelectedMovement(movement)}
              aria-label={`Ver detalle del movimiento ${movement.id}`}
            >
              Ver detalle
            </Button>
          </li>
        ))}
      </ol>
      {filteredMovements.length > mobilePageSize ? (
        <nav aria-label="Paginación de movimientos" className="flex items-center justify-between gap-3 border-t border-border p-4 md:hidden">
          <span className="text-xs tabular-nums text-muted-foreground">
            {mobilePageStart + 1}–{Math.min(mobilePageStart + mobilePageSize, filteredMovements.length)} de {filteredMovements.length} movimientos
          </span>
          <div className="flex gap-2">
            <Button
              htmlType="button"
              size="small"
              aria-label="Página anterior"
              disabled={safeMobilePage === 1}
              onClick={() => setMobilePage((page) => Math.max(1, page - 1))}
            >
              Anterior
            </Button>
            <Button
              htmlType="button"
              size="small"
              aria-label="Página siguiente"
              disabled={safeMobilePage === mobilePageCount}
              onClick={() => setMobilePage((page) => Math.min(mobilePageCount, page + 1))}
            >
              Siguiente
            </Button>
          </div>
        </nav>
      ) : null}
      {filteredMovements.length === 0 ? (
        <p className={search ? 'p-4 text-sm text-muted-foreground md:hidden' : 'sr-only'}>
          {search
            ? 'Sin movimientos que coincidan con la búsqueda.'
            : 'Entradas, salidas y ajustes aparecerán cuando la sesión tenga actividad.'}
        </p>
      ) : null}
      <Drawer
        open={selectedMovement !== null}
        onClose={() => setSelectedMovement(null)}
        title={selectedMovement ? `Detalle del movimiento ${selectedMovement.id}` : 'Detalle del movimiento'}
        size="default"
      >
        {selectedMovement ? (
          <dl className="cash-movement-detail-grid grid gap-x-4 gap-y-3 text-sm">
            <MovementDetail label="Hora">{formatMovementTime(selectedMovement.occurred_at)}</MovementDetail>
            <MovementDetail label="Tipo">{movementLabel(selectedMovement.type)}</MovementDetail>
            <MovementDetail label="Método">{methodLabel(selectedMovement.method)}</MovementDetail>
            <MovementDetail label="Monto"><strong className="tabular-nums">{movementAmount(selectedMovement)}</strong></MovementDetail>
            <MovementDetail label="Referencia"><MovementReference canViewInvoices={canViewInvoices} movement={selectedMovement} /></MovementDetail>
            <MovementDetail label="Detalle auditado">{selectedMovement.notes || 'Sin nota registrada'}</MovementDetail>
          </dl>
        ) : null}
      </Drawer>
    </section>
  );
}

function MovementDetail({ children, label }: { children: ReactNode; label: string }) {
  return <><dt className="text-muted-foreground">{label}</dt><dd className="min-w-0 break-words">{children}</dd></>;
}

function MovementReference({ canViewInvoices, movement }: { canViewInvoices: boolean; movement: CashMovement }) {
  const invoiceLabel = movement.invoice_number ?? (movement.invoice_id ? `#${movement.invoice_id}` : null);
  if (!movement.payment_id && !movement.invoice_id) return <span>Movimiento #{movement.id}</span>;
  return <span>{movement.invoice_id && canViewInvoices ? <Link to={`/invoices?invoice=${movement.invoice_id}`}>Factura {invoiceLabel}</Link> : movement.invoice_id ? `Factura ${invoiceLabel}` : null}{movement.payment_id ? ` Pago #${movement.payment_id}` : null}</span>;
}
function referenceText(movement?: CashMovement) { return movement ? `${movement.invoice_id ? `Factura ${movement.invoice_number ?? `#${movement.invoice_id}`}` : ''}${movement.payment_id ? ` Pago #${movement.payment_id}` : ''}`.trim() || `Movimiento #${movement.id}` : ''; }
function direction(type: string) { return ['income', 'opening', 'payment', 'cash_in'].includes(type) ? 1 : ['expense', 'payment_void', 'cash_out', 'refund', 'void'].includes(type) ? -1 : 0; }
function movementAmount(movement: CashMovement) { const sign = direction(movement.type); return `${sign > 0 ? '+ ' : sign < 0 ? '- ' : ''}${formatLempirasUI(sign ? Math.abs(finiteNumber(movement.amount)) : movement.amount)}`; }
function movementColor(type: string) { return direction(type) > 0 ? 'green' : direction(type) < 0 ? 'red' : 'default'; }
function movementLabel(type: string) { return ({ cash_in: 'Entrada', cash_out: 'Salida', closing: 'Cierre', expense: 'Egreso', income: 'Ingreso', opening: 'Apertura', payment: 'Pago', payment_void: 'Reverso de pago', refund: 'Devolución', void: 'Anulación' } as Record<string, string>)[type] ?? 'Movimiento'; }
function methodLabel(method: string | null) { return method ? ({ card: 'Tarjeta', cash: 'Efectivo', closing: 'Cierre', opening: 'Apertura', other: 'Otro', transfer: 'Transferencia' } as Record<string, string>)[method] ?? method : 'Sin método'; }
function formatMovementTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Hora no disponible' : new Intl.DateTimeFormat('es-HN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(date); }
function normalizeSearch(value: string) { return value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-HN'); }
function movementSearchText(movement: CashMovement) {
  return normalizeSearch([
    movementLabel(movement.type),
    methodLabel(movement.method),
    referenceText(movement),
    movement.notes ?? '',
    formatMovementTime(movement.occurred_at),
    movementAmount(movement),
  ].join(' '));
}
