import { useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { FileTextIcon, MoreHorizontalIcon, PrinterIcon, ReceiptIcon } from 'lucide-react';
import type { Invoice } from '@/lib/api';
import { parseCents } from '@/lib/moneyCents';
import { formatDateTimeEs } from '@/lib/format/formatDate';
import { cn } from '@/lib/utils';
import {
  AdminMenuContent,
  AdminMenuItem,
  AdminMenuRoot,
  AdminMenuTrigger,
} from '@/design-system/admin/AdminMenu';
import {
  AdminTable,
  MoneyText,
  StatusStamp,
  type AdminColumn,
  type AdminSortState,
} from '@/design-system/admin/components';
import {
  invoiceActionPolicy,
  type InvoiceActionPermissions,
} from '@/modules/invoices/application/invoiceActionPolicy';
import { documentView, paymentStateView, type RecibosDocumentKind } from './recibosModel';
import {
  COMPACT_SELECT_CLASS,
  ICON_BUTTON,
  ICON_BUTTON_TOUCH,
  ROW_ACTION_BUTTON,
  SECONDARY_BUTTON,
  STATUS_SINCOBRO_STAMP_CLASS,
  TABLE_IDENTITY_BUTTON,
} from './recibosUi';

/** Permisos de fila sin el criterio por-operacion, que se calcula por fila. */
export type RecibosBasePermissions = Omit<InvoiceActionPermissions, 'isOwnInvoiceFromToday'>;

type RecibosTableProps = {
  invoices: Invoice[];
  loadingActionInvoiceId: number | null;
  permissions: RecibosBasePermissions;
  isOwnInvoiceFromToday: (invoice: Invoice) => boolean;
  /** Operacion abierta en el detalle: la fila se resalta para no perderla de vista. */
  selectedInvoiceId?: number | null;
  onOpenDetail: (invoice: Invoice, trigger: HTMLElement | null) => void;
  onOpenReceipt: (invoice: Invoice) => void;
  onGenerateReceipt: (invoice: Invoice) => void;
  onReprint: (invoice: Invoice) => void;
  onCollect: (invoice: Invoice) => void;
};

function patientName(invoice: Invoice): string {
  return invoice.patient_name?.trim() || 'Paciente sin nombre';
}

function issuedAtValue(value: string): number | null {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function invoiceSortValue(invoice: Invoice, key: string): string | number | null {
  switch (key) {
    case 'document': return invoice.invoice_number;
    case 'issued_at': return issuedAtValue(invoice.issued_at);
    case 'patient_name': return patientName(invoice);
    case 'total': return parseCents(invoice.total);
    case 'status': return paymentStateView(invoice).label;
    default: return null;
  }
}

/** Orden local de la página visible; no altera la paginación del servidor. */
function sortInvoices(invoices: Invoice[], sort: AdminSortState | null): Invoice[] {
  if (!sort) return invoices;

  return [...invoices].sort((left, right) => {
    const a = invoiceSortValue(left, sort.key);
    const b = invoiceSortValue(right, sort.key);
    const aEmpty = a === null || a === undefined || a === '';
    const bEmpty = b === null || b === undefined || b === '';
    const result = aEmpty && bEmpty ? 0 : aEmpty ? 1 : bEmpty ? -1
      : typeof a === 'number' && typeof b === 'number' ? a - b
        : String(a).localeCompare(String(b), 'es', { numeric: true, sensitivity: 'base' });
    return sort.direction === 'asc' ? result : -result;
  });
}

/**
 * Tono del estado documental en la sub-línea de identidad. El estado financiero
 * vive en su propia columna (`StatusStamp`) para no confundir "sin cobro" con
 * "cobro registrado sin comprobante".
 */
const DOCUMENT_TONE: Record<RecibosDocumentKind, string> = {
  institutional: 'text-[color:var(--ui-ink-soft)]',
  pending_receipt: 'text-[color:var(--ui-warn)]',
  without_receipt: 'text-[color:var(--ui-ink-soft)]',
  void: 'text-[color:var(--ui-ink-soft)]',
};

/**
 * Opciones de orden de la lista móvil. Reproducen las columnas ordenables de la
 * tabla para que el mismo estado `sort` alimente la tabla de escritorio y las
 * tarjetas de móvil: en 390 px el cajero conserva la capacidad de ordenar.
 */
const MOBILE_SORT_OPTIONS: ReadonlyArray<{ sort: AdminSortState | null; label: string }> = [
  { sort: null, label: 'Orden de la lista' },
  { sort: { key: 'issued_at', direction: 'desc' }, label: 'Fecha: más reciente primero' },
  { sort: { key: 'issued_at', direction: 'asc' }, label: 'Fecha: más antigua primero' },
  { sort: { key: 'total', direction: 'desc' }, label: 'Total: mayor primero' },
  { sort: { key: 'total', direction: 'asc' }, label: 'Total: menor primero' },
  { sort: { key: 'patient_name', direction: 'asc' }, label: 'Paciente: A → Z' },
  { sort: { key: 'patient_name', direction: 'desc' }, label: 'Paciente: Z → A' },
  { sort: { key: 'document', direction: 'asc' }, label: 'Documento: A → Z' },
  { sort: { key: 'document', direction: 'desc' }, label: 'Documento: Z → A' },
  { sort: { key: 'status', direction: 'asc' }, label: 'Estado: A → Z' },
  { sort: { key: 'status', direction: 'desc' }, label: 'Estado: Z → A' },
];

function sortOptionValue(sort: AdminSortState | null): string {
  return sort ? `${sort.key}:${sort.direction}` : 'none';
}

/** Identidad de la fila: número de documento + estado documental en una sola línea. */
function DocumentIdentity({
  invoice,
  onOpenDetail,
}: {
  invoice: Invoice;
  onOpenDetail: (invoice: Invoice, trigger: HTMLElement | null) => void;
}) {
  const doc = documentView(invoice);

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <button
        type="button"
        data-invoice-detail-trigger={invoice.id}
        className={TABLE_IDENTITY_BUTTON}
        aria-label={`Ver detalle de la operación ${invoice.invoice_number}`}
        onClick={(event) => {
          event.stopPropagation();
          onOpenDetail(invoice, event.currentTarget);
        }}
      >
        {invoice.invoice_number}
      </button>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[length:var(--ui-text-xs)]">
        <span className={DOCUMENT_TONE[doc.kind]}>{doc.label}</span>
        {doc.receiptNumber ? (
          <>
            <span aria-hidden="true" className="text-[color:var(--ui-ink-faint)]">
              ·
            </span>
            <span className="font-mono font-semibold tabular-nums text-[color:var(--ui-ink)]">
              {doc.receiptNumber}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Tabla principal de Recibos: una fila por operacion con su identidad documental
 * y su estado financiero separados, y una unica accion contextual principal con
 * el resto en el menu accesible. La tabla se desplaza dentro de su contenedor
 * (`minTableWidth`) en lugar de comprimir columnas o recortar cifras.
 *
 * En movil (`< md`) la tabla se reemplaza por tarjetas apiladas: la misma
 * operacion (documento, paciente, fecha, total, estado y acciones) se lee sin
 * scroll horizontal. No se duplican datos ni reglas: ambos formatos comparten
 * el mismo `sort` local y los mismos componentes de accion y estado.
 */
export function RecibosTable({
  invoices,
  loadingActionInvoiceId,
  permissions,
  isOwnInvoiceFromToday,
  selectedInvoiceId = null,
  onOpenDetail,
  onOpenReceipt,
  onGenerateReceipt,
  onReprint,
  onCollect,
}: RecibosTableProps) {
  const [sort, setSort] = useState<AdminSortState | null>(null);
  // Orden local de la página visible; el servidor conserva su paginación.
  // La tabla y la lista móvil comparten exactamente la misma secuencia.
  const orderedInvoices = useMemo(() => sortInvoices(invoices, sort), [invoices, sort]);
  const columns: AdminColumn<Invoice>[] = [
    {
      key: 'document',
      header: 'Documento',
      className: 'min-w-[11rem]',
      sortable: true,
      sortValue: (row) => row.invoice_number,
      cell: (row) => <DocumentIdentity invoice={row} onOpenDetail={onOpenDetail} />,
    },
    {
      key: 'issued_at',
      header: 'Fecha',
      className: 'whitespace-nowrap',
      sortable: true,
      sortValue: (row) => issuedAtValue(row.issued_at),
      cell: (row) => (
        <time dateTime={row.issued_at} className="text-[color:var(--ui-ink-soft)]">
          {formatDateTimeEs(row.issued_at)}
        </time>
      ),
    },
    {
      key: 'patient_name',
      header: 'Paciente',
      sortable: true,
      sortValue: (row) => patientName(row),
      cell: (row) => (
        <span className="block max-w-56 [overflow-wrap:anywhere] font-medium text-[color:var(--ui-ink)]">
          {patientName(row)}
        </span>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      align: 'right',
      className: 'whitespace-nowrap',
      sortable: true,
      sortValue: (row) => parseCents(row.total),
      cell: (row) => <MoneyText cents={parseCents(row.total)} emphasis="strong" />,
    },
    {
      key: 'status',
      header: 'Estado',
      className: 'min-w-[10.5rem] whitespace-nowrap',
      sortable: true,
      sortValue: (row) => paymentStateView(row).label,
      cell: (row) => {
        const state = paymentStateView(row);
        // El cero legítimo («emisión sin cobro») se lee con el tinte del acento
        // y su etiqueta textual: nunca danger ni violeta (identidad §5).
        return (
          <StatusStamp
            status={state.status}
            label={state.label}
            className={state.status === 'gratuito' ? STATUS_SINCOBRO_STAMP_CLASS : undefined}
          />
        );
      },
    },
    {
      key: 'actions',
      header: 'Acciones',
      className: 'min-w-[9rem] whitespace-nowrap',
      cell: (row) => (
        <RecibosRowActions
          invoice={row}
          loadingActionInvoiceId={loadingActionInvoiceId}
          permissions={permissions}
          isOwnInvoiceFromToday={isOwnInvoiceFromToday}
          onCollect={onCollect}
          onGenerateReceipt={onGenerateReceipt}
          onOpenDetail={onOpenDetail}
          onOpenReceipt={onOpenReceipt}
          onReprint={onReprint}
        />
      ),
    },
  ];

  return (
    <>
      <div className="hidden md:block">
        <AdminTable<Invoice>
          caption="Operaciones filtradas"
          rows={orderedInvoices}
          columns={columns}
          getRowKey={(row) => String(row.id)}
          minTableWidth="44rem"
          mobileCards={false}
          sort={sort}
          onSortChange={setSort}
          onRowClick={(row) => onOpenDetail(row, null)}
          rowAriaLabel={(row) => `Abrir operación ${row.invoice_number} de ${patientName(row)}`}
          rowClassName={(row) =>
            row.id === selectedInvoiceId
              ? 'bg-[var(--ui-action-subtle)] hover:!bg-[var(--ui-action-subtle)]'
              : undefined
          }
          empty="Sin operaciones para mostrar."
        />
      </div>

      <div className="md:hidden">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--ui-line)] bg-[var(--ui-surface-alt)] px-4 py-2">
          <label
            htmlFor="recibos-mobile-sort"
            className="text-[length:var(--ui-text-xs)] font-medium text-[color:var(--ui-ink-soft)]"
          >
            Ordenar por
          </label>
          <select
            id="recibos-mobile-sort"
            className={cn(COMPACT_SELECT_CLASS, 'w-auto')}
            value={sortOptionValue(sort)}
            onChange={(event) => {
              const next = MOBILE_SORT_OPTIONS.find(
                (option) => sortOptionValue(option.sort) === event.target.value,
              );
              setSort(next?.sort ?? null);
            }}
          >
            {MOBILE_SORT_OPTIONS.map((option) => {
              const value = sortOptionValue(option.sort);
              return (
                <option key={value} value={value}>
                  {option.label}
                </option>
              );
            })}
          </select>
        </div>

        {orderedInvoices.length === 0 ? (
          <p className="p-4 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
            Sin operaciones para mostrar.
          </p>
        ) : (
          <ol aria-label="Operaciones en móvil" className="divide-y divide-[var(--ui-line)]">
            {orderedInvoices.map((invoice) => (
              <RecibosMobileCard
                key={invoice.id}
                invoice={invoice}
                selected={invoice.id === selectedInvoiceId}
                loadingActionInvoiceId={loadingActionInvoiceId}
                permissions={permissions}
                isOwnInvoiceFromToday={isOwnInvoiceFromToday}
                onCollect={onCollect}
                onGenerateReceipt={onGenerateReceipt}
                onOpenDetail={onOpenDetail}
                onOpenReceipt={onOpenReceipt}
                onReprint={onReprint}
              />
            ))}
          </ol>
        )}
      </div>
    </>
  );
}

type RecibosMobileCardProps = {
  invoice: Invoice;
  selected: boolean;
  loadingActionInvoiceId: number | null;
  permissions: RecibosBasePermissions;
  isOwnInvoiceFromToday: (invoice: Invoice) => boolean;
  onOpenDetail: (invoice: Invoice, trigger: HTMLElement | null) => void;
  onOpenReceipt: (invoice: Invoice) => void;
  onGenerateReceipt: (invoice: Invoice) => void;
  onReprint: (invoice: Invoice) => void;
  onCollect: (invoice: Invoice) => void;
};

/**
 * Tarjeta de operación para móvil. Aplana la fila en un bloque legible:
 * documento + tipo, estado de pago, paciente/fecha/total/comprobante y las
 * acciones autorizadas con objetivos táctiles de 44 px.
 */
function RecibosMobileCard({
  invoice,
  selected,
  loadingActionInvoiceId,
  permissions,
  isOwnInvoiceFromToday,
  onOpenDetail,
  onOpenReceipt,
  onGenerateReceipt,
  onReprint,
  onCollect,
}: RecibosMobileCardProps) {
  const doc = documentView(invoice);
  const state = paymentStateView(invoice);

  return (
    <li
      className={cn(
        'flex flex-col gap-3 p-4',
        selected && 'bg-[var(--ui-action-subtle)] shadow-[inset_3px_0_0_var(--ui-action)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            data-invoice-detail-trigger={invoice.id}
            className={cn(TABLE_IDENTITY_BUTTON, 'inline-flex min-h-11 items-center')}
            aria-label={`Ver detalle de la operación ${invoice.invoice_number}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetail(invoice, event.currentTarget);
            }}
          >
            {invoice.invoice_number}
          </button>
          <p className={cn('text-[length:var(--ui-text-xs)]', DOCUMENT_TONE[doc.kind])}>{doc.label}</p>
        </div>
        <StatusStamp
          status={state.status}
          label={state.label}
          className={state.status === 'gratuito' ? STATUS_SINCOBRO_STAMP_CLASS : undefined}
        />
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[length:var(--ui-text-sm)]">
        <div className="min-w-0">
          <dt className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Paciente</dt>
          <dd className="break-words font-medium text-[color:var(--ui-ink)]">{patientName(invoice)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Fecha</dt>
          <dd className="text-[color:var(--ui-ink-soft)]">{formatDateTimeEs(invoice.issued_at)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Total</dt>
          <dd>
            <MoneyText cents={parseCents(invoice.total)} className="font-semibold" />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Comprobante</dt>
          <dd className="break-words">
            {doc.receiptNumber ? (
              <span className="font-mono text-[length:var(--ui-text-xs)] font-semibold tabular-nums text-[color:var(--ui-ink)]">
                {doc.receiptNumber}
              </span>
            ) : (
              <span className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">{doc.detail}</span>
            )}
          </dd>
        </div>
      </dl>

      <RecibosRowActions
        invoice={invoice}
        layout="mobile"
        loadingActionInvoiceId={loadingActionInvoiceId}
        permissions={permissions}
        isOwnInvoiceFromToday={isOwnInvoiceFromToday}
        onCollect={onCollect}
        onGenerateReceipt={onGenerateReceipt}
        onOpenDetail={onOpenDetail}
        onOpenReceipt={onOpenReceipt}
        onReprint={onReprint}
      />
    </li>
  );
}

type RecibosRowActionsProps = {
  invoice: Invoice;
  loadingActionInvoiceId: number | null;
  permissions: RecibosBasePermissions;
  isOwnInvoiceFromToday: (invoice: Invoice) => boolean;
  onOpenDetail: (invoice: Invoice, trigger: HTMLElement | null) => void;
  onOpenReceipt: (invoice: Invoice) => void;
  onGenerateReceipt: (invoice: Invoice) => void;
  onReprint: (invoice: Invoice) => void;
  onCollect: (invoice: Invoice) => void;
  /** `mobile` apila acciones con objetivos táctiles de 44 px. */
  layout?: 'table' | 'mobile';
};

function RecibosRowActions({
  invoice,
  loadingActionInvoiceId,
  permissions,
  isOwnInvoiceFromToday,
  onOpenDetail,
  onOpenReceipt,
  onGenerateReceipt,
  onReprint,
  onCollect,
  layout = 'table',
}: RecibosRowActionsProps) {
  const pendingMenuActionRef = useRef<(() => void) | null>(null);
  const policy = invoiceActionPolicy(invoice, {
    ...permissions,
    isOwnInvoiceFromToday: isOwnInvoiceFromToday(invoice),
  });
  const busy = loadingActionInvoiceId === invoice.id;
  const mobile = layout === 'mobile';

  const stop = (handler: () => void) => (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    handler();
  };

  type ActionDef = {
    key: string;
    label: string;
    icon: ReactNode;
    run: (trigger: HTMLElement | null) => void;
  };

  const available: ActionDef[] = [
    {
      key: 'detail',
      label: 'Detalle',
      icon: <FileTextIcon aria-hidden="true" className="size-4" />,
      run: (trigger) => onOpenDetail(invoice, trigger),
    },
  ];

  if (policy.openReceipt) {
    available.push({
      key: 'receipt',
      label: 'Ver recibo',
      icon: <ReceiptIcon aria-hidden="true" className="size-4" />,
      run: () => onOpenReceipt(invoice),
    });
  } else if (policy.generateInstitutionalReceipt) {
    available.push({
      key: 'generate',
      label: 'Generar PDF',
      icon: <ReceiptIcon aria-hidden="true" className="size-4" />,
      run: () => onGenerateReceipt(invoice),
    });
  }

  if (policy.reprint && !policy.openReceipt) {
    available.push({
      key: 'reprint',
      label: 'Reimprimir',
      icon: <PrinterIcon aria-hidden="true" className="size-4" />,
      run: () => onReprint(invoice),
    });
  }

  if (policy.collectPayment) {
    available.push({
      key: 'collect',
      label: 'Cobrar',
      icon: null,
      run: () => onCollect(invoice),
    });
  }

  // La tarjeta móvil mantiene los objetivos táctiles apilados (44 px).
  if (mobile) {
    const secondaryButton = cn(SECONDARY_BUTTON, 'min-h-11 flex-1');

    return (
      <div className="flex flex-wrap gap-1.5">
        {available.map((action) =>
          action.key === 'reprint' ? (
            <button
              key={action.key}
              type="button"
              className={ICON_BUTTON_TOUCH}
              aria-label={`Reimprimir comprobante de la operación ${invoice.invoice_number}`}
              title="Reimprimir"
              disabled={busy}
              onClick={stop(() => action.run(null))}
            >
              {action.icon}
            </button>
          ) : (
            <button
              key={action.key}
              type="button"
              className={secondaryButton}
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation();
                action.run(event.currentTarget);
              }}
            >
              {action.icon}
              {action.label}
            </button>
          ),
        )}
      </div>
    );
  }

  // Escritorio: UNA acción contextual principal por fila; el resto, en un menú
  // accesible «⋯». Evita apilar cuatro botones en una celda estrecha. Ninguna
  // fila usa el acento sólido: «Cobrar» no compite con la jerarquía de acciones
  // de la página ni se repite como azul registro a registro.
  const order = ['collect', 'receipt', 'generate', 'reprint', 'detail'];
  const primaryKey = order.find((key) => available.some((action) => action.key === key)) ?? 'detail';
  const primary = available.find((action) => action.key === primaryKey) ?? available[0];
  const secondary = available.filter((action) => action.key !== primary.key);

  return (
    <div className="flex items-center justify-end gap-1.5">
      <button
        type="button"
        className={ROW_ACTION_BUTTON}
        disabled={busy}
        data-row-primary-action={primary.key}
        aria-label={primary.label}
        onClick={(event) => {
          event.stopPropagation();
          primary.run(event.currentTarget);
        }}
      >
        {primary.icon}
        {primary.label}
      </button>

      {secondary.length > 0 ? (
        <AdminMenuRoot>
          <AdminMenuTrigger asChild>
            <button
              type="button"
              className={ICON_BUTTON}
              aria-label={`Más acciones de la operación ${invoice.invoice_number}`}
              title="Más acciones"
              disabled={busy}
              onClick={(event) => event.stopPropagation()}
            >
              <MoreHorizontalIcon aria-hidden="true" className="size-4" />
            </button>
          </AdminMenuTrigger>
          <AdminMenuContent
            align="end"
            onCloseAutoFocus={(event) => {
              const pendingAction = pendingMenuActionRef.current;
              if (!pendingAction) return;
              event.preventDefault();
              pendingMenuActionRef.current = null;
              queueMicrotask(pendingAction);
            }}
          >
            {secondary.map((action) => (
              <AdminMenuItem
                key={action.key}
                disabled={busy}
                onClick={(event) => event.stopPropagation()}
                onSelect={(event) => {
                  event.stopPropagation();
                  pendingMenuActionRef.current = () => action.run(null);
                }}
              >
                {action.icon}
                {action.label}
              </AdminMenuItem>
            ))}
          </AdminMenuContent>
        </AdminMenuRoot>
      ) : null}
    </div>
  );
}
