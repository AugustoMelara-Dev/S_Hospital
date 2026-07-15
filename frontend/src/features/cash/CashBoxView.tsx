import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Modal, Result, Spin, Tabs, Tag } from 'antd';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type CashSession, apiClient, userSafeErrorMessage } from '@/lib/api';
import { payloadScopedIdempotencyKey, resetPayloadScopedIdempotencyKey } from '@/lib/api/idempotency';
import { finiteNumber, formatLempirasUI, parseCents, toFloat } from '@/lib/money';
import { getVisibleRefetchInterval } from '@/lib/query/polling';
import { invalidateBillingQueries } from '@/lib/queryInvalidation';
import { queryKeys } from '@/lib/queryKeys';
import { PageHeader } from '@/design-system/components/PageHeader';
import { formatDateTimeEs } from '@/lib/format/formatDate';
import { OpenSessionForm } from './components/OpenSessionForm';
import { SessionSummary } from './components/SessionSummary';
import { CashCloseSummaryPanel, CloseSessionDialog } from './components/CloseSessionDialog';
import { CashMovementsTable } from './components/CashMovementsTable';
import { CashClosingPanel } from './components/CashClosingPanel';
import { CashMethodSummary } from './components/CashMethodSummary';
import { AccountingControlPanel } from '@/modules/accounting/components/AccountingControlPanel';
import type { OperationalStatusReporter } from '@/app/operationalStatus';

type CashView = 'summary' | 'movements' | 'reconciliation' | 'close';

type CashBoxViewProps = {
  cashSession?: CashSession | null;
  canCloseAnyCash?: boolean;
  canCloseCash?: boolean;
  canCreateInvoices?: boolean;
  canOpenCash?: boolean;
  canViewInvoices?: boolean;
  canViewCashSessionReport?: boolean;
  compact?: boolean;
  currentUserId?: number;
  onStatus: OperationalStatusReporter;
  onSessionChange?: (session: CashSession | null) => void;
};

function centsToFloat(cents: number): number {
  return toFloat(cents);
}

function LoadingState({ label }: { label: string }) { return <div role="status" aria-label={label} className="p-8 text-center"><Spin /><p>{label}</p></div>; }
function EmptyState({ description, title }: { description: string; title: string }) { return <Empty description={<><strong>{title}</strong><br />{description}</>} />; }
function ErrorState({ action, description, title }: { action?: ReactNode; description: string; title: string }) { return <Result status="error" title={title} subTitle={description} extra={action} />; }

export function CashBoxView({
  cashSession = null,
  canCloseAnyCash = false,
  canCloseCash = true,
  canCreateInvoices = false,
  canOpenCash = true,
  canViewInvoices = false,
  canViewCashSessionReport = false,
  compact: _compact = false,
  currentUserId,
  onStatus,
  onSessionChange,
}: CashBoxViewProps) {
  const queryClient = useQueryClient();
  const [closingAmount, setClosingAmount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [formAlert, setFormAlert] = useState<string | null>(null);
  const [closingAmountError, setClosingAmountError] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [activeView, setActiveView] = useState<CashView>('summary');
  const [pendingOpening, setPendingOpening] = useState<{ opening_amount: string } | null>(null);
  const [closedSummarySession, setClosedSummarySession] = useState<CashSession | null>(null);
  const closingAmountRef = useRef<HTMLInputElement | null>(null);
  const openingSessionInFlightRef = useRef(false);
  const closingSessionInFlightRef = useRef(false);
  const openSessionIdempotencyKeyRef = useRef<string | null>(null);
  const closeSessionIdempotencyKeyRef = useRef<string | null>(null);
  const openSessionIdempotencySignatureRef = useRef<string | null>(null);
  const closeSessionIdempotencySignatureRef = useRef<string | null>(null);
  const currentSessionScope = canCloseAnyCash ? 'closable' : 'own';

  const {
    data: session,
    error: sessionError,
    isError: sessionIsError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.cashSessions.current(currentSessionScope),
    queryFn: () => apiClient.getCurrentCashSession(canCloseAnyCash ? { scope: 'closable' } : undefined),
    // Multi-PC LAN: another cashier may close the box. Poll every
    // 10s so this UI shows "Sin caja" within the same window without
    // a manual refresh.
    refetchInterval: () => getVisibleRefetchInterval(10_000),
    refetchOnWindowFocus: true,
  });

  const {
    data: movementsData,
    error: movementsError,
    isError: movementsIsError,
    isLoading: movementsLoading,
    refetch: refetchMovements,
  } = useQuery({
    queryKey: queryKeys.cashSessions.movements(session?.id),
    queryFn: () =>
      session?.id && canViewCashSessionReport
        ? apiClient.getCashSessionReport(String(session.id)).then((report) => {
          const paymentsById = new Map(report.payments.map((payment) => [payment.id, payment]));

          return report.movements.map((movement) => {
            const payment = movement.payment_id ? paymentsById.get(movement.payment_id) : undefined;

            return {
              ...movement,
              invoice_id: payment?.invoice_id ?? null,
              invoice_number: payment?.invoice?.invoice_number ?? null,
            };
          });
        })
        : Promise.resolve([] as Awaited<ReturnType<typeof apiClient.getCashSessionReport>>['movements']),
    enabled: !!session?.id && canViewCashSessionReport,
    refetchInterval: () => getVisibleRefetchInterval(15_000),
  });
  const movements = movementsData ?? [];
  const sessionLoadError = sessionIsError ? userSafeErrorMessage(sessionError, 'No se pudo cargar caja.') : '';
  const movementsLoadError = movementsIsError
    ? userSafeErrorMessage(movementsError, 'No se pudieron cargar movimientos.')
    : '';

  const openSessionMutation = useMutation({
    mutationFn: (payload: { opening_amount: string; notes?: string | null }) => {
      const idempotencyKey = payloadScopedIdempotencyKey(
        openSessionIdempotencyKeyRef,
        openSessionIdempotencySignatureRef,
        payload,
      );

      return apiClient.openCashSession(payload, {
        idempotencyKey,
      });
    },
    onSuccess: async (opened) => {
      resetPayloadScopedIdempotencyKey(openSessionIdempotencyKeyRef, openSessionIdempotencySignatureRef);
      queryClient.setQueryData(queryKeys.cashSessions.current(), opened);
      await invalidateBillingQueries(queryClient);
      setClosingAmount('');
      setClosingNotes('');
      setClosedSummarySession(null);
      setFormAlert(null);
      onSessionChange?.(opened);
      setActiveView('summary');
      onStatus({ key: 'cash:open:success', level: 'success', message: 'Caja abierta.' });
    },
    onError: (error) => {
      const message = userSafeErrorMessage(error, 'No se pudo abrir caja.');
      setFormAlert(message);
      onStatus({ key: 'cash:open:error', level: 'error', message });
    },
    onSettled: () => {
      openingSessionInFlightRef.current = false;
    },
  });

  const closeSessionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { closing_amount: string; notes?: string | null } }) => {
      const idempotencyKey = payloadScopedIdempotencyKey(
        closeSessionIdempotencyKeyRef,
        closeSessionIdempotencySignatureRef,
        { id, payload },
      );

      return apiClient.closeCashSession(id, payload, {
        idempotencyKey,
      });
    },
    onSuccess: async (closed) => {
      resetPayloadScopedIdempotencyKey(closeSessionIdempotencyKeyRef, closeSessionIdempotencySignatureRef);
      queryClient.setQueryData(queryKeys.cashSessions.current(), null);
      await invalidateBillingQueries(queryClient);
      setClosedSummarySession(closed);
      setClosingAmount('');
      setClosingNotes('');
      setFormAlert(null);
      onSessionChange?.(null);
      setActiveView('summary');
      onStatus({ key: 'cash:close:success', level: 'success', message: 'Caja cerrada.' });
    },
    onError: (error) => {
      const message = userSafeErrorMessage(error, 'No se pudo cerrar caja.');
      setFormAlert(message);
      onStatus({ key: 'cash:close:error', level: 'error', message });
    },
    onSettled: () => {
      closingSessionInFlightRef.current = false;
    },
  });

  const activeSession = session ?? cashSession;
  // Server-computed expected cash is authoritative. The fallback chain
  // (expected_cash_amount -> expected_amount -> opening_amount) is
  // preserved for historical server payloads, but a fresh `expected_cash_amount`
  // from the LAN server is what we trust.
  const expectedCashAmount = activeSession?.expected_cash_amount ?? activeSession?.expected_amount ?? activeSession?.opening_amount ?? '0.00';
  const hasValidClosingAmount = /^\d+(\.\d{1,2})?$/.test(closingAmount.trim());
  const difference = hasValidClosingAmount
    ? centsToFloat(parseCents(closingAmount) - parseCents(expectedCashAmount))
    : null;
  const hasCashDifference = difference !== null && difference !== 0;
  const isOpen = activeSession?.status === 'open';
  const isOwnSession = Boolean(activeSession && currentUserId === activeSession.user_id);
  const cashier = activeSession
    ? activeSession.user?.name ?? activeSession.user?.username ?? `Cajero #${activeSession.user_id}`
    : null;
  const pendingInvoiceCount = activeSession?.pending_invoice_count ?? 0;
  const pendingAmount = activeSession?.pending_amount ?? '0.00';
  const missingInstitutionalReceiptCount = activeSession?.missing_institutional_receipt_count ?? 0;
  const hasPendingBalance = pendingInvoiceCount > 0 || parseCents(pendingAmount) > 0;
  const canRenderOperationalState = Boolean(activeSession) || (!sessionLoadError && !isLoading);
  const isOpenSessionFormLocked = pendingOpening !== null || openSessionMutation.isPending;

  useEffect(() => {
    if (isOpen && activeView === 'close') {
      window.setTimeout(() => closingAmountRef.current?.focus(), 0);
    }
  }, [activeView, isOpen, activeSession?.id]);

  function handleOpenSession(data: { opening_amount: string }) {
    if (openSessionMutation.isPending || openingSessionInFlightRef.current) return;
    setPendingOpening({ opening_amount: data.opening_amount.trim() });
  }

  function confirmOpenSession() {
    if (!pendingOpening || openSessionMutation.isPending || openingSessionInFlightRef.current) return;
    openingSessionInFlightRef.current = true;
    onStatus({ key: 'cash:open:progress', level: 'info', message: 'Abriendo caja...', toast: false });
    openSessionMutation.mutate({ opening_amount: pendingOpening.opening_amount });
    setPendingOpening(null);
  }

  async function handleCloseConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSession) return;
    if (!canCloseCash) {
      setFormAlert('Este usuario no tiene permiso para cerrar caja.');
      return;
    }
    if (closingAmount.trim() === '') {
      setClosingAmountError('Falta ingresar el monto contado antes de cerrar caja.');
      setFormAlert(null);
      closingAmountRef.current?.focus();
      return;
    }
    if (!hasValidClosingAmount) {
      setClosingAmountError('Ingrese un monto contado válido, por ejemplo 100.00.');
      setFormAlert(null);
      closingAmountRef.current?.focus();
      return;
    }
    const refreshed = await refetch();
    if (refreshed.isError) {
      setClosingAmountError(null);
      setFormAlert('No se pudo actualizar caja antes de cerrar. Revise la conexion local y vuelva a intentar.');
      return;
    }
    const sessionForClose = refreshed.data ?? activeSession;
    const refreshedPendingInvoiceCount = sessionForClose.pending_invoice_count ?? 0;
    const refreshedPendingAmount = sessionForClose.pending_amount ?? '0.00';
    const refreshedHasPendingBalance = refreshedPendingInvoiceCount > 0 || parseCents(refreshedPendingAmount) > 0;
    const missingInstitutionalReceiptCount = sessionForClose.missing_institutional_receipt_count ?? 0;

    if (refreshedHasPendingBalance) {
      setFormAlert(`No se puede cerrar caja con ${refreshedPendingInvoiceCount} factura(s) pendientes o parciales por ${formatLempirasUI(refreshedPendingAmount)}.`);
      return;
    }
    if (missingInstitutionalReceiptCount > 0) {
      setFormAlert(`No se puede cerrar caja con ${missingInstitutionalReceiptCount} recibo institucional pendiente. Genere el recibo antes de cerrar.`);
      return;
    }
    setClosingAmountError(null);
    setConfirmingClose(true);
  }

  function handleCloseSession() {
    if (!activeSession) return;
    if (closeSessionMutation.isPending || closingSessionInFlightRef.current) return;
    closingSessionInFlightRef.current = true;
    onStatus({ key: 'cash:close:progress', level: 'info', message: 'Cerrando caja...', toast: false });
    setConfirmingClose(false);
    const trimmedClosingAmount = closingAmount.trim();
    const trimmedClosingNotes = closingNotes.trim();
    closeSessionMutation.mutate({
      id: activeSession.id,
      payload: {
        closing_amount: trimmedClosingAmount,
        notes: trimmedClosingNotes === '' ? null : trimmedClosingNotes,
      },
    });
  }

  function handleManualRefresh() {
    onStatus({ key: 'cash:refresh', level: 'info', message: 'Actualizando caja...' });
    void refetch();
  }

  const isPOSBlocked = !isOpen;

  return (
    <section id="caja" className={'grid gap-6'} aria-label="Caja">
      <div className="flex flex-col gap-6">
        <PageHeader
          eyebrow="Operación de caja"
          title="Caja"
          description="Apertura, conciliación, movimientos auditados y cierre de efectivo."
          actions={(
            <>
              {isOpen && isOwnSession && canCreateInvoices ? (
                <Link to="/billing/new"><Button type="primary">Nueva factura</Button></Link>
              ) : null}
              <Button icon={<ReloadOutlined spin={isLoading} />} onClick={handleManualRefresh} disabled={isLoading}>
                Actualizar
              </Button>
            </>
          )}
        />
        <section
          aria-label="Estado operativo de caja"
          className="grid gap-3 border border-border bg-background px-4 py-3 md:grid-cols-[minmax(15rem,1.3fr)_repeat(3,minmax(7rem,1fr))] md:items-center"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Tag color={isOpen ? 'green' : undefined}>{isOpen ? 'Caja abierta' : 'Caja cerrada'}</Tag>
              <p role="status" aria-live="polite" className="text-sm">
                {isLoading
                  ? 'Actualizando estado de caja.'
                  : isOpen && activeSession
                    ? `Caja abierta desde ${formatDateTimeEs(activeSession.opened_at)}`
                    : 'No hay una caja abierta actualmente.'}
              </p>
            </div>
            {isOpen && cashier ? (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                <strong className="text-foreground">{cashier}</strong> · {isOwnSession ? 'Caja propia' : canCloseAnyCash ? 'Supervisión habilitada' : 'Sesión de otro cajero'}
              </p>
            ) : null}
          </div>
          <OperationalMetric label="Apertura" value={isOpen && activeSession ? formatLempirasUI(activeSession.opening_amount) : '—'} />
          <OperationalMetric label="Efectivo esperado" value={isOpen ? formatLempirasUI(expectedCashAmount) : '—'} />
          <OperationalMetric
            label="Pendiente"
            value={isOpen ? formatLempirasUI(pendingAmount) : '—'}
            detail={isOpen ? `${pendingInvoiceCount} factura${pendingInvoiceCount === 1 ? '' : 's'}` : undefined}
          />
        </section>

        {formAlert ? (
          <Alert type="error" showIcon title="No se pudo completar la operación" description={formAlert} />
        ) : null}

        {sessionLoadError ? (
          <ErrorState
            title="No se pudo cargar caja"
            description={sessionLoadError}
            action={(
              <Button htmlType="button" onClick={() => void refetch()}>
                Reintentar
              </Button>
            )}
          />
        ) : null}

        {isLoading && !activeSession ? (
          <LoadingState label="Cargando estado de caja..." />
        ) : null}

        {canRenderOperationalState && isOpen && !isOwnSession ? (
          <Alert type="warning" showIcon title="Caja abierta en supervisión" description="Esta sesión pertenece a otro cajero. Puede revisar y cerrar según sus permisos, pero no crear facturas desde esta caja." />
        ) : canRenderOperationalState && isOpen && !canCreateInvoices ? (
          <Alert type="info" showIcon title="Caja abierta en modo consulta" description="La sesión está activa, pero este usuario no tiene permiso para crear facturas." />
        ) : null}

        {canRenderOperationalState && isPOSBlocked ? (
          <Alert type="warning" showIcon icon={<WarningOutlined aria-hidden="true" />} description={(
            <div>
              <strong>Pagos bloqueados.</strong> Abra caja antes de emitir y cobrar facturas.
            </div>
          )} />
        ) : null}

        {canRenderOperationalState && !isOpen && closedSummarySession ? (
          <CashCloseSummaryPanel
            session={{
              id: closedSummarySession.id,
              opening_amount: closedSummarySession.opening_amount,
              expected_cash_amount: closedSummarySession.expected_cash_amount ?? closedSummarySession.expected_amount ?? undefined,
              expected_amount: closedSummarySession.expected_amount,
              payments_by_method: closedSummarySession.payments_by_method,
              pending_invoice_count: closedSummarySession.pending_invoice_count,
              pending_amount: closedSummarySession.pending_amount,
              closed_at: closedSummarySession.closed_at,
            }}
            closingAmount={closedSummarySession.closing_amount ?? '0.00'}
            closingNotes={closedSummarySession.closing_notes ?? ''}
            difference={finiteNumber(closedSummarySession.difference_amount)}
          />
        ) : null}

        {canRenderOperationalState && isOpen && activeSession ? (
          <>
            <Tabs
              activeKey={activeView}
              onChange={(key) => setActiveView(key as CashView)}
              items={[
                { key: 'summary', label: 'Resumen' },
                { key: 'movements', label: 'Movimientos' },
                { key: 'reconciliation', label: 'Arqueo' },
                { key: 'close', label: 'Cierre' },
              ]}
            />

            {activeView === 'summary' ? (
              <div className="grid min-w-0 gap-4">
                <SessionSummary
                  session={activeSession}
                  closingAmount={hasValidClosingAmount ? closingAmount : null}
                  difference={difference}
                />
                <CashMethodSummary
                  paymentsByMethod={activeSession.payments_by_method}
                  paymentsCount={activeSession.payments_count}
                  pendingAmount={activeSession.pending_amount}
                />
              </div>
            ) : null}

            {activeView === 'reconciliation' ? (
              <AccountingControlPanel
                canViewInvoices={canViewInvoices}
                reconciliation={{ ...activeSession, difference_amount: difference }}
              />
            ) : null}

            {activeView === 'close' ? (
              <CashClosingPanel
                canCloseCash={canCloseCash}
                canViewInvoices={canViewInvoices}
                closingAmount={closingAmount}
                closingAmountError={closingAmountError}
                closingAmountRef={closingAmountRef}
                closingNotes={closingNotes}
                difference={difference}
                hasCashDifference={hasCashDifference}
                hasPendingBalance={hasPendingBalance}
                missingInstitutionalReceiptCount={missingInstitutionalReceiptCount}
                isSubmitting={closeSessionMutation.isPending}
                onClosingAmountChange={(value) => {
                  setClosingAmount(value);
                  if (closingAmountError) setClosingAmountError(null);
                }}
                onClosingNotesChange={setClosingNotes}
                onSubmit={handleCloseConfirmation}
                pendingAmount={pendingAmount}
                pendingInvoiceCount={pendingInvoiceCount}
              />
            ) : null}

            {activeView === 'movements' && canViewCashSessionReport && movementsLoading ? (
              <LoadingState label="Cargando movimientos de caja..." />
            ) : null}

            {activeView === 'movements' && canViewCashSessionReport && movementsLoadError ? (
              <ErrorState
                title="No se pudieron cargar movimientos"
                description={movementsLoadError}
                action={(
                  <Button htmlType="button" onClick={() => void refetchMovements()}>
                    Reintentar
                  </Button>
                )}
              />
            ) : null}

            {activeView === 'movements' && canViewCashSessionReport && !movementsLoading && !movementsLoadError && movements.length === 0 ? (
              <EmptyState
                title="Sin movimientos"
              description="No hay movimientos en esta sesión de caja."
              />
            ) : null}

            {activeView === 'movements' && canViewCashSessionReport && movements && movements.length > 0 ? (
              <CashMovementsTable canViewInvoices={canViewInvoices} movements={movements} />
            ) : null}
            {activeView === 'movements' && !canViewCashSessionReport ? (
              <Alert type="info" showIcon title="Movimientos no disponibles" description="Su rol no permite consultar el detalle auditado de esta caja." />
            ) : null}
          </>
        ) : canRenderOperationalState && canOpenCash ? (
          <OpenSessionForm
            isSubmitting={isOpenSessionFormLocked}
            onSubmit={handleOpenSession}
          />
        ) : canRenderOperationalState ? (
          <Alert type="warning" showIcon title="Caja en modo consulta" description="Este usuario puede ver caja, pero no tiene permiso para abrir una nueva sesión." />
        ) : null}
      </div>

      <CloseSessionDialog
        open={confirmingClose}
        onOpenChange={setConfirmingClose}
        session={{
          opening_amount: activeSession?.opening_amount ?? '0',
          expected_cash_amount: activeSession?.expected_cash_amount ?? activeSession?.expected_amount ?? undefined,
          payments_by_method: activeSession?.payments_by_method,
          pending_invoice_count: activeSession?.pending_invoice_count,
          pending_amount: activeSession?.pending_amount,
          missing_institutional_receipt_count: activeSession?.missing_institutional_receipt_count,
        }}
        closingAmount={closingAmount}
        closingNotes={closingNotes}
        difference={difference ?? 0}
        isSubmitting={closeSessionMutation.isPending}
        onClosingNotesChange={setClosingNotes}
        onConfirm={handleCloseSession}
      />

      <Modal
        open={pendingOpening !== null}
        title="Confirmar apertura de caja"
        okText="Abrir caja"
        confirmLoading={openSessionMutation.isPending}
        okButtonProps={{ disabled: openSessionMutation.isPending }}
        cancelButtonProps={{ disabled: openSessionMutation.isPending }}
        onCancel={() => setPendingOpening(null)}
        onOk={confirmOpenSession}
      >
        <div className="grid gap-3">
          <p>
            Revise el efectivo fisico antes de iniciar el turno. Esta apertura quedara auditada.
          </p>
          <div className="flex justify-between gap-4 border border-border bg-muted/40 p-4 text-sm">
            <span>Monto inicial</span>
            <strong>{formatLempirasUI(pendingOpening?.opening_amount ?? '0.00')}</strong>
          </div>
        </div>
      </Modal>
    </section>
  );
}

function OperationalMetric({ detail, label, value }: { detail?: string; label: string; value: string }) {
  return (
    <dl className="min-w-0 border-l-2 border-border pl-3 lg:border-l lg:pl-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex flex-wrap items-baseline gap-x-2 font-semibold tabular-nums">
        <span>{value}</span>
        {detail ? <span className="text-xs font-normal text-muted-foreground">{detail}</span> : null}
      </dd>
    </dl>
  );
}
