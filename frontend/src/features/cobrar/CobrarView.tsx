import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { apiClient, type Payment, type Service } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { formatDateTimeEs } from '@/lib/format/formatDate';
import { SERVICES_SEARCH_DEBOUNCE_MS, useServices } from '@/hooks/useServices';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import {
  AdminChip,
  AdminPageHeader,
  AdminPanel,
  AdminPanelHeader,
  MoneyText,
  StatusStamp,
} from '@/design-system/admin/components';
import { useAdminSession } from '@/shell/admin/AdminSessionContext';
import { useCartRevisionGuard } from '@/features/invoices/hooks/useCartRevisionGuard';
import { collectCartIssues } from '@/features/invoices/state/posMath';
import { serverPreviewBlockReason } from '@/features/invoices/state/serverPreview';
import {
  addOrIncrementLine,
  buildCobrarPayload,
  cartSignature,
  conditionActive,
  hasEligibleMedication,
  removeLine,
  signatureHash,
  toggleCondition,
  updateLineQuantity,
} from './state/domain';
import { deriveCobrarStatus } from './state/status';
import { cobrarPatientSchema, normalizePatientName, type CobrarPatientFormData } from './cobrarSchema';
import type { CobrarLine } from './state/types';
import { useCobrarPreview } from './hooks/useCobrarPreview';
import { useCobrarEmission } from './hooks/useCobrarEmission';
import { useCobrarReceiptActions } from './hooks/useCobrarReceiptActions';
import { useCobrarDocumentPreview } from './hooks/useCobrarDocumentPreview';
import { PatientZone } from './components/PatientZone';
import { CatalogZone } from './components/CatalogZone';
import { AccountZone } from './components/AccountZone';
import { SummaryActionZone } from './components/SummaryActionZone';
import { ConfirmDialog } from './components/ConfirmDialog';
import { ResultZone } from './components/ResultZone';
import { DocumentPreviewDialog } from './components/DocumentPreviewDialog';
import { PRIMARY_BUTTON, cobrarStamp } from './components/cobrarUi';

/**
 * Cobrar: Estación Dominante de Facturación y Liquidación Hospitalaria.
 *
 * Arquitectura de Cuenta Continua Vertical (Propuesta A depurada):
 * 1. Paciente: único dato personal obligatorio (Nombre del paciente).
 * 2. Inserción rápida: buscador amplio por nombre/código y accesos rápidos reales.
 * 3. Líneas de la Cuenta (Ledger): tabla contable a todo lo ancho con stepper táctil accesible.
 * 4. Resumen Monetario: totales autorizados por el servidor con centavos exactos.
 * 5. Cobro y Comprobante: confirmación deliberada con cálculo de cambio, desacoplada de impresión.
 */
export function CobrarView() {
  const { has, cashSession, cashSessionLoading, onStatus } = useAdminSession();
  const canViewCatalog = has('catalog.view');
  const canCreatePayments = has('payments.create');
  const canViewReceipts = has('receipts.view');
  const canMarkDialysisPrescription = has('patients.mark_dialysis_prescription');

  const form = useForm<CobrarPatientFormData>({
    resolver: zodResolver(cobrarPatientSchema),
    defaultValues: { patient_name: '' },
    mode: 'onChange',
  });
  const patientName = form.watch('patient_name') ?? '';

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | 'all'>('all');
  const [lines, setLines] = useState<CobrarLine[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [method, setMethod] = useState<Payment['method']>('cash');
  const [reference, setReference] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [summaryActionVisible, setSummaryActionVisible] = useState(true);
  const summaryActionRef = useRef<HTMLDivElement>(null);
  const debouncedSearch = useDebouncedValue(search, SERVICES_SEARCH_DEBOUNCE_MS);

  const revision = useMemo(
    () => signatureHash(cartSignature(lines, patientName)),
    [lines, patientName],
  );
  const revisionGuard = useCartRevisionGuard(revision);
  const eligibleMedication = hasEligibleMedication(lines);
  const isConditionActive = conditionActive(lines);
  const lineIssue = useMemo(() => collectCartIssues(lines)[0]?.message ?? null, [lines]);

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories.list(true),
    queryFn: () => apiClient.getCategories(true),
    enabled: canViewCatalog,
  });

  const servicesQuery = useServices(
    {
      active: true,
      billing: true,
      search: debouncedSearch.trim() || undefined,
      categoryId: categoryId === 'all' ? undefined : categoryId,
      perPage: 30,
    },
    { enabled: canViewCatalog },
  );
  const catalogUpdating = debouncedSearch !== search || servicesQuery.isPlaceholderData;
  const services = catalogUpdating ? [] : (servicesQuery.data?.data ?? []);

  const { preview, previewing, previewError, previewRevision } = useCobrarPreview({
    lines,
    patientName,
    canMarkDialysisPrescription,
    enabled: canViewCatalog && lineIssue === null,
    revision,
    reloadToken,
  });
  const previewMatchesRevision = preview !== null && previewRevision === revision;

  const emission = useCobrarEmission({
    cashSessionId: cashSession?.id ?? null,
    canCreatePayments,
    canViewReceipts,
    onStatus,
  });
  const receiptActions = useCobrarReceiptActions({
    receipt: emission.result?.receipt ?? null,
    onStatus,
  });
  const documentPreview = useCobrarDocumentPreview();
  const accountLocked = emission.submitting || emission.invoiceResolutionPending;
  const canPreviewDocument =
    !accountLocked
    && normalizePatientName(patientName).length > 0
    && lines.length > 0
    && lineIssue === null
    && previewMatchesRevision
    && preview !== null
    && serverPreviewBlockReason(preview) === null;

  const status = deriveCobrarStatus({
    patientName,
    lineCount: lines.length,
    hasCashSession: Boolean(cashSession),
    cashSessionLoading,
    canCreatePayments,
    preview,
    previewing,
    previewError,
    lineIssue,
    previewMatchesRevision,
    submitting: emission.submitting,
    result: emission.result,
  });
  const stamp = cobrarStamp(status);

  const showResult = emission.result !== null && emission.result.outcome !== 'pending';

  useEffect(() => {
    if (showResult) return;

    const summaryAction = summaryActionRef.current;
    if (!summaryAction || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => setSummaryActionVisible(entry?.isIntersecting ?? false),
      { threshold: 0.01 },
    );
    observer.observe(summaryAction);

    return () => observer.disconnect();
  }, [showResult]);

  function addService(service: Service) {
    setActionError(null);
    setLines((current) => addOrIncrementLine(current, service));
    onStatus({ message: `Agregado: ${service.name}`, level: 'success', key: 'cobrar-catalog', toast: false });
  }

  function addFirstFromSearch() {
    const first = services[0];

    if (!first) {
      setActionError('No hay resultados para agregar. Ajuste la búsqueda o la categoría.');
      return;
    }

    addService(first);
  }

  function handleRetryPreview() {
    setActionError(null);
    setReloadToken((token) => token + 1);
  }

  function handleConfirmClick() {
    if (!status.canConfirm) return;

    setActionError(null);
    revisionGuard.capture(status.totalCents);
    setConfirmOpen(true);
  }

  function handleDocumentPreview() {
    if (!canPreviewDocument) return;

    void documentPreview.load(
      buildCobrarPayload({ lines, patientName, canMarkDialysisPrescription }),
    );
  }

  async function handleDialogConfirm() {
    if (emission.result?.outcome === 'pending') {
      const outcome = await emission.retryPayment(method, reference);

      if (!outcome.ok) setActionError(outcome.message);
      setConfirmOpen(false);
      return;
    }

    const confirmed = revisionGuard.consume();

    if (confirmed !== null && revisionGuard.hasCartChangedSince(confirmed.revision)) {
      setConfirmOpen(false);
      setActionError('La cuenta cambió después de revisarla. Revise el total actualizado y confirme de nuevo.');
      return;
    }

    if (!status.canConfirm) {
      setConfirmOpen(false);
      return;
    }

    const outcome = await emission.submit({
      payload: buildCobrarPayload({ lines, patientName, canMarkDialysisPrescription }),
      method,
      reference,
    });

    if (!outcome.ok) setActionError(outcome.message);
    setConfirmOpen(false);
  }

  function handleNewOperation() {
    emission.reset();
    setLines([]);
    form.reset({ patient_name: '' });
    setSearch('');
    setCategoryId('all');
    setMethod('cash');
    setReference('');
    setConfirmOpen(false);
    setActionError(null);
    window.setTimeout(() => form.setFocus('patient_name'), 0);
  }

  return (
    <section className="flex min-w-0 flex-col gap-4 pb-24 lg:pb-0" aria-labelledby="cobrar-title">
      <AdminPageHeader
        headingId="cobrar-title"
        title="Cobrar"
        meta={
          <>
            {cashSessionLoading ? (
              <AdminChip>Consultando caja…</AdminChip>
            ) : cashSession ? (
              <AdminChip tone="success">
                <span className="size-1.5 rounded-full bg-[var(--ui-success)] animate-pulse" />
                <span>Caja abierta</span>
                {cashSession.opened_at ? (
                  <span className="tabular-nums text-[color:var(--ui-ink-soft)]">
                    · desde {formatDateTimeEs(cashSession.opened_at)}
                  </span>
                ) : null}
              </AdminChip>
            ) : (
              <AdminChip tone="neutral">Sin caja abierta</AdminChip>
            )}
            {!showResult && lines.length > 0 ? (
              <AdminChip tone="accent">
                {lines.length} {lines.length === 1 ? 'concepto' : 'conceptos'} en cuenta
              </AdminChip>
            ) : null}
          </>
        }
      />

      {showResult && emission.result ? (
        <ResultZone
          result={emission.result}
          onNewOperation={handleNewOperation}
          onPrint={() => void receiptActions.print()}
          onSavePdf={() => void receiptActions.savePdf()}
          printing={receiptActions.printing}
          saving={receiptActions.saving}
        />
      ) : (
        /* Workspace continuo vertical: Propuesta A depurada
           Secuencia continua: Paciente -> Búsqueda / Inserción rápida -> Líneas contables (Ledger) -> Resumen monetario -> Cobro */
        <div className="flex min-w-0 flex-col">
          <AdminPanel
            as="section"
            aria-labelledby="cobrar-account-title"
            className="flex min-w-0 flex-col overflow-hidden border border-[var(--ui-line-strong)] bg-[var(--ui-surface)] shadow-none"
          >
            <AdminPanelHeader
              headingLevel={2}
              id="cobrar-account-title"
              title="Cuenta"
              actions={<StatusStamp status={stamp.status} label={stamp.label} />}
            />

            {/* 1. Paciente (único dato personal requerido) */}
            <div className="border-b border-[var(--ui-line)] bg-[var(--ui-surface)]">
              <PatientZone form={form} disabled={accountLocked} />
            </div>

            {/* 2. Punto de inserción ágil y búsqueda en catálogo */}
            <div className="border-b border-[var(--ui-line)] bg-[var(--ui-surface)]">
              <CatalogZone
                canViewCatalog={canViewCatalog}
                search={search}
                onSearchChange={setSearch}
                categoryId={categoryId}
                onCategoryChange={setCategoryId}
                categories={categoriesQuery.data ?? []}
                services={services}
                loading={servicesQuery.isLoading || catalogUpdating}
                disabled={accountLocked}
                error={
                  servicesQuery.isError
                    ? 'No se pudo cargar el catálogo. Revise la conexión y vuelva a intentar.'
                    : null
                }
                onRetry={() => void servicesQuery.refetch()}
                onAddFirst={addFirstFromSearch}
                onAdd={addService}
              />
            </div>

            {/* 3. Líneas de la cuenta contable continua (Ledger) */}
            <AccountZone
              lines={lines}
              canMarkDialysisPrescription={canMarkDialysisPrescription}
              hasEligibleMedication={eligibleMedication}
              conditionActive={isConditionActive}
              preview={preview}
              previewMatchesRevision={previewMatchesRevision}
              disabled={accountLocked}
              onToggleCondition={(checked) => setLines((current) => toggleCondition(current, checked))}
              onQuantityChange={(index, quantity) =>
                setLines((current) => updateLineQuantity(current, index, quantity))
              }
              onRemoveLine={(index) => setLines((current) => removeLine(current, index))}
            />

            {/* 4. Resumen monetario y acción de cobro */}
            <div ref={summaryActionRef}>
              <SummaryActionZone
                status={status}
                preview={preview}
                previewMatchesRevision={previewMatchesRevision}
                submitting={emission.submitting}
                onConfirm={handleConfirmClick}
                onRetryPreview={handleRetryPreview}
                canPreviewDocument={canPreviewDocument}
                previewingDocument={documentPreview.loading}
                onPreviewDocument={handleDocumentPreview}
                actionError={actionError}
              />
            </div>
          </AdminPanel>
        </div>
      )}

      {!showResult && !summaryActionVisible ? (
        /* Barra de acción móvil fija al pie */
        <div className="sticky bottom-0 z-20 flex items-center justify-between gap-3 border-t border-[var(--ui-line-strong)] bg-[var(--ui-surface)] px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <div className="flex min-w-0 flex-col">
            <span className="text-[length:var(--ui-text-xs)] font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-ink-faint)]">
              Total a cobrar
            </span>
            {status.totalCents !== null ? (
              <MoneyText cents={status.totalCents} emphasis="strong" />
            ) : (
              <span className="text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]">
                {status.code === 'borrador'
                  ? 'Sin líneas'
                  : status.code === 'calculando' || status.code === 'emitiendo'
                    ? 'Calculando…'
                    : 'No disponible'}
              </span>
            )}
          </div>
          <button
            type="button"
            className={PRIMARY_BUTTON}
            disabled={!status.canConfirm || emission.submitting}
            onClick={handleConfirmClick}
            data-testid="cobrar-mobile-action"
          >
            {status.confirmKind === 'zero' ? 'Emitir sin cobro' : 'Cobrar'}
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        key={emission.result?.invoice.id ?? revision}
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        status={status}
        patientName={patientName}
        lines={lines}
        preview={preview}
        previewMatchesRevision={previewMatchesRevision}
        method={method}
        onMethodChange={setMethod}
        reference={reference}
        onReferenceChange={setReference}
        onConfirm={() => void handleDialogConfirm()}
        submitting={emission.submitting}
      />

      <DocumentPreviewDialog
        open={documentPreview.open}
        onOpenChange={documentPreview.onOpenChange}
        document={documentPreview.document}
        loading={documentPreview.loading}
        error={documentPreview.error}
        onRetry={documentPreview.retry}
      />
    </section>
  );
}
