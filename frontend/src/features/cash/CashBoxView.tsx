import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type CashSession, apiClient, userSafeErrorMessage } from '@/lib/api';
import { formatLempirasFromCents, parseCents } from '@/lib/moneyCents';
import { invalidateBillingQueries } from '@/lib/queryInvalidation';
import { queryKeys } from '@/lib/queryKeys';
import { SessionStatusCard } from './components/SessionStatusCard';
import { OpenSessionForm } from './components/OpenSessionForm';
import { SessionSummary } from './components/SessionSummary';
import { CloseSessionDialog } from './components/CloseSessionDialog';
import { CashMovementsTable } from './components/CashMovementsTable';

type CashBoxViewProps = {
  cashSession?: CashSession | null;
  canCloseCash?: boolean;
  canOpenCash?: boolean;
  canViewCashSessionReport?: boolean;
  compact?: boolean;
  onStatus: (message: string) => void;
};


export function CashBoxView({
  cashSession = null,
  canCloseCash = true,
  canOpenCash = true,
  canViewCashSessionReport = false,
  compact = false,
  onStatus,
}: CashBoxViewProps) {
  const queryClient = useQueryClient();
  const [closingAmount, setClosingAmount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [formAlert, setFormAlert] = useState<string | null>(null);
  const [closingAmountError, setClosingAmountError] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const closingAmountRef = useRef<HTMLInputElement | null>(null);

  const { data: session, isLoading, refetch } = useQuery({
    queryKey: queryKeys.cashSessions.current(),
    queryFn: () => apiClient.getCurrentCashSession(),
    // Multi-PC LAN: another cashier may close the box. Poll every
    // 10s so this UI shows "Sin caja" within the same window without
    // a manual refresh.
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const { data: movementsData } = useQuery({
    queryKey: queryKeys.cashSessions.movements(session?.id),
    queryFn: () =>
      session?.id && canViewCashSessionReport
        ? apiClient.getCashSessionReport(String(session.id)).then((report) => report.movements)
        : Promise.resolve([] as Awaited<ReturnType<typeof apiClient.getCashSessionReport>>['movements']),
    enabled: !!session?.id && canViewCashSessionReport,
    refetchInterval: 15_000,
  });
  const movements = movementsData ?? [];

  const openSessionMutation = useMutation({
    mutationFn: (payload: { opening_amount: string; notes?: string | null }) =>
      apiClient.openCashSession(payload),
    onSuccess: async (opened) => {
      queryClient.setQueryData(queryKeys.cashSessions.current(), opened);
      await invalidateBillingQueries(queryClient);
      setClosingAmount('');
      setClosingNotes('');
      setFormAlert(null);
      onStatus('Caja abierta.');
    },
    onError: (error) => {
      const message = userSafeErrorMessage(error, 'No se pudo abrir caja.');
      setFormAlert(message);
      onStatus(message);
    },
  });

  const closeSessionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { closing_amount: string; notes?: string | null } }) =>
      apiClient.closeCashSession(id, payload),
    onSuccess: async () => {
      queryClient.setQueryData(queryKeys.cashSessions.current(), null);
      await invalidateBillingQueries(queryClient);
      setClosingAmount('');
      setClosingNotes('');
      setFormAlert(null);
      onStatus('Caja cerrada.');
    },
    onError: (error) => {
      const message = userSafeErrorMessage(error, 'No se pudo cerrar caja.');
      setFormAlert(message);
      onStatus(message);
    },
  });

  const activeSession = session ?? cashSession;
  // Server-computed expected cash is authoritative. The fallback chain
  // (expected_cash_amount -> expected_amount -> opening_amount) is
  // preserved for legacy backends, but a fresh `expected_cash_amount`
  // from the LAN server is what we trust.
  const expectedCashAmount = activeSession?.expected_cash_amount ?? activeSession?.expected_amount ?? activeSession?.opening_amount ?? '0.00';
  const hasValidClosingAmount = /^\d+(\.\d{1,2})?$/.test(closingAmount.trim());
  const difference = hasValidClosingAmount && expectedCashAmount
    ? (parseCents(closingAmount) ?? 0) - (parseCents(expectedCashAmount) ?? 0)
    : null;
  const hasCashDifference = difference !== null && difference !== 0;
  const isOpen = activeSession?.status === 'open';
  const pendingInvoiceCount = activeSession?.pending_invoice_count ?? 0;
  const pendingAmount = activeSession?.pending_amount ?? '0.00';
  const hasPendingBalance = pendingInvoiceCount > 0 || (parseCents(pendingAmount) ?? 0) > 0;

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => closingAmountRef.current?.focus(), 0);
    }
  }, [isOpen, activeSession?.id]);

  function handleOpenSession(data: { opening_amount: string }) {
    onStatus('Abriendo caja...');
    openSessionMutation.mutate({ opening_amount: data.opening_amount });
  }

  function handleCloseConfirmation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSession) return;
    if (!canCloseCash) {
      setFormAlert('Este usuario no tiene permiso para cerrar caja.');
      return;
    }
    if (hasPendingBalance) {
      setFormAlert(`No se puede cerrar caja con ${pendingInvoiceCount} factura(s) pendientes o parciales por ${formatLempirasFromCents(parseCents(pendingAmount))}.`);
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
    onStatus('Cerrando caja...');
    setConfirmingClose(false);
    closeSessionMutation.mutate({
      id: activeSession.id,
      payload: {
        closing_amount: closingAmount,
        notes: closingNotes.trim() === '' ? null : closingNotes,
      },
    });
  }

  const isPOSBlocked = !isOpen;

  return (
    <section id="caja" className={compact ? 'flex flex-col gap-4' : 'cash-layout'} aria-labelledby="cash-title">
      <div className="flex flex-col gap-6">
        <Card className="border-secondary/15">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardDescription>Operación de caja</CardDescription>
              <CardTitle id="cash-title" className="text-2xl font-semibold">Caja</CardTitle>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => void refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {formAlert ? (
              <Alert variant="destructive" title="No se pudo completar la operación">
                {formAlert}
              </Alert>
            ) : null}

            <SessionStatusCard session={activeSession ?? null} />

            {isOpen && (
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
            )}

            {isPOSBlocked && (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <div>
                  <strong>Pagos bloqueados.</strong> Abra caja antes de emitir y cobrar facturas.
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        {isOpen && activeSession ? (
          <>
            <SessionSummary
              session={activeSession}
              closingAmount={hasValidClosingAmount ? closingAmount : null}
              difference={difference}
            />

            {activeSession.payments_by_method && (
              <Card>
                <CardHeader>
                  <CardTitle>Resumen por método de pago</CardTitle>
                  <CardDescription>
                    Efectivo entra al efectivo esperado. Transferencias, tarjetas y otros métodos quedan separados para conciliación.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Efectivo</span>
                      <span className="text-xl font-bold">{formatLempirasFromCents(parseCents(activeSession.payments_by_method.cash))}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Transferencia</span>
                      <span className="text-xl font-bold">{formatLempirasFromCents(parseCents(activeSession.payments_by_method.transfer))}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Tarjeta</span>
                      <span className="text-xl font-bold">{formatLempirasFromCents(parseCents(activeSession.payments_by_method.card))}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Otros</span>
                      <span className="text-xl font-bold">{formatLempirasFromCents(parseCents(activeSession.payments_by_method.other))}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Pagos registrados</span>
                      <span className="text-xl font-bold">{activeSession.payments_count ?? 0}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Saldo pendiente</span>
                      <span className="text-xl font-bold">{formatLempirasFromCents(parseCents(activeSession.pending_amount))}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Cerrar caja</CardTitle>
                <CardDescription>Cierre auditado de la sesión actual</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCloseConfirmation} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold" htmlFor="closing_amount">
                      Monto Contado (L.) *
                    </label>
                    <Input
                      ref={closingAmountRef}
                      id="closing_amount"
                      name="closing_amount"
                      type="text"
                      inputMode="decimal"
                      value={closingAmount}
                      onChange={(e) => {
                        setClosingAmount(e.target.value);
                        if (closingAmountError) setClosingAmountError(null);
                      }}
                      placeholder="0.00"
                      autoComplete="off"
                      className="font-mono text-lg tabular-nums"
                      aria-invalid={closingAmountError ? 'true' : 'false'}
                      aria-describedby={closingAmountError ? 'closing-amount-error' : 'closing-amount-help'}
                    />
                    {closingAmountError ? (
                      <p id="closing-amount-error" className="text-sm text-destructive" role="alert">
                        {closingAmountError}
                      </p>
                    ) : (
                      <p id="closing-amount-help" className="text-xs text-muted-foreground">
                        Cuente el efectivo físico en gaveta. No incluya tarjeta ni transferencia.
                      </p>
                    )}
                  </div>

                  {hasCashDifference && (
                    <Alert variant="warning">
                      <AlertTriangle className="h-4 w-4" />
                      <div>
                        Hay una diferencia de <strong>{formatLempirasFromCents(difference)}</strong>. Se requerirá una nota explicativa al cerrar.
                      </div>
                    </Alert>
                  )}

                  {hasPendingBalance && (
                    <Alert variant="warning">
                      <AlertTriangle className="h-4 w-4" />
                      <div>
                        Hay <strong>{pendingInvoiceCount}</strong> factura(s) pendientes o parciales por{' '}
                        <strong>{formatLempirasFromCents(parseCents(pendingAmount))}</strong>. Revise los cobros antes de cerrar.
                      </div>
                    </Alert>
                  )}

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold" htmlFor="closing_notes">
                      Nota de cierre
                    </label>
                    <Textarea
                      id="closing_notes"
                      name="closing_notes"
                      value={closingNotes}
                      onChange={(e) => setClosingNotes(e.target.value)}
                      placeholder={hasCashDifference ? 'Obligatoria si hay diferencia (sobrante/faltante).' : 'Nota opcional...'}
                      rows={2}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="default"
                    disabled={closeSessionMutation.isPending || !canCloseCash || hasPendingBalance}
                  >
                    {closeSessionMutation.isPending ? 'Cerrando...' : 'Cerrar caja'}
                  </Button>
                  {!canCloseCash && (
                    <p className="text-sm text-muted-foreground">
                      Solo usuarios con permiso de cierre pueden cerrar caja.
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>

            {canViewCashSessionReport && movements && movements.length > 0 && (
              <CashMovementsTable movements={movements} />
            )}
          </>
        ) : canOpenCash ? (
          <OpenSessionForm
            isSubmitting={openSessionMutation.isPending}
            onSubmit={handleOpenSession}
          />
        ) : (
          <Alert variant="warning" title="Caja en modo consulta">
            Este usuario puede ver caja, pero no tiene permiso para abrir una nueva sesión.
          </Alert>
        )}
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
    </section>
  );
}
