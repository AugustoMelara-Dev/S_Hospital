import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { HistoryIcon, LoaderCircleIcon, RefreshCwIcon, TriangleAlertIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { cash as cashApi, type CashClosingBreakdown, type CashSession, apiClient, userSafeErrorMessage } from '@/lib/api';
import { payloadScopedIdempotencyKey, resetPayloadScopedIdempotencyKey } from '@/lib/api/idempotency';
import { parseCents, toExchangeDecimal } from '@/lib/moneyCents';
import { getVisibleRefetchInterval } from '@/lib/query/polling';
import { invalidateBillingQueries } from '@/lib/queryInvalidation';
import { queryKeys } from '@/lib/queryKeys';
import {
  AdminCallout,
  AdminDialog,
  AdminEmpty,
  AdminPanel,
  AdminPanelHeader,
  AdminStat,
  AdminStatBand,
  AdminTabs,
  MoneyText,
  StatusStamp,
} from '@/design-system/admin/components';
import { formatCashCents } from './cashMoney';
import { formatDateTimeEs } from '@/lib/format/formatDate';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { OpenSessionForm } from './components/OpenSessionForm';
import { CashCloseSummaryPanel, CloseSessionDialog } from './components/CloseSessionDialog';
import { CashMovementsTable } from './components/CashMovementsTable';
import { CashClosingPanel } from './components/CashClosingPanel';
import { CashMethodSummary } from './components/CashMethodSummary';
import { CashSessionHistory } from './components/CashSessionHistory';
import {
  cashCentsToDecimal,
  cashDenominationBreakdown,
  cashDenominationTotalCents,
  CashDenominationCounter,
  createEmptyDenominationCounts,
  hasCashDenominationCount,
  isZeroCashCountConfirmed,
  HNL_BILL_DENOMINATIONS,
  type DenominationCounts,
  type HnlBillDenomination,
} from './components/CashDenominationCounter';
import { AccountingControlPanel } from '@/modules/accounting/components/AccountingControlPanel';
import type { OperationalStatusReporter } from '@/app/operationalStatus';
import { FOCUS_RING, PRIMARY_BUTTON, SECONDARY_BUTTON } from './cashUi';

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
  currentUserName?: string;
  onStatus: OperationalStatusReporter;
  onSessionChange?: (session: CashSession | null) => void;
};

function LoadingState({ label }: { label: string }) { return <div role="status" aria-label={label} className="flex items-center justify-center gap-2 p-8 text-center text-[color:var(--ui-ink-soft)]"><LoaderCircleIcon aria-hidden="true" data-icon className="size-4 animate-spin" /><p className="text-[length:var(--ui-text-sm)]">{label}</p></div>; }
function EmptyState({ description, title }: { description: string; title: string }) { return <AdminEmpty title={title} description={description} />; }
function ErrorState({ action, description, title }: { action?: ReactNode; description: string; title: string }) { return <AdminCallout tone="error" title={title}>{description}{action ? <div className="mt-2">{action}</div> : null}</AdminCallout>; }

type ConfirmedPendingWork = {
  missingInstitutionalReceiptCount: number;
  pendingAmount: string;
  pendingAmountCents: number;
  pendingInvoiceCount: number;
  reversedPaymentsCount: number;
};

function confirmedPendingWork(session: CashSession | null | undefined): ConfirmedPendingWork | null {
  const pendingAmountCents = parseCents(session?.pending_amount);
  const counts = [
    session?.pending_invoice_count,
    session?.missing_institutional_receipt_count,
    session?.reversed_payments_count,
  ];

  if (
    !session
    || typeof session.pending_amount !== 'string'
    || pendingAmountCents === null
    || counts.some((count) => !Number.isInteger(count) || (count ?? -1) < 0)
  ) {
    return null;
  }

  return {
    pendingInvoiceCount: session.pending_invoice_count as number,
    pendingAmount: session.pending_amount,
    pendingAmountCents,
    missingInstitutionalReceiptCount: session.missing_institutional_receipt_count as number,
    reversedPaymentsCount: session.reversed_payments_count as number,
  };
}

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
  currentUserName,
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
  const [historyVisible, setHistoryVisible] = useState(false);
  const [pendingOpening, setPendingOpening] = useState<{ opening_amount: string; cash_register_id: number } | null>(null);
  const [closedSummarySession, setClosedSummarySession] = useState<CashSession | null>(null);
  const [denominationCounts, setDenominationCounts] = useState(createEmptyDenominationCounts);
  const [otherCashAmount, setOtherCashAmount] = useState('');
  const closingAmountRef = useRef<HTMLInputElement | null>(null);
  const openingSessionInFlightRef = useRef(false);
  const closingSessionInFlightRef = useRef(false);
  const openSessionIdempotencyKeyRef = useRef<string | null>(null);
  const closeSessionIdempotencyKeyRef = useRef<string | null>(null);
  const openSessionIdempotencySignatureRef = useRef<string | null>(null);
  const closeSessionIdempotencySignatureRef = useRef<string | null>(null);
  const countedSessionIdRef = useRef<number | null | undefined>(undefined);
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
    // Multi-PC LAN: otra cajera puede cerrar la caja. Sondea cada 10 s para que
    // esta UI muestre "Sin sesión abierta" sin refresco manual.
    refetchInterval: () => getVisibleRefetchInterval(10_000),
    refetchOnWindowFocus: true,
  });

  const cashRegistersQuery = useQuery({
    queryKey: ['cash-registers', 'active'],
    queryFn: () => cashApi.getCashRegisters(),
    enabled: canOpenCash && !isLoading && !(session ?? cashSession),
    staleTime: 60_000,
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
    mutationFn: (payload: { opening_amount: string; cash_register_id: number; notes?: string | null }) => {
      const idempotencyKey = payloadScopedIdempotencyKey(
        openSessionIdempotencyKeyRef,
        openSessionIdempotencySignatureRef,
        payload,
      );

      return cashApi.openCashSession(payload, {
        idempotencyKey,
      });
    },
    onSuccess: async (opened) => {
      resetPayloadScopedIdempotencyKey(openSessionIdempotencyKeyRef, openSessionIdempotencySignatureRef);
      queryClient.setQueryData(queryKeys.cashSessions.current('own'), opened);
      queryClient.setQueryData(queryKeys.cashSessions.current('closable'), opened);
      await invalidateBillingQueries(queryClient);
      setClosingAmount('');
      setClosingNotes('');
      setDenominationCounts(createEmptyDenominationCounts());
      setOtherCashAmount('');
      setClosedSummarySession(null);
      setFormAlert(null);
      onSessionChange?.(opened);
      setActiveView('summary');
      onStatus({ key: 'cash:open:success', level: 'success', message: 'Caja abierta.' });
    },
    onError: (error) => {
      const message = userSafeErrorMessage(error, 'No se pudo abrir caja.');
      setFormAlert(message);
      onStatus({ key: 'cash:open:error', level: 'error', message, toast: false });
    },
    onSettled: () => {
      openingSessionInFlightRef.current = false;
    },
  });

  const closeSessionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { closing_amount: string; notes?: string | null; closing_breakdown?: CashClosingBreakdown } }) => {
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
      queryClient.setQueryData(queryKeys.cashSessions.current('own'), null);
      queryClient.setQueryData(queryKeys.cashSessions.current('closable'), null);
      await invalidateBillingQueries(queryClient);
      setClosedSummarySession(closed);
      setClosingAmount('');
      setClosingNotes('');
      setDenominationCounts(createEmptyDenominationCounts());
      setOtherCashAmount('');
      setFormAlert(null);
      onSessionChange?.(null);
      setActiveView('summary');
      onStatus({ key: 'cash:close:success', level: 'success', message: 'Caja cerrada.' });
    },
    onError: (error) => {
      const message = userSafeErrorMessage(error, 'No se pudo cerrar caja.');
      setFormAlert(message);
      onStatus({ key: 'cash:close:error', level: 'error', message, toast: false });
    },
    onSettled: () => {
      closingSessionInFlightRef.current = false;
    },
  });

  const activeSession = session ?? cashSession;
  const cashRegisterName = activeSession?.cash_register?.name ?? 'Caja no disponible';
  const selectedOpeningRegister = pendingOpening
    ? cashRegistersQuery.data?.find((cashRegister) => cashRegister.id === pendingOpening.cash_register_id) ?? null
    : null;
  // El efectivo esperado lo calcula el servidor y es la autoridad. La cadena de
  // respaldo (expected_cash_amount -> expected_amount -> opening_amount) se
  // conserva para payloads históricos.
  const expectedCashAmount = activeSession?.expected_cash_amount ?? activeSession?.expected_amount ?? activeSession?.opening_amount ?? null;
  const hasPhysicalCashCount = hasCashDenominationCount(denominationCounts, otherCashAmount);
  const zeroCountConfirmed = isZeroCashCountConfirmed(denominationCounts, otherCashAmount);
  const hasValidClosingAmount = /^\d+(\.\d{1,2})?$/.test(closingAmount.trim());
  const closingCents = parseCents(closingAmount);
  const expectedCashCents = parseCents(expectedCashAmount);
  // Efectivo contado y esperado se conservan en centavos. La diferencia solo
  // existe cuando ambos están disponibles; un conteo ausente no se inventa.
  const differenceCents = hasValidClosingAmount && closingCents !== null && expectedCashCents !== null
    ? closingCents - expectedCashCents
    : null;
  const hasCashDifference = differenceCents !== null && differenceCents !== 0;
  const isOpen = activeSession?.status === 'open';
  const isOwnSession = Boolean(activeSession && currentUserId === activeSession.user_id);
  const sessionCashier = activeSession
    ? activeSession.user?.name ?? activeSession.user?.username ?? 'Cajero sin nombre registrado'
    : null;
  const operatorName = currentUserName ?? sessionCashier ?? null;
  const pendingWork = confirmedPendingWork(activeSession);
  const hasPendingBalance = pendingWork !== null
    && (pendingWork.pendingInvoiceCount > 0 || pendingWork.pendingAmountCents > 0);
  const canRenderOperationalState = Boolean(activeSession) || (!sessionLoadError && !isLoading);
  const isOpenSessionFormLocked = pendingOpening !== null || openSessionMutation.isPending;

  // F2 (anunciado en lib/shortcuts.ts) lleva el foco al monto inicial de
  // apertura cuando no hay turno activo. No abre la caja por sí solo: la
  // apertura sigue pasando por el formulario y su confirmación auditada.
  useKeyboardShortcuts([
    {
      key: 'F2',
      action: () => {
        if (activeSession || !canOpenCash) return;
        const openingAmount = document.getElementById('opening_amount');
        if (openingAmount instanceof HTMLInputElement) {
          openingAmount.focus();
        }
      },
      description: 'Foco en el monto inicial para abrir caja.',
    },
  ]);

  useEffect(() => {
    const nextSessionId = activeSession?.id ?? null;

    if (countedSessionIdRef.current === undefined) {
      countedSessionIdRef.current = nextSessionId;
      return;
    }

    if (countedSessionIdRef.current !== nextSessionId) {
      countedSessionIdRef.current = nextSessionId;
      setDenominationCounts(createEmptyDenominationCounts());
      setOtherCashAmount('');
      setClosingAmount('');
      setClosingAmountError(null);
    }
  }, [activeSession?.id]);

  useEffect(() => {
    if (isOpen && activeView === 'close') {
      window.setTimeout(() => closingAmountRef.current?.focus(), 0);
    }
  }, [activeView, isOpen]);

  function handleOpenSession(data: { opening_amount: string; cash_register_id: number }) {
    if (openSessionMutation.isPending || openingSessionInFlightRef.current) return;
    setPendingOpening({
      opening_amount: data.opening_amount.trim(),
      cash_register_id: data.cash_register_id,
    });
  }

  function confirmOpenSession() {
    if (!pendingOpening || openSessionMutation.isPending || openingSessionInFlightRef.current) return;
    openingSessionInFlightRef.current = true;
    onStatus({ key: 'cash:open:progress', level: 'info', message: 'Abriendo caja...', toast: false });
    openSessionMutation.mutate({
      opening_amount: pendingOpening.opening_amount,
      cash_register_id: pendingOpening.cash_register_id,
    });
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
    const refreshedPendingWork = confirmedPendingWork(refreshed.data);
    if (!refreshedPendingWork) {
      setClosingAmountError(null);
      setFormAlert('No se pudo confirmar el trabajo pendiente antes de cerrar. Actualice caja y vuelva a intentar.');
      return;
    }
    const refreshedHasPendingBalance = refreshedPendingWork.pendingInvoiceCount > 0
      || refreshedPendingWork.pendingAmountCents > 0;

    if (refreshedHasPendingBalance) {
      setFormAlert(`No se puede cerrar caja con ${refreshedPendingWork.pendingInvoiceCount} factura(s) pendientes o parciales por ${formatCashCents(refreshedPendingWork.pendingAmountCents)}.`);
      return;
    }
    if (refreshedPendingWork.missingInstitutionalReceiptCount > 0) {
      setFormAlert(`No se puede cerrar caja con ${refreshedPendingWork.missingInstitutionalReceiptCount} recibo institucional pendiente. Genere el recibo antes de cerrar.`);
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
    const closingBreakdown = hasPhysicalCashCount
      ? cashDenominationBreakdown(denominationCounts, otherCashAmount)
      : undefined;
    closeSessionMutation.mutate({
      id: activeSession.id,
      payload: {
        closing_amount: trimmedClosingAmount,
        notes: trimmedClosingNotes === '' ? null : trimmedClosingNotes,
        ...(closingBreakdown ? { closing_breakdown: closingBreakdown } : {}),
      },
    });
  }

  function handleManualRefresh() {
    onStatus({ key: 'cash:refresh', level: 'info', message: 'Actualizando caja...' });
    void refetch();
  }

  function updateCountedAmount(
    nextCounts = denominationCounts,
    nextOtherAmount = otherCashAmount,
  ) {
    // T-UI-23: un conteo vacío no vale L 0.00. Si el operador borra todas las
    // denominaciones, el monto contado vuelve a ausente (''), no a "0.00", para
    // que la diferencia y el cierre sigan "Pendiente" en vez de calcular contra
    // un cero implícito.
    const hasCount = hasCashDenominationCount(nextCounts, nextOtherAmount);
    setClosingAmount(
      hasCount
        ? cashCentsToDecimal(cashDenominationTotalCents(nextCounts, nextOtherAmount))
        : '',
    );
    setClosingAmountError(null);
  }

  function handleDenominationCountChange(denomination: HnlBillDenomination, value: string) {
    const nextCounts = { ...denominationCounts, [denomination]: value };
    setDenominationCounts(nextCounts);
    updateCountedAmount(nextCounts, otherCashAmount);
  }

  function handleOtherCashAmountChange(value: string) {
    setOtherCashAmount(value);
    updateCountedAmount(denominationCounts, value);
  }

  function handleResetCashCount() {
    setDenominationCounts(createEmptyDenominationCounts());
    setOtherCashAmount('');
    setClosingAmount('');
    setClosingAmountError(null);
  }

  /**
   * Conteo en cero explícito: el operador declara que la gaveta no tiene
   * efectivo. Se distinguen así los tres estados: sin conteo (monto vacío,
   * "Pendiente"), conteo parcial o completo, y cero confirmado.
   */
  function handleConfirmZeroCount() {
    const zeroCounts = Object.fromEntries(
      HNL_BILL_DENOMINATIONS.map((denomination) => [denomination, '0']),
    ) as DenominationCounts;
    setDenominationCounts(zeroCounts);
    setOtherCashAmount('0.00');
    updateCountedAmount(zeroCounts, '0.00');
  }

  const isPOSBlocked = !isOpen;

  return (
    // El landmark de la página vive en `CajaView` (`aria-labelledby` al H1
    // «Caja»). Este envoltorio no lleva nombre accesible: un `section` sin
    // nombre no es landmark, y así no se duplica la región «Caja» (axe
    // `landmark-unique`, C4-VISUAL MEDIUM ×4).
    <section id="caja" className="grid gap-5">
      {/* Un solo título por región: el H1 «Caja» vive en `CajaView`. Aquí
          solo quedan las acciones del módulo, alineadas a la derecha como
          estaba la barra que compartía con el título. */}
      <div className="flex flex-wrap items-end justify-end gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {isOpen && isOwnSession && canCreateInvoices ? (
            <Link
              to="/cobrar"
              data-ui-press
              className={`inline-flex h-[var(--ui-control-h)] items-center gap-2 rounded-[var(--ui-radius-control)] bg-[var(--ui-action)] px-3 text-[length:var(--ui-text-base)] font-semibold text-[color:var(--ui-action-foreground)] transition-[transform,background-color] duration-[140ms] ease-[var(--ui-ease-out)] hover:bg-[var(--ui-action-hover)] active:scale-[0.96] motion-reduce:transition-none motion-reduce:active:scale-100 ${FOCUS_RING}`}
            >
              Nueva operación
            </Link>
          ) : null}
          <button
            type="button"
            data-ui-press
            onClick={handleManualRefresh}
            disabled={isLoading}
            className={SECONDARY_BUTTON}
          >
            <RefreshCwIcon aria-hidden="true" data-icon className={isLoading ? 'size-4 animate-spin' : 'size-4'} />
            Actualizar
          </button>
          <button
            type="button"
            data-ui-press
            className={SECONDARY_BUTTON}
            aria-expanded={historyVisible}
            aria-controls="cash-session-history"
            onClick={() => setHistoryVisible((visible) => !visible)}
          >
            <HistoryIcon aria-hidden="true" data-icon className="size-4" />
            {historyVisible ? 'Ocultar histórico' : 'Ver histórico'}
          </button>
        </div>
      </div>

      {/* Identidad única del turno: caja física ≠ usuario ≠ sesión. El estado
          abierto se declara una sola vez (chip dentro de la celda de sesión);
          la línea viva solo aporta la hora o su ausencia. */}
      <AdminPanel as="section" role="region" aria-label="Caja, usuario y sesión" className="overflow-hidden">
        <div className="grid gap-px bg-[var(--ui-line)] sm:grid-cols-3">
          <IdentityCell label="Caja física">
            <span className="font-medium">{cashRegisterName}</span>
          </IdentityCell>
          <IdentityCell label="Operador">
            <span className="font-medium tabular-nums">{operatorName ?? 'Sin operador'}</span>
            {isOpen && !isOwnSession && sessionCashier && sessionCashier !== operatorName ? (
              <span className="mt-0.5 block text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
                Sesión abierta por {sessionCashier}
              </span>
            ) : null}
          </IdentityCell>
          <IdentityCell label="Turno">
            {isOpen && activeSession ? (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <StatusStamp status="cobrado" label="Caja abierta" />
                <span className="text-[color:var(--ui-ink-soft)]">
                  {isOwnSession
                    ? 'Turno abierto por usted'
                    : canCloseAnyCash
                      ? 'Turno de otro cajero · supervisión habilitada'
                      : 'Turno de otro cajero'}
                </span>
              </span>
            ) : isLoading ? (
              <StatusStamp status="borrador" label="Consultando" />
            ) : (
              <StatusStamp status="borrador" label="Caja cerrada" />
            )}
          </IdentityCell>
        </div>
        <p
          role="status"
          aria-live="polite"
          className="border-t border-[var(--ui-line)] px-4 py-2.5 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]"
        >
          {isLoading
            ? 'Actualizando estado de caja.'
            : isOpen && activeSession
              ? `Abierta desde ${formatDateTimeEs(activeSession.opened_at)}`
              : 'No hay una caja abierta actualmente.'}
        </p>
      </AdminPanel>

      {/* Resumen monetario del turno (una sola banda, sin repetirse en pestañas).
          El efectivo esperado vive en el arqueo, que es donde se cuenta. */}
      <AdminStatBand role="region" aria-label="Estado operativo de caja" columns={3}>
        <AdminStat label="Apertura" value={isOpen && activeSession ? <MoneyText cents={parseCents(activeSession.opening_amount)} /> : '—'} />
        <AdminStat
          label="Cobros registrados"
          value={isOpen ? <MoneyText cents={parseCents(activeSession?.payments_total)} /> : '—'}
          hint={isOpen ? `${activeSession?.payments_count ?? 0} pago${(activeSession?.payments_count ?? 0) === 1 ? '' : 's'}` : undefined}
        />
        <AdminStat
          label="Saldo pendiente"
          value={
            isOpen
              ? pendingWork
                ? <MoneyText cents={pendingWork.pendingAmountCents} />
                : 'No disponible'
              : '—'
          }
          hint={
            isOpen
              ? pendingWork
                ? hasPendingBalance
                  ? `${pendingWork.pendingInvoiceCount} factura${pendingWork.pendingInvoiceCount === 1 ? '' : 's'} por cobrar`
                  : 'Sin pendientes'
                : 'No se pudo confirmar'
              : undefined
          }
          tone={isOpen && hasPendingBalance ? 'warn' : 'default'}
        />
      </AdminStatBand>

      {formAlert ? (
        <AdminCallout tone="error" title="No se pudo completar la operación">{formAlert}</AdminCallout>
      ) : null}

      {sessionLoadError ? (
        <ErrorState
          title="No se pudo cargar caja"
          description={sessionLoadError}
          action={(
            <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={() => void refetch()}>
              Reintentar
            </button>
          )}
        />
      ) : null}

      {isLoading && !activeSession ? (
        <LoadingState label="Cargando estado de caja..." />
      ) : null}

      {canRenderOperationalState && isOpen && !isOwnSession ? (
        <AdminCallout tone="info" title="Caja abierta en supervisión">Esta sesión pertenece a otro cajero. Puede revisar y cerrar según sus permisos, pero no crear facturas desde esta caja.</AdminCallout>
      ) : canRenderOperationalState && isOpen && !canCreateInvoices ? (
        <AdminCallout tone="info" title="Caja abierta en modo consulta">La sesión está activa, pero este usuario no tiene permiso para crear facturas.</AdminCallout>
      ) : null}

      {canRenderOperationalState && isPOSBlocked ? (
        <AdminCallout tone="warn"><span className="flex items-start gap-2"><TriangleAlertIcon aria-hidden="true" data-icon className="mt-0.5 size-4 shrink-0" /><span><strong>Pagos bloqueados.</strong> Abra caja antes de emitir y cobrar facturas.</span></span></AdminCallout>
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
            opened_at: closedSummarySession.opened_at,
            closed_at: closedSummarySession.closed_at,
            closing_breakdown: closedSummarySession.closing_breakdown,
          }}
          closingAmount={closedSummarySession.closing_amount}
          closingNotes={closedSummarySession.closing_notes ?? ''}
          differenceCents={parseCents(closedSummarySession.difference_amount)}
        />
      ) : null}

      {canRenderOperationalState && isOpen && activeSession ? (
        <>
          <AdminTabs
            ariaLabel="Vista activa de caja"
            value={activeView}
            onValueChange={(key) => {
              setActiveView(key as CashView);
            }}
            items={[
              { id: 'summary', label: 'Resumen' },
              { id: 'movements', label: 'Movimientos' },
              { id: 'reconciliation', label: 'Arqueo' },
              { id: 'close', label: 'Cierre' },
            ]}
          />

          {activeView === 'summary' ? (
            <div className="grid min-w-0 gap-4">
              <CashMethodSummary
                paymentsByMethod={activeSession.payments_by_method}
                paymentsCount={activeSession.payments_count}
                pendingAmount={activeSession.pending_amount}
              />
              <PendingWorkPanel
                canViewInvoices={canViewInvoices}
                cashSessionId={activeSession.id}
                onRetry={() => void refetch()}
                pendingWork={pendingWork}
              />
            </div>
          ) : null}

          {activeView === 'reconciliation' ? (
            <div className="grid gap-4">
              {/* Un solo arqueo: conciliación esperado/contado/diferencia y el
                  conteo por denominaciones comparten superficie; no se repiten. */}
              <CashDenominationCounter
                counts={denominationCounts}
                expectedAmount={expectedCashAmount}
                otherAmount={otherCashAmount}
                onConfirmZero={handleConfirmZeroCount}
                onContinue={() => setActiveView('close')}
                onCountChange={handleDenominationCountChange}
                onOtherAmountChange={handleOtherCashAmountChange}
                onReset={handleResetCashCount}
              />
              <AccountingControlPanel
                canViewInvoices={canViewInvoices}
                reconciliation={{
                  ...activeSession,
                  difference_amount: differenceCents !== null ? toExchangeDecimal(differenceCents) : null,
                }}
              />
            </div>
          ) : null}

          {activeView === 'close' ? (
            pendingWork ? (
              <CashClosingPanel
                canCloseCash={canCloseCash}
                canViewInvoices={canViewInvoices}
                cashSessionId={activeSession.id}
                closingAmount={closingAmount}
                closingAmountReadOnly={hasPhysicalCashCount}
                closingAmountError={closingAmountError}
                closingAmountRef={closingAmountRef}
                closingNotes={closingNotes}
                differenceCents={differenceCents}
                hasCashDifference={hasCashDifference}
                hasPendingBalance={hasPendingBalance}
                missingInstitutionalReceiptCount={pendingWork.missingInstitutionalReceiptCount}
                isSubmitting={closeSessionMutation.isPending}
                onClosingAmountChange={(value) => {
                  setClosingAmount(value);
                  if (closingAmountError) setClosingAmountError(null);
                }}
                onClosingNotesChange={setClosingNotes}
                onSubmit={handleCloseConfirmation}
                pendingAmount={pendingWork.pendingAmount}
                pendingInvoiceCount={pendingWork.pendingInvoiceCount}
                zeroCountConfirmed={zeroCountConfirmed}
              />
            ) : (
              <ErrorState
                title="No se pudo confirmar el cierre"
                description="Faltan datos actuales de facturas o recibos. Actualice caja antes de continuar."
                action={(
                  <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={() => void refetch()}>
                    Reintentar
                  </button>
                )}
              />
            )
          ) : null}

          {activeView === 'movements' && canViewCashSessionReport && movementsLoading ? (
            <LoadingState label="Cargando movimientos de caja..." />
          ) : null}

          {activeView === 'movements' && canViewCashSessionReport && movementsLoadError ? (
            <ErrorState
              title="No se pudieron cargar movimientos"
              description={movementsLoadError}
              action={(
                <button type="button" data-ui-press className={SECONDARY_BUTTON} onClick={() => void refetchMovements()}>
                  Reintentar
                </button>
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
            <AdminCallout tone="info" title="Movimientos no disponibles">Su rol no permite consultar el detalle auditado de esta caja.</AdminCallout>
          ) : null}
        </>
      ) : canRenderOperationalState && canOpenCash ? (
        <OpenSessionForm
          cashRegisters={cashRegistersQuery.data ?? []}
          cashRegistersError={cashRegistersQuery.isError
            ? userSafeErrorMessage(cashRegistersQuery.error, 'No fue posible consultar las cajas habilitadas.')
            : ''}
          cashRegistersLoading={cashRegistersQuery.isLoading || cashRegistersQuery.isFetching}
          isSubmitting={isOpenSessionFormLocked}
          onRetryCashRegisters={() => void cashRegistersQuery.refetch()}
          onSubmit={handleOpenSession}
        />
      ) : canRenderOperationalState ? (
        <AdminCallout tone="info" title="Caja en modo consulta">Este usuario puede ver caja, pero no tiene permiso para abrir una nueva sesión.</AdminCallout>
      ) : null}

      <div id="cash-session-history">
        <CashSessionHistory visible={historyVisible} canViewInvoices={canViewInvoices} />
      </div>

      <CloseSessionDialog
        open={confirmingClose}
        onOpenChange={setConfirmingClose}
        session={{
          opened_at: activeSession?.opened_at ?? null,
          opening_amount: activeSession?.opening_amount ?? null,
          expected_cash_amount: activeSession?.expected_cash_amount ?? activeSession?.expected_amount ?? undefined,
          payments_by_method: activeSession?.payments_by_method,
          pending_invoice_count: activeSession?.pending_invoice_count,
          pending_amount: activeSession?.pending_amount,
          missing_institutional_receipt_count: activeSession?.missing_institutional_receipt_count,
          closing_breakdown: hasCashDenominationCount(denominationCounts, otherCashAmount)
            ? cashDenominationBreakdown(denominationCounts, otherCashAmount)
            : undefined,
        }}
        closingAmount={closingAmount}
        closingNotes={closingNotes}
        differenceCents={differenceCents}
        isSubmitting={closeSessionMutation.isPending}
        onClosingNotesChange={setClosingNotes}
        onConfirm={handleCloseSession}
      />

      <AdminDialog
        open={pendingOpening !== null}
        onOpenChange={(open) => { if (!open && !openSessionMutation.isPending) setPendingOpening(null); }}
        title="Confirmar apertura de caja"
        description="Revise la caja y el efectivo inicial antes de comenzar el turno."
        closeDisabled={openSessionMutation.isPending}
        footer={(
          <>
            <button type="button" data-ui-press className={SECONDARY_BUTTON} disabled={openSessionMutation.isPending} onClick={() => setPendingOpening(null)}>Cancelar</button>
            <button type="button" data-ui-press className={PRIMARY_BUTTON} disabled={openSessionMutation.isPending} onClick={confirmOpenSession}>{openSessionMutation.isPending ? 'Abriendo...' : 'Abrir caja'}</button>
          </>
        )}
      >
        <dl className="grid divide-y divide-[var(--ui-line)] border-y border-[var(--ui-line)] text-[length:var(--ui-text-sm)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="px-3 py-3">
            <dt className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Caja física</dt>
            <dd className="mt-1 font-semibold">{selectedOpeningRegister ? selectedOpeningRegister.name : 'Caja no disponible'}</dd>
          </div>
          <div className="px-3 py-3 sm:text-right">
            <dt className="text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">Monto inicial</dt>
            <dd className="mt-1 font-semibold"><MoneyText cents={parseCents(pendingOpening?.opening_amount)} /></dd>
          </div>
        </dl>
      </AdminDialog>
    </section>
  );
}

function IdentityCell({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="bg-[var(--ui-surface)] px-4 py-3">
      <p className="text-[length:var(--ui-text-xs)] font-medium uppercase tracking-[0.06em] text-[color:var(--ui-ink-faint)]">
        {label}
      </p>
      <div className="mt-1 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink)]">{children}</div>
    </div>
  );
}

type PendingWorkPanelProps = {
  canViewInvoices: boolean;
  cashSessionId: number;
  onRetry: () => void;
  pendingWork: ConfirmedPendingWork | null;
};

/**
 * Trabajo de conciliación del turno: cobros y recibos que impiden cerrar.
 *
 * Cuando no hay nada pendiente se declara en una línea discreta (no una
 * tarjeta grande) y los contadores en cero no se dibujan: un cero no ocupa un
 * contenedor.
 */
function PendingWorkPanel({
  canViewInvoices,
  cashSessionId,
  onRetry,
  pendingWork,
}: PendingWorkPanelProps) {
  if (!pendingWork) {
    return (
      <AdminPanel as="section" role="region" aria-label="Trabajo pendiente" className="overflow-hidden">
        <AdminPanelHeader
          title="Trabajo pendiente"
          description="Cobros y recibos que deben quedar resueltos antes de cerrar el turno."
        />
        <div className="px-4 py-3.5">
          <AdminCallout tone="error" title="No se pudo confirmar el trabajo pendiente">
            <p>Los datos actuales no están disponibles. Actualice caja antes de continuar.</p>
            <button type="button" data-ui-press className={`mt-2 ${SECONDARY_BUTTON}`} onClick={onRetry}>
              Reintentar
            </button>
          </AdminCallout>
        </div>
      </AdminPanel>
    );
  }

  const {
    missingInstitutionalReceiptCount,
    pendingAmountCents,
    pendingInvoiceCount,
    reversedPaymentsCount,
  } = pendingWork;
  const hasPendingInvoices = pendingInvoiceCount > 0 || pendingAmountCents > 0;
  const isClear = !hasPendingInvoices && missingInstitutionalReceiptCount === 0 && reversedPaymentsCount === 0;

  if (isClear) {
    // Estado "sin pendientes" con la misma superficie que el estado con
    // datos: la pestaña Resumen no pinta texto suelto sobre el fondo y la
    // tarjeta lleva contenido real (el estado del turno), no un hueco
    // decorativo vacío.
    return (
      <AdminPanel as="section" role="region" aria-label="Trabajo pendiente" className="overflow-hidden">
        <AdminPanelHeader
          title="Trabajo pendiente"
          description="Cobros y recibos que deben quedar resueltos antes de cerrar el turno."
        />
        <p
          role="status"
          data-cash-pending="clear"
          className="px-4 py-3.5 text-[length:var(--ui-text-sm)] text-[color:var(--ui-ink-soft)]"
        >
          Sin pendientes: el turno puede conciliarse.
        </p>
      </AdminPanel>
    );
  }

  const rows: Array<{ key: string; label: string; value: string; detail: ReactNode }> = [];

  if (hasPendingInvoices) {
    rows.push({
      key: 'invoices',
      label: 'Facturas pendientes',
      value: String(pendingInvoiceCount),
      detail: <MoneyText cents={pendingAmountCents} />,
    });
  }
  if (missingInstitutionalReceiptCount > 0) {
    rows.push({
      key: 'receipts',
      label: 'Recibos pendientes',
      value: String(missingInstitutionalReceiptCount),
      detail: 'Institucionales por emitir',
    });
  }
  if (reversedPaymentsCount > 0) {
    rows.push({
      key: 'reversed',
      label: 'Pagos reversados',
      value: String(reversedPaymentsCount),
      detail: 'Revisar trazabilidad',
    });
  }

  return (
    <AdminPanel as="section" role="region" aria-label="Trabajo pendiente" className="overflow-hidden">
      <AdminPanelHeader
        title="Trabajo pendiente"
        description="Cobros y recibos que deben quedar resueltos antes de cerrar el turno."
      />
      <dl className={`grid sm:divide-x sm:divide-[var(--ui-line)] ${rows.length === 1 ? 'sm:grid-cols-1' : rows.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        {rows.map((row) => (
          <PendingRow key={row.key} label={row.label} value={row.value} detail={row.detail} tone="warn" />
        ))}
      </dl>
      {canViewInvoices ? (
        <div className="border-t border-[var(--ui-line)] px-4 py-3">
          <Link
            to={`/recibos?reconciliation_cash_session_id=${cashSessionId}`}
            className="inline-flex items-center gap-1 rounded-[var(--ui-radius-control)] text-[length:var(--ui-text-sm)] font-semibold text-[color:var(--ui-action)] underline underline-offset-4 transition-colors duration-[120ms] ease-[var(--ui-ease-out)] hover:text-[color:var(--ui-action-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ui-focus)]"
          >
            Resolver en Recibos
          </Link>
        </div>
      ) : (
        <p className="border-t border-[var(--ui-line)] px-4 py-3 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">
          Solicite apoyo a un usuario con acceso a Recibos para resolverlo.
        </p>
      )}
    </AdminPanel>
  );
}

function PendingRow({
  detail,
  label,
  tone = 'default',
  value,
}: {
  detail: ReactNode;
  label: string;
  tone?: 'default' | 'warn';
  value: string;
}) {
  return (
    <div className="px-4 py-3">
      <dt className="text-[length:var(--ui-text-xs)] font-medium uppercase tracking-[0.06em] text-[color:var(--ui-ink-faint)]">
        {label}
      </dt>
      <dd className="mt-1">
        <span
          className={
            tone === 'warn'
              ? 'text-[length:var(--ui-text-xl)] font-semibold tabular-nums text-[color:var(--ui-warn)]'
              : 'text-[length:var(--ui-text-xl)] font-semibold tabular-nums text-[color:var(--ui-ink)]'
          }
        >
          {value}
        </span>
        <span className="ml-2 text-[length:var(--ui-text-xs)] text-[color:var(--ui-ink-soft)]">{detail}</span>
      </dd>
    </div>
  );
}
