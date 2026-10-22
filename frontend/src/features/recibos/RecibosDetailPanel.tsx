import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { InfoIcon, XIcon } from 'lucide-react';
import type { Invoice, InvoiceItem } from '@/lib/api';
import { parseCents, parseQuantityUnits } from '@/lib/moneyCents';
import { formatDateTimeEs } from '@/lib/format/formatDate';
import { cn } from '@/lib/utils';
import {
  FreeMedicationBadge,
  AdminCallout,
  AdminTable,
  MoneyText,
  QuantityText,
  StatusStamp,
  type AdminColumn,
} from '@/design-system/admin/components';
import {
  invoiceActionPolicy,
  type InvoiceActionPermissions,
} from '@/modules/invoices/application/invoiceActionPolicy';
import {
  LINE_ADJUSTMENT_UNAVAILABLE,
  documentView,
  itemAdjustmentLabel,
  lineAdjustmentView,
  paymentMethodLabel,
  paymentStateView,
  paymentStatusLabel,
} from './recibosModel';
import {
  DANGER_BUTTON,
  ICON_BUTTON,
  MICRO_LABEL,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SECTION_TITLE,
  STATUS_SINCOBRO_STAMP_CLASS,
} from './recibosUi';

type RecibosDetailPanelProps = {
  className?: string;
  invoice: Invoice | null;
  loading: boolean;
  error: string;
  loadingActionInvoiceId: number | null;
  permissions: InvoiceActionPermissions;
  printInfo: string | null;
  onClose: () => void;
  onRetry: () => void;
  onOpenReceipt: (invoice: Invoice) => void;
  onDownload: (invoice: Invoice) => void;
  onGenerateReceipt: (invoice: Invoice) => void;
  onReprint: (invoice: Invoice) => void;
  onPrepareAction: (invoice: Invoice, action: 'void' | 'reverse') => void;
  onCollect: (invoice: Invoice) => void;
};

/**
 * Panel lateral de detalle: identidad de la operación arriba (número, paciente y
 * estado), la cuenta —líneas y resumen monetario juntos, sin párrafos en medio—
 * y, después, los pagos y el documento emitido. La información secundaria
 * (emisión, usuario, caja, contadores del comprobante) queda agrupada en su
 * propia banda en lugar de sembrada entre las secciones.
 *
 * La composición es de lectura vertical por secciones separadas por hairline
 * (no una pila de tarjetas): el encabezado y el pie de acciones permanecen
 * visibles y solo el cuerpo se desplaza. En `2xl` acompaña a la tabla como
 * columna lateral con ancho útil; por debajo aparece antes de la lista a ancho
 * completo, donde la tabla de líneas deja de desplazarse. El backend sigue siendo la autoridad;
 * aquí solo se dibuja y se solicita. Se abre con deep link `?operacion=<id>` y
 * cierra con Esc/foco devuelto al disparador.
 */
export function RecibosDetailPanel({
  className,
  invoice,
  loading,
  error,
  loadingActionInvoiceId,
  permissions,
  printInfo,
  onClose,
  onRetry,
  onOpenReceipt,
  onDownload,
  onGenerateReceipt,
  onReprint,
  onPrepareAction,
  onCollect,
}: RecibosDetailPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const policy = invoice ? invoiceActionPolicy(invoice, permissions) : null;
  const busy = Boolean(invoice && loadingActionInvoiceId === invoice.id);
  const state = invoice ? paymentStateView(invoice) : null;
  const doc = invoice ? documentView(invoice) : null;
  const showContent = Boolean(invoice && state) && !loading && !error;
  const discountCents = invoice ? parseCents(invoice.discount_amount) : null;

  // En anchos menores a 2xl el detalle se coloca antes de la lista. Al abrirlo
  // se lleva al inicio visible y recibe foco; en el diseño lateral 2xl conserva
  // la posición de la tabla y solo mueve el foco accesible.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const isLateral = typeof window.matchMedia === 'function'
      && window.matchMedia('(min-width: 1536px)').matches;
    panel.focus({ preventScroll: isLateral });
    if (!isLateral) panel.scrollIntoView?.({ block: 'start' });
  }, []);

  // La respuesta completa puede ampliar el panel después del foco inicial.
  // Mantener visible su cabecera sin desplazar a quien ya empezó otra tarea.
  useEffect(() => {
    const panel = panelRef.current;
    if (loading || !panel || document.activeElement !== panel) return;
    const isLateral = typeof window.matchMedia === 'function'
      && window.matchMedia('(min-width: 1536px)').matches;
    if (!isLateral) panel.scrollIntoView?.({ block: 'start' });
  }, [loading, error]);

  // Una sola acción primaria en el pie (abrir/imprimir el comprobante) y el
  // resto como secundarias. El pie solo existe si hay algo autorizado: nunca
  // deja una franja vacía.
  const footerActions: ReactNode[] = [];
  if (showContent && invoice && policy) {
    if (policy.openReceipt) {
      footerActions.push(
        <button key="open" type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={() => onOpenReceipt(invoice)}>
          Ver / imprimir recibo
        </button>,
      );
    }
    if (policy.downloadInstitutionalReceipt) {
      footerActions.push(
        <button key="download" type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => onDownload(invoice)}>
          Descargar PDF
        </button>,
      );
    }
    if (policy.generateInstitutionalReceipt) {
      footerActions.push(
        <button key="generate" type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => onGenerateReceipt(invoice)}>
          Generar PDF
        </button>,
      );
    }
    if (policy.reprint) {
      footerActions.push(
        <button key="reprint" type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => onReprint(invoice)}>
          Reimprimir con motivo
        </button>,
      );
    }
    if (policy.collectPayment) {
      footerActions.push(
        <button key="collect" type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => onCollect(invoice)}>
          Cobrar saldo
        </button>,
      );
    }
    if (policy.void) {
      footerActions.push(
        <button
          key="void"
          type="button"
          className={DANGER_BUTTON}
          disabled={busy}
          onClick={() => onPrepareAction(invoice, 'void')}
        >
          Anular
        </button>,
      );
    }
    if (policy.reverse) {
      footerActions.push(
        <button
          key="reverse"
          type="button"
          className={DANGER_BUTTON}
          disabled={busy}
          onClick={() => onPrepareAction(invoice, 'reverse')}
        >
          Revertir
        </button>,
      );
    }
  }

  return (
    <aside
      ref={panelRef}
      aria-label="Detalle de la operación"
      tabIndex={-1}
      className={cn(
        'flex min-w-0 scroll-mt-20 flex-col overflow-hidden rounded-[var(--ui-radius-panel)] border border-[var(--ui-line)] bg-[var(--ui-surface)] lg:scroll-mt-4 2xl:sticky 2xl:top-4 2xl:max-h-[calc(100dvh-6rem)]',
        className,
      )}
    >
      <header className="border-b border-[var(--ui-line)] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className={MICRO_LABEL}>Operación</p>
            <h2 className="mt-0.5 break-words text-[length:var(--ui-text-lg)] font-semibold leading-tight tabular-nums text-[color:var(--ui-ink)]">
              {invoice ? invoice.invoice_number : 'Detalle de la operación'}
            </h2>
          </div>
          <button type="button" className={ICON_BUTTON} aria-label="Cerrar detalle" onClick={onClose}>
            <XIcon aria-hidden="true" className="size-4" />
          </button>
        </div>

        {invoice ? (
          <>
            <p className="mt-1.5 break-words text-[length:var(--ui-text-md)] font-semibold text-[color:var(--ui-ink)]">
              {invoice.patient_name?.trim() || 'Paciente sin nombre'}
            </p>
            {doc && state ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full border border-[var(--ui-line)] bg-[var(--ui-surface-alt)] px-2 py-0.5 text-[length:var(--ui-text-xs)] font-medium',
                    doc.kind === 'pending_receipt'
                      ? 'border-[var(--ui-warn-border)] bg-[var(--ui-warn-subtle)] text-[color:var(--ui-warn)]'
                      : 'text-[color:var(--ui-ink-soft)]',
                  )}
                >
                  {doc.label}
                </span>
                <StatusStamp
                  status={state.status}
                  label={state.label}
                  className={state.status === 'gratuito' ? STATUS_SINCOBRO_STAMP_CLASS : undefined}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {loading ? (
          <p role="status" className="px-4 py-6 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
            Cargando detalle de la operación…
          </p>
        ) : error ? (
          <div className="p-4">
            <AdminCallout tone="error" title="No se pudo cargar el detalle">
              <div className="flex flex-col gap-2">
                <span>{error}</span>
                <button type="button" className={SECONDARY_BUTTON} onClick={onRetry}>
                  Reintentar
                </button>
              </div>
            </AdminCallout>
          </div>
        ) : showContent && invoice && state ? (
          <>
            {invoice.status === 'void' && invoice.void_reason ? (
              <div className="border-b border-[var(--ui-line)] p-4">
                <AdminCallout tone="error" title="Operación anulada">
                  Motivo: {invoice.void_reason}
                </AdminCallout>
              </div>
            ) : null}

            <section aria-labelledby="recibos-detail-account" className="border-b border-[var(--ui-line)] px-4 py-3.5">
              <h3 id="recibos-detail-account" className={SECTION_TITLE}>
                Cuenta
              </h3>
              <div className="mt-2">
                <AdminTable<InvoiceItem>
                  caption="Líneas de la operación"
                  rows={invoice.items ?? []}
                  getRowKey={(item) => String(item.id)}
                  mobileCards={false}
                  minTableWidth="30rem"
                  empty="La operación no tiene líneas registradas."
                  columns={lineColumns}
                />
              </div>

              {/* Dos listas hermanas en vez de un dl con un div anidado: cada dl
                  sólo admite dt/dd directos (o un div que los contenga). El
                  hairline del desglose es el borde superior del segundo dl;
                  mismas clases que el div que había, mismo aspecto. */}
              <dl className="mt-3 border-t border-[var(--ui-line)] pt-1">
                <AmountRow label="Total" cents={parseCents(invoice.total)} strong />
                <AmountRow label="Pagado" cents={parseCents(invoice.paid_amount)} />
                <AmountRow
                  label="Saldo"
                  cents={parseCents(invoice.balance_due)}
                  strong={parseCents(invoice.balance_due) !== 0}
                />
              </dl>
              <dl className="mt-1 border-t border-[var(--ui-line)] pt-1">
                <AmountRow label="Subtotal" cents={parseCents(invoice.subtotal)} small />
                <AmountRow label="ISV" cents={parseCents(invoice.tax_amount)} small />
                {discountCents !== null && discountCents !== 0 ? (
                  <AmountRow label="Descuento" cents={discountCents} small />
                ) : null}
              </dl>
            </section>

            <section aria-labelledby="recibos-detail-payments" className="border-b border-[var(--ui-line)] px-4 py-3.5">
              <h3 id="recibos-detail-payments" className={SECTION_TITLE}>
                Pagos
              </h3>
              {invoice.payments && invoice.payments.length > 0 ? (
                <ul className="mt-2 divide-y divide-[var(--ui-line)] border-y border-[var(--ui-line)]">
                  {invoice.payments.map((payment) => (
                    <li key={payment.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-[length:var(--ui-text-base)] font-medium text-[color:var(--ui-ink)]">
                          {paymentMethodLabel(payment.method)} · {paymentStatusLabel(payment)}
                        </p>
                        <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                          {formatDateTimeEs(payment.paid_at)} · Registrado en caja
                          {payment.reference ? ` · Ref. ${payment.reference}` : ''}
                        </p>
                        {payment.status === 'void' && payment.void_reason ? (
                          <p className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                            Motivo: {payment.void_reason}
                          </p>
                        ) : null}
                      </div>
                      <MoneyText
                        cents={parseCents(payment.amount)}
                        className={payment.status === 'void' ? 'line-through text-[color:var(--ui-ink-soft)]' : undefined}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
                  Esta operación no tiene pagos registrados.
                </p>
              )}
            </section>

            <section aria-labelledby="recibos-detail-record" className="px-4 py-3.5">
              <h3 id="recibos-detail-record" className={SECTION_TITLE}>
                Documento y registro
              </h3>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-[length:var(--ui-text-sm)]">
                <MetaRow label="Emitida">{formatDateTimeEs(invoice.issued_at)}</MetaRow>
                <MetaRow label="Registrada por">{invoice.issuer?.name ?? 'Usuario no disponible'}</MetaRow>
                <MetaRow label="Caja">
                  {invoice.cash_session
                    ? `${invoice.cash_session.cash_register?.name ?? 'Caja del turno'}${invoice.cash_session.cash_register?.code ? ` · ${invoice.cash_session.cash_register.code}` : ''}${invoice.cash_session.user?.name ? ` · ${invoice.cash_session.user.name}` : ''}`
                    : 'Sin caja asociada'}
                </MetaRow>
                {invoice.institutional_receipt ? (
                  <>
                    <MetaRow label="Comprobante">{invoice.institutional_receipt.receipt_number_full}</MetaRow>
                    <MetaRow label="Estado del comprobante">
                      {invoice.institutional_receipt.status === 'issued' ? 'Emitido' : 'Anulado'}
                    </MetaRow>
                    <MetaRow label="Reimpresiones registradas">
                      <span className="tabular-nums">{invoice.institutional_receipt.reprint_count ?? 0}</span>
                    </MetaRow>
                    <MetaRow label="Impresiones registradas">
                      <span className="tabular-nums">
                        {invoice.institutional_receipt.print_events_count ??
                          (invoice.institutional_receipt.has_print_events ? 1 : 0)}
                      </span>
                    </MetaRow>
                  </>
                ) : (
                  <MetaRow label="Comprobante">
                    {doc?.detail ?? 'Sin comprobante institucional emitido'}
                  </MetaRow>
                )}
              </dl>
              {printInfo ? (
                <p className="mt-2.5 flex items-start gap-1.5 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                  <InfoIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  <span>{printInfo}</span>
                </p>
              ) : null}
            </section>
          </>
        ) : (
          <p className="px-4 py-6 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
            Seleccione una operación para ver su detalle.
          </p>
        )}
      </div>

      {footerActions.length > 0 ? (
        <footer className="flex flex-wrap gap-2 border-t border-[var(--ui-line)] bg-[var(--ui-surface-alt)] px-4 py-3">
          {footerActions}
        </footer>
      ) : null}
    </aside>
  );
}

const lineColumns: Array<AdminColumn<InvoiceItem>> = [
  {
    key: 'service',
    header: 'Concepto',
    cell: (item) => {
      // La regla aplicada ya la dice la etiqueta Sin cobro; no se repite como
      // párrafo dentro de la fila.
      const adjustment = item.special_rule_applied ? null : itemAdjustmentLabel(item);
      return (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="break-words font-medium text-[color:var(--ui-ink)]">{item.service_name}</span>
          {item.category_name ? (
            <span className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">{item.category_name}</span>
          ) : null}
          {item.special_rule_applied ? (
            // «La línea sin cobro» usa la receta del acento con etiqueta textual
            // (identidad §2): tinte translúcido cobalto, nunca violeta ni danger.
            <FreeMedicationBadge
              className={cn('w-fit', STATUS_SINCOBRO_STAMP_CLASS)}
              label="Sin cobro por receta"
            />
          ) : null}
          {adjustment ? (
            <span className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">{adjustment}</span>
          ) : null}
        </div>
      );
    },
  },
  {
    key: 'quantity',
    header: 'Cant.',
    align: 'center',
    className: 'whitespace-nowrap',
    cell: (item) => <QuantityText units={parseQuantityUnits(item.quantity)} />,
  },
  {
    key: 'unit_price',
    header: 'Precio',
    align: 'right',
    className: 'whitespace-nowrap',
    cell: (item) => <MoneyText cents={parseCents(item.unit_price)} />,
  },
  {
    key: 'adjustment',
    header: 'Ajuste',
    align: 'right',
    cell: (item) => <LineAdjustmentCell item={item} />,
  },
  {
    key: 'line_total',
    header: 'Importe',
    align: 'right',
    className: 'whitespace-nowrap',
    cell: (item) => <MoneyText cents={parseCents(item.line_total)} />,
  },
];

/**
 * Ajuste real de la línea, o el dato declarado como no disponible. Nunca se
 * pinta `L 0.00` para representar un campo ausente, y nunca se deduce el
 * descuento desde el precio actual del catálogo.
 */
function LineAdjustmentCell({ item }: { item: InvoiceItem }) {
  const adjustment = lineAdjustmentView(item);

  if (adjustment.kind === 'adjustment') {
    const tone = item.special_rule_applied
      ? 'text-[color:var(--ui-action)]'
      : 'text-[color:var(--ui-ink)]';

    return (
      <span className={cn('inline-flex items-baseline gap-1 whitespace-nowrap tabular-nums', tone)}>
        <span className="sr-only">Ajuste por regla: menos</span>
        <span aria-hidden="true">−</span>
        <MoneyText cents={adjustment.cents} className={tone} />
      </span>
    );
  }

  if (adjustment.kind === 'unavailable') {
    return (
      <span className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
        {LINE_ADJUSTMENT_UNAVAILABLE}
      </span>
    );
  }

  return <span aria-hidden="true" className="text-[color:var(--ui-ink-soft)]">—</span>;
}

function AmountRow({
  label,
  cents,
  strong = false,
  small = false,
}: {
  label: string;
  cents: number | null;
  strong?: boolean;
  small?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <dt
        className={cn(
          'text-[length:var(--ui-text-sm)]',
          small ? 'text-[color:var(--ui-ink-soft)]' : 'text-[color:var(--ui-ink)]',
        )}
      >
        {label}
      </dt>
      <dd>
        <MoneyText cents={cents} emphasis={strong ? 'strong' : 'normal'} className={small ? 'text-[color:var(--ui-ink-soft)]' : undefined} />
      </dd>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[length:var(--ui-text-xs)] font-medium uppercase tracking-[0.06em] text-[color:var(--ui-ink-faint)]">
        {label}
      </dt>
      <dd className="mt-0.5 break-words tabular-nums text-[color:var(--ui-ink)]">{children}</dd>
    </div>
  );
}
