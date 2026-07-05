import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/states';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type CashSession, apiClient, userSafeErrorMessage } from '@/lib/api';
import { payloadScopedIdempotencyKey, resetPayloadScopedIdempotencyKey } from '@/lib/api/idempotency';
import { formatLempirasUI, parseCents, toFloat } from '@/lib/money';
import { getVisibleRefetchInterval } from '@/lib/query/polling';
import { invalidateBillingQueries } from '@/lib/queryInvalidation';
import { queryKeys } from '@/lib/queryKeys';
import { SessionStatusCard } from './components/SessionStatusCard';
import { OpenSessionForm } from './components/OpenSessionForm';
import { SessionSummary } from './components/SessionSummary';
import { CloseSessionDialog } from './components/CloseSessionDialog';
import { CashMovementsTable } from './components/CashMovementsTable';
import { CashClosingPanel } from './components/CashClosingPanel';
import { CashMethodSummary } from './components/CashMethodSummary';
import { CashSessionHeader } from './components/CashSessionHeader';

type CashBoxViewProps = {
  cashSession?: CashSession | null;
  canCloseCash?: boolean;
  canOpenCash?: boolean;
  canViewCashSessionReport?: boolean;
  compact?: boolean;
  onStatus: (message: string) => void;
  onSessionChange?: (session: CashSession | null) => void;
};

function centsToFloat(cents: number): number {
  return toFloat(cents);
}

export function CashBoxView({
  cashSession = null,
  canCloseCash = true,
  canOpenCash = true,
  canViewCashSessionReport = false,
  compact = false,
  onStatus,
  onSessionChange,
}: CashBoxViewProps) {
  const queryClient = useQueryClient();
  const [closingAmount, setClosingAmount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [formAlert, setFormAlert] = useState<string | null>(null);
  const [closingAmountError, setClosingAmountError] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [pendingOpening, setPendingOpening] = useState<{ opening_amount: string } | null>(null);
  const closingAmountRef = useRef<HTMLInputElement | null>(null);
  const openingSessionInFlightRef = useRef(false);
  const closingSessionInFlightRef = useRef(false);
  const openSessionIdempotencyKeyRef = useRef<string | null>(null);
  const closeSessionIdempotencyKeyRef = useRef<string | null>(null);
  const openSessionIdempotencySignatureRef = useRef<string | null>(null);
  const closeSessionIdempotencySignatureRef = useRef<string | null>(null);

  const {
    data: session,
    error: sessionError,
    isError: sessionIsError,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.cashSessions.current(),
    queryFn: () => apiClient.getCurrentCashSession(),
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
        ? apiClient.getCashSessionReport(String(session.id)).then((report) => report.movements)
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
      setFormAlert(null);
      onSessionChange?.(opened);
      onStatus('Caja abierta.');
    },
    onError: (error) => {
      const message = userSafeErrorMessage(error, 'No se pudo abrir caja.');
      setFormAlert(message);
      onStatus(message);
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
    onSuccess: async () => {
      resetPayloadScopedIdempotencyKey(closeSessionIdempotencyKeyRef, closeSessionIdempotencySignatureRef);
      queryClient.setQueryData(queryKeys.cashSessions.current(), null);
      await invalidateBillingQueries(queryClient);
      setClosingAmount('');
      setClosingNotes('');
      setFormAlert(null);
      onSessionChange?.(null);
      onStatus('Caja cerrada.');
    },
    onError: (error) => {
      const message = userSafeErrorMessage(error, 'No se pudo cerrar caja.');
      setFormAlert(message);
      onStatus(message);
    },
    onSettled: () => {
      closingSessionInFlightRef.current = false;
    },
  });

  const activeSession = session ?? cashSession;
  // Server-computed expected cash is authoritative. The fallback chain
  // (expected_cash_amount -> expected_amount -> opening_amount) is
  // preserved for legacy backends, but a fresh `expected_cash_amount`
  // from the LAN server is what we trust.
  const expectedCashAmount = activeSession?.expected_cash_amount ?? activeSession?.expected_amount ?? activeSession?.opening_amount ?? '0.00';
  const hasValidClosingAmount = /^\d+(\.\d{1,2})?$/.test(closingAmount.trim());
  const difference = hasValidClosingAmount
    ? centsToFloat(parseCents(closingAmount) - parseCents(expectedCashAmount))
    : null;
  const hasCashDifference = difference !== null && difference !== 0;
  const isOpen = activeSession?.status === 'open';
  const pendingInvoiceCount = activeSession?.pending_invoice_count ?? 0;
  const pendingAmount = activeSession?.pending_amount ?? '0.00';
  const hasPendingBalance = pendingInvoiceCount > 0 || parseCents(pendingAmount) > 0;
  const canRenderOperationalState = Boolean(activeSession) || (!sessionLoadError && !isLoading);
  const isOpenSessionFormLocked = pendingOpening !== null || openSessionMutation.isPending;

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => closingAmountRef.current?.focus(), 0);
    }
  }, [isOpen, activeSession?.id]);

  function handleOpenSession(data: { opening_amount: string }) {
    if (openSessionMutation.isPending || openingSessionInFlightRef.current) return;
    setPendingOpening({ opening_amount: data.opening_amount.trim() });
  }

  function confirmOpenSession() {
    if (!pendingOpening || openSessionMutation.isPending || openingSessionInFlightRef.current) return;
    openingSessionInFlightRef.current = true;
    onStatus('Abriendo caja...');
    openSessionMutation.mutate({ opening_amount: pendingOpening.opening_amount });
    setPendingOpening(null);
  }

  function handleCloseConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSession) return;
    if (!canCloseCash) {
      setFormAlert('Este usuario no tiene permiso para cerrar caja.');
      return;
    }
    if (hasPendingBalance) {
      setFormAlert(`No se puede cerrar caja con ${pendingInvoiceCount} factura(s) pendientes o parciales por ${formatLempirasUI(pendingAmount)}.`);
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
    setClosingAmountError(null);
    setConfirmingClose(true);
  }

  function handleCloseSession() {
    if (!activeSession) return;
    if (closeSessionMutation.isPending || closingSessionInFlightRef.current) return;
    closingSessionInFlightRef.current = true;
    onStatus('Cerrando caja...');
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

  const isPOSBlocked = !isOpen;

  return (
    <section id="caja" className={compact ? 'flex flex-col gap-4' : 'cash-layout'} aria-label="Caja">
      <div className="flex flex-col gap-6">
        <CashSessionHeader
          isLoading={isLoading}
          onRefresh={() => void refetch()}
          session={activeSession ?? null}
        />

        {formAlert ? (
          <Alert variant="destructive" title="No se pudo completar la operación">
            {formAlert}
          </Alert>
        ) : null}

        {sessionLoadError ? (
          <ErrorState
            title="No se pudo cargar caja"
            description={sessionLoadError}
            action={(
              <Button type="button" variant="secondary" onClick={() => void refetch()}>
                Reintentar
              </Button>
            )}
          />
        ) : null}

        {isLoading && !activeSession ? (
          <LoadingState label="Cargando estado de caja..." />
        ) : null}

        {canRenderOperationalState ? (
          <SessionStatusCard session={activeSession ?? null} />
        ) : null}

        {canRenderOperationalState && isOpen ? (
          <Alert variant="success" title="Caja lista para facturar">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="flex-1">
                La caja está abierta. Puede pasar directamente al POS para crear y cobrar facturas.
              </span>
              <Button asChild size="sm">
                <Link to="/billing/new">Nueva factura</Link>
              </Button>
            </div>
          </Alert>
        ) : null}

        {canRenderOperationalState && isPOSBlocked ? (
          <Alert variant="warning" icon={<AlertTriangle data-icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}>
            <div>
              <strong>Pagos bloqueados.</strong> Abra caja antes de emitir y cobrar facturas.
            </div>
          </Alert>
        ) : null}

        {canRenderOperationalState && isOpen && activeSession ? (
          <>
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

            <CashClosingPanel
              canCloseCash={canCloseCash}
              closingAmount={closingAmount}
              closingAmountError={closingAmountError}
              closingAmountRef={closingAmountRef}
              closingNotes={closingNotes}
              difference={difference}
              hasCashDifference={hasCashDifference}
              hasPendingBalance={hasPendingBalance}
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

            {canViewCashSessionReport && movementsLoading ? (
              <LoadingState label="Cargando movimientos de caja..." />
            ) : null}

            {canViewCashSessionReport && movementsLoadError ? (
              <ErrorState
                title="No se pudieron cargar movimientos"
                description={movementsLoadError}
                action={(
                  <Button type="button" variant="secondary" onClick={() => void refetchMovements()}>
                    Reintentar
                  </Button>
                )}
              />
            ) : null}

            {canViewCashSessionReport && !movementsLoading && !movementsLoadError && movements.length === 0 ? (
              <EmptyState
                title="Sin movimientos"
              description="No hay movimientos en esta sesión de caja."
              />
            ) : null}

            {canViewCashSessionReport && movements && movements.length > 0 ? (
              <CashMovementsTable movements={movements} />
            ) : null}
          </>
        ) : canRenderOperationalState && canOpenCash ? (
          <OpenSessionForm
            isSubmitting={isOpenSessionFormLocked}
            onSubmit={handleOpenSession}
          />
        ) : canRenderOperationalState ? (
          <Alert variant="warning" title="Caja en modo consulta">
            Este usuario puede ver caja, pero no tiene permiso para abrir una nueva sesión.
          </Alert>
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
        }}
        closingAmount={closingAmount}
        closingNotes={closingNotes}
        difference={difference ?? 0}
        isSubmitting={closeSessionMutation.isPending}
        onClosingNotesChange={setClosingNotes}
        onConfirm={handleCloseSession}
      />

      <ConfirmDialog
        open={pendingOpening !== null}
        title="Confirmar apertura de caja"
        confirmLabel="Abrir caja"
        confirmDisabled={openSessionMutation.isPending}
        cancelDisabled={openSessionMutation.isPending}
        onCancel={() => setPendingOpening(null)}
        onConfirm={confirmOpenSession}
      >
        <div className="grid gap-3">
          <p>
            Revise el efectivo fisico antes de iniciar el turno. Esta apertura quedara auditada.
          </p>
          <div className="flex justify-between gap-4 rounded-md border border-border bg-muted/35 p-3 text-sm">
            <span>Monto inicial</span>
            <strong>{formatLempirasUI(pendingOpening?.opening_amount ?? '0.00')}</strong>
          </div>
        </div>
      </ConfirmDialog>
    </section>
  );
}
