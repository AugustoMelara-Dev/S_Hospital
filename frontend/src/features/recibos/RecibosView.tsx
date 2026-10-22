import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cash, type Invoice } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/lib/utils';
import { useAdminSession } from '@/shell/admin/AdminSessionContext';
import {
  AdminCallout,
  AdminChip,
  AdminEmpty,
  AdminPageHeader,
  AdminPanel,
} from '@/design-system/admin/components';
import type { InvoiceActionPermissions } from '@/modules/invoices/application/invoiceActionPolicy';
import { useInvoiceHistoryQuery } from '@/features/invoices/history/useInvoiceHistoryQuery';
import { useInvoiceHistoryDetail } from '@/features/invoices/history/useInvoiceHistoryDetail';
import { useInvoiceHistoryActions } from '@/features/invoices/history/useInvoiceHistoryActions';
import { useInvoiceHistoryReceipts } from '@/features/invoices/history/useInvoiceHistoryReceipts';
import { InvoiceHistoryActionDialogs } from '@/features/invoices/history/InvoiceHistoryActionDialogs';
import { InvoiceHistoryReceiptDialog } from '@/features/invoices/history/InvoiceHistoryReceiptDialog';
import { InvoicePagination } from '@/features/invoices/history/InvoicePagination';
import { localDateString } from '@/features/invoices/history/invoiceHistoryParams';
import { PaymentModal } from '@/features/invoices/components/PaymentModal';
import { RecibosFilters } from './RecibosFilters';
import { RecibosTable, type RecibosBasePermissions } from './RecibosTable';
import { RecibosDetailPanel } from './RecibosDetailPanel';
import {
  activeFilterChips,
  printInfoText,
  resultCountLabel,
  resultRangeLabel,
} from './recibosModel';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from './recibosUi';

/**
 * Recibos — composición nueva del panel: encabezado de página con el contexto
 * (resultado y filtros aplicados), un único espacio de trabajo cuya cabecera es
 * la barra de búsqueda/filtros integrada, la tabla como cuerpo y la paginación
 * al pie. El detalle acompaña como columna lateral en `2xl`; por debajo aparece
 * antes de la lista para que la operación seleccionada quede visible de inmediato.
 *
 * Encontrar una operacion por paciente, numero, fecha, estado o caja
 * autorizada; abrir su detalle conectado a la operacion y sus pagos; recuperar
 * o reimprimir el comprobante ya emitido. Ni la primera impresion ni la
 * reimpresion generan cobros ni numeros nuevos: reutilizan el generador y los
 * contratos existentes (motivo durable, contador del servidor).
 */
export function RecibosView() {
  const { user, has, onStatus } = useAdminSession();

  const canViewInvoices = has('invoices.view');
  const canViewReceipts = has('receipts.view');
  const canCollectPayment = has('payments.create');
  const canIssueInstitutionalReceipt = canViewReceipts && has('payments.create');
  const canReprint = has('receipts.reprint');
  const canReprintAny = has('receipts.reprint_any');
  const canReverse = has('invoices.reverse');
  const canVoid = has('invoices.void');
  const canOperateAnyInvoice = has('invoices.operate_any');
  const canFilterCash = has('cash.view');

  const historySectionRef = useRef<HTMLElement | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const query = useInvoiceHistoryQuery({ detailParam: 'operacion' });
  const detail = useInvoiceHistoryDetail({
    detailInvoiceId: query.detailInvoiceId,
    detailParam: 'operacion',
    historySectionRef,
    invoicesList: query.invoicesList,
    searchParams: query.searchParams,
    setSearchParams: query.setSearchParams,
  });
  const receipts = useInvoiceHistoryReceipts({
    selectedInvoice,
    setSelectedInvoice,
    onStatus,
    synchronizeDetailInvoice: detail.synchronizeDetailInvoice,
  });
  const actions = useInvoiceHistoryActions({
    selectedInvoice,
    setSelectedInvoice,
    synchronizeDetailInvoice: detail.synchronizeDetailInvoice,
    clearReceipt: receipts.clearReceipt,
    onStatus,
  });

  const cashSessionsQuery = useQuery({
    queryKey: [...queryKeys.cashSessions.all, 'recibos-filter'],
    queryFn: () => cash.getCashSessions({ perPage: 50 }),
    enabled: canFilterCash,
    staleTime: 60_000,
  });
  function isOwnInvoiceFromToday(invoice: Invoice): boolean {
    const issuedDate = localDateString(new Date(invoice.issued_at));

    return invoice.issuer?.id === user.id && issuedDate === localDateString();
  }

  const basePermissions: RecibosBasePermissions = {
    canCollectPayment,
    canIssueInstitutionalReceipt,
    canOperateAnyInvoice,
    canReprint,
    canReprintAny,
    canReverse,
    canViewReceipt: canViewReceipts,
    canVoid,
  };

  const detailPermissions: InvoiceActionPermissions | null = detail.detailInvoice
    ? {
        ...basePermissions,
        isOwnInvoiceFromToday: isOwnInvoiceFromToday(detail.detailInvoice),
      }
    : null;

  const selectedPrintInfo = selectedInvoice?.institutional_receipt
    ? printInfoText(null, selectedInvoice.institutional_receipt.copy_mode)
    : null;

  if (!canViewInvoices && !canViewReceipts) {
    return (
      <section aria-labelledby="recibos-title" className="flex flex-col gap-5">
        <AdminPageHeader headingId="recibos-title" title="Recibos" />
        <AdminCallout tone="error" title="Sin permiso para consultar recibos">
          Su rol no permite consultar operaciones ni comprobantes. Solicite acceso a Recibos a un administrador.
        </AdminCallout>
      </section>
    );
  }

  const showEmptyWithoutFilters = query.isEmpty && !query.hasActiveFilters && !query.loading && !query.loadError;
  const filterChips = query.hasActiveFilters ? activeFilterChips(query.filters) : [];

  return (
    <section
      ref={historySectionRef}
      id="recibos"
      aria-labelledby="recibos-title"
      tabIndex={-1}
      className="flex min-w-0 flex-col gap-5"
    >
      <AdminPageHeader
        headingId="recibos-title"
        title="Recibos"
        description="Historial de operaciones y comprobantes. Abra una operación para revisar su cuenta, sus pagos y el documento emitido."
        meta={
          <>
            <span aria-live="polite">
              <AdminChip tone={query.hasActiveFilters ? 'accent' : 'neutral'}>
                {query.loading ? 'Buscando…' : resultCountLabel(query.meta.total)}
              </AdminChip>
            </span>
            {filterChips.map((chip) => (
              <AdminChip key={chip.key}>{chip.label}</AdminChip>
            ))}
          </>
        }
      />

      <div
        className={cn(
          'grid min-w-0 gap-5',
          query.detailInvoiceId > 0 && '2xl:grid-cols-[minmax(0,1fr)_420px]',
        )}
      >
        <AdminPanel as="section" role="region" aria-label="Resultados del historial" className="order-2 min-w-0 overflow-hidden 2xl:order-1">
          <RecibosFilters
            filters={query.filters}
            hasActiveFilters={query.hasActiveFilters}
            loading={query.loading}
            canFilterByCash={canFilterCash}
            cashSessions={cashSessionsQuery.data?.data ?? []}
            cashSessionsLoading={canFilterCash && cashSessionsQuery.isLoading}
            onApply={query.applyFilters}
            onClear={query.clearFilters}
          />

          {query.refreshError ? (
            <div className="border-b border-[var(--ui-line)] p-4">
              <AdminCallout tone="warn" title="No se pudo actualizar el historial">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{query.refreshError}</span>
                  <button type="button" className={SECONDARY_BUTTON} onClick={() => void query.refetch()}>
                    Reintentar
                  </button>
                </div>
              </AdminCallout>
            </div>
          ) : null}

          {query.loadError ? (
            <div className="p-4">
              <AdminCallout tone="error" title="No se pudo cargar el historial">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{query.loadError}</span>
                  <button type="button" className={SECONDARY_BUTTON} onClick={() => void query.refetch()}>
                    Reintentar
                  </button>
                </div>
              </AdminCallout>
            </div>
          ) : query.loading && query.isEmpty ? (
            <div role="status" className="flex flex-col gap-2 p-4" aria-label="Cargando operaciones">
              {/*
               * Esqueleto (identidad §5): barras con el delta de los dos tonos
               * del sistema (`--ui-skel-from → --ui-skel-to`) y pulso de
               * opacidad; sin barrido de gradiente luminoso («shimmer»).
               */}
              {[0, 1, 2, 3].map((row) => (
                <div key={row} aria-hidden="true" className="flex flex-col gap-2 rounded-[var(--ui-radius)] bg-[var(--ui-surface-alt)] px-3 py-2.5">
                  <div className="h-3 w-40 ui-skel rounded-full bg-[image:linear-gradient(90deg,var(--ui-skel-from),var(--ui-skel-to))]" />
                  <div className="h-2.5 w-64 ui-skel rounded-full bg-[image:linear-gradient(90deg,var(--ui-skel-to),var(--ui-skel-from))]" />
                </div>
              ))}
              <span className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
                Cargando operaciones…
              </span>
            </div>
          ) : showEmptyWithoutFilters ? (
            <div className="p-4">
              <AdminEmpty
                title="Aún no hay operaciones registradas"
                description="Cuando se emita la primera operación aparecerá aquí con su comprobante y estado de pago."
                action={
                  has('invoices.create') ? (
                    <Link to="/cobrar" className={PRIMARY_BUTTON}>
                      Cobrar
                    </Link>
                  ) : undefined
                }
              />
            </div>
          ) : query.isEmpty ? (
            <div className="p-4">
              <AdminEmpty
                title="Sin coincidencias con la búsqueda"
                description="No se encontraron operaciones con los filtros seleccionados. Ajuste el término, el rango de fechas o la caja."
                action={
                  <button type="button" className={SECONDARY_BUTTON} onClick={query.clearFilters}>
                    Limpiar filtros
                  </button>
                }
              />
            </div>
          ) : (
            <RecibosTable
              invoices={query.invoicesList}
              loadingActionInvoiceId={receipts.loadingActionInvoiceId}
              permissions={basePermissions}
              isOwnInvoiceFromToday={isOwnInvoiceFromToday}
              selectedInvoiceId={detail.detailInvoice?.id ?? query.detailInvoiceId}
              onOpenDetail={(invoice, trigger) => void detail.openInvoiceDetail(invoice, true, trigger)}
              onOpenReceipt={(invoice) => void receipts.openReceiptModal(invoice.id)}
              onGenerateReceipt={(invoice) => void receipts.generateInstitutionalReceipt(invoice.id)}
              onReprint={receipts.requestReprintInvoice}
              onCollect={actions.openPaymentCollection}
            />
          )}

          {!query.isEmpty && !query.loadError ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ui-line)] bg-[var(--ui-surface-alt)] px-4 py-2.5">
              <span className="text-[length:var(--ui-text-sm)] tabular-nums text-[color:var(--ui-ink-soft)]">
                {resultRangeLabel(query.meta)}
              </span>
              <InvoicePagination
                meta={query.meta}
                disabled={query.loading}
                onChange={(nextPage) => void query.changePage(nextPage)}
              />
            </div>
          ) : null}
        </AdminPanel>

        {query.detailInvoiceId > 0 ? (
          <RecibosDetailPanel
            key={query.detailInvoiceId}
            className="order-1 2xl:order-2"
            invoice={detail.detailInvoice}
            loading={detail.detailLoading}
            error={detail.detailError}
            loadingActionInvoiceId={receipts.loadingActionInvoiceId}
            permissions={
              detailPermissions ?? {
                ...basePermissions,
                isOwnInvoiceFromToday: false,
              }
            }
            printInfo={detail.detailInvoice?.institutional_receipt
              ? printInfoText(null, detail.detailInvoice.institutional_receipt.copy_mode)
              : null}
            onClose={detail.closeInvoiceDetail}
            onRetry={() => void detail.openInvoiceDetail(query.detailInvoiceId, false)}
            onOpenReceipt={(invoice) => void receipts.openReceiptModal(invoice.id)}
            onDownload={(invoice) => void receipts.downloadInstitutionalReceipt(invoice)}
            onGenerateReceipt={(invoice) => void receipts.generateInstitutionalReceipt(invoice.id)}
            onReprint={receipts.requestReprintInvoice}
            onPrepareAction={(invoice, action) => void actions.prepareInvoiceAction(invoice.id, action)}
            onCollect={actions.openPaymentCollection}
          />
        ) : null}
      </div>

      <InvoiceHistoryReceiptDialog
        open={receipts.receiptModalOpen}
        onOpenChange={receipts.setReceiptModalOpen}
        invoice={selectedInvoice}
        institutionalReceipt={receipts.selectedInstitutionalReceipt}
        receipt={receipts.receipt}
        loadingActionInvoiceId={receipts.loadingActionInvoiceId}
        onDownload={(invoice) => void receipts.downloadInstitutionalReceipt(invoice)}
        onPrintInstitutional={() => void receipts.printInstitutionalReceiptFromPreview()}
        onPrintLegacy={receipts.handleLegacyReceiptPrint}
        printInfo={selectedPrintInfo}
      />

      <InvoiceHistoryActionDialogs
        invoice={selectedInvoice}
        confirmingReprint={receipts.confirmingReprint}
        reprintingReceipt={receipts.reprintingReceipt}
        onCancelReprint={() => receipts.setConfirmingReprint(false)}
        onConfirmReprint={(reason) => void receipts.reprintSelectedInvoice(reason ?? '')}
        reprintPrintInfo={selectedPrintInfo}
        confirmingReceiptPrint={receipts.confirmingReceiptPrint}
        onCancelReceiptPrint={receipts.cancelLegacyReceiptPrint}
        onConfirmReceiptPrint={(reason) => void receipts.confirmLegacyReceiptPrint(reason ?? '')}
        confirmingVoid={actions.confirmingVoid}
        voidingInvoice={actions.voidingInvoice}
        voidReason={actions.voidReason}
        voidReasonError={actions.voidReasonError}
        onVoidReasonChange={(value) => {
          actions.setVoidReason(value);
          if (actions.voidReasonError && value.trim().length >= 5) actions.setVoidReasonError('');
        }}
        onCancelVoid={() => {
          actions.setConfirmingVoid(false);
          actions.setVoidReason('');
          actions.setVoidReasonError('');
        }}
        onConfirmVoid={() => void actions.voidSelectedInvoice()}
        confirmingReverse={actions.confirmingReverse}
        reversingInvoice={actions.reversingInvoice}
        reverseReason={actions.reverseReason}
        reverseReasonError={actions.reverseReasonError}
        onReverseReasonChange={(value) => {
          actions.setReverseReason(value);
          if (actions.reverseReasonError && value.trim().length >= 5) actions.setReverseReasonError('');
        }}
        onCancelReverse={() => {
          actions.setConfirmingReverse(false);
          actions.setReverseReason('');
          actions.setReverseReasonError('');
        }}
        onConfirmReverse={() => void actions.reverseSelectedInvoice()}
      />

      {actions.collectionInvoice ? (
        <PaymentModal
          open
          onOpenChange={(open) => {
            if (!open && !actions.collectingPayment) {
              actions.setCollectionInvoice(null);
              actions.setCollectionError(null);
            }
          }}
          invoiceNumber={actions.collectionInvoice.invoice_number}
          patientName={actions.collectionInvoice.patient_name}
          total={actions.collectionInvoice.total}
          balanceDue={actions.collectionInvoice.balance_due}
          paymentMethod={actions.collectionMethod}
          paymentAmount={actions.collectionAmount}
          paymentReference={actions.collectionReference}
          onPaymentMethodChange={(method) => {
            actions.setCollectionMethod(method);
            actions.setCollectionError(null);
          }}
          onPaymentAmountChange={(amount) => {
            actions.setCollectionAmount(amount);
            actions.setCollectionError(null);
          }}
          onPaymentReferenceChange={(reference) => {
            actions.setCollectionReference(reference);
            actions.setCollectionError(null);
          }}
          onConfirm={(amount) => void actions.collectInvoicePayment(amount)}
          submitting={actions.collectingPayment}
          errorMessage={actions.collectionError}
        />
      ) : null}
    </section>
  );
}
