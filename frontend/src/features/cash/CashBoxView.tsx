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
import { formatLempiras } from '@/lib/money';
import { STRINGS, t } from '@/lib/i18n';
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
  onSessionChange?: (session: CashSession | null) => void;
};

function parseCents(value: string): number {
  const normalized = value.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    return 0;
  }
  const sign = normalized.startsWith('-') ? -1 : 1;
  const unsigned = normalized.replace('-', '');
  const [integer, decimal = '00'] = unsigned.split('.');
  return sign * (Number(integer) * 100 + Number(decimal.padEnd(2, '0').slice(0, 2)));
}

function formatCents(cents: number): number {
  return cents / 100;
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
  const closingAmountRef = useRef<HTMLInputElement | null>(null);

  const { data: session, isLoading, refetch } = useQuery({
    queryKey: ['cash-sessions', 'current'],
    queryFn: () => apiClient.getCurrentCashSession(),
    // Multi-PC LAN: another cashier may close the box. Poll every
    // 10s so this UI shows "Sin caja" within the same window without
    // a manual refresh.
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  const { data: movementsData } = useQuery({
    queryKey: ['cash-sessions', session?.id, 'movements'],
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
    onSuccess: (opened) => {
      queryClient.setQueryData(['cash-sessions', 'current'], opened);
      queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
      setClosingAmount('');
      setClosingNotes('');
      setFormAlert(null);
      onSessionChange?.(opened);
      onStatus(t('cash.opened'));
    },
    onError: (error) => {
      const message = userSafeErrorMessage(error, t('cash.openError'));
      setFormAlert(message);
      onStatus(message);
    },
  });

  const closeSessionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { closing_amount: string; notes?: string | null } }) =>
      apiClient.closeCashSession(id, payload),
    onSuccess: () => {
      queryClient.setQueryData(['cash-sessions', 'current'], null);
      queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setClosingAmount('');
      setClosingNotes('');
      setFormAlert(null);
      onSessionChange?.(null);
      onStatus(t('cash.closed'));
    },
    onError: (error) => {
      const message = userSafeErrorMessage(error, t('cash.closeError'));
      setFormAlert(message);
      onStatus(message);
    },
  });

  const activeSession = session ?? cashSession;
  const expectedCashAmount = activeSession?.expected_cash_amount ?? activeSession?.expected_amount ?? activeSession?.opening_amount ?? '0.00';
  const hasValidClosingAmount = /^\d+(\.\d{1,2})?$/.test(closingAmount.trim());
  const difference = hasValidClosingAmount ? formatCents(parseCents(closingAmount) - parseCents(expectedCashAmount)) : null;
  const hasCashDifference = difference !== null && difference !== 0;
  const isOpen = activeSession?.status === 'open';
  const pendingInvoiceCount = activeSession?.pending_invoice_count ?? 0;
  const pendingAmount = activeSession?.pending_amount ?? '0.00';
  const hasPendingBalance = pendingInvoiceCount > 0 || parseCents(pendingAmount) > 0;

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => closingAmountRef.current?.focus(), 0);
    }
  }, [isOpen, activeSession?.id]);

  function handleOpenSession(data: { opening_amount: string }) {
    onStatus(t('cash.opening'));
    openSessionMutation.mutate({ opening_amount: data.opening_amount });
  }

  function handleCloseConfirmation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeSession) return;
    if (!canCloseCash) {
      setFormAlert(t('cash.closePermissionError'));
      return;
    }
    if (hasPendingBalance) {
      setFormAlert(STRINGS.cash.closePendingError(pendingInvoiceCount, formatLempiras(pendingAmount)));
      return;
    }
    if (closingAmount.trim() === '') {
      setClosingAmountError(t('cash.closeAmountRequired'));
      setFormAlert(null);
      closingAmountRef.current?.focus();
      return;
    }
    if (!hasValidClosingAmount) {
      setClosingAmountError(t('cash.closeAmountInvalid'));
      setFormAlert(null);
      closingAmountRef.current?.focus();
      return;
    }
    setClosingAmountError(null);
    setConfirmingClose(true);
  }

  function handleCloseSession() {
    if (!activeSession) return;
    onStatus(t('cash.closing'));
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardDescription>{t('cash.operationLabel')}</CardDescription>
              <CardTitle id="cash-title">{t('cash.title')}</CardTitle>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => void refetch()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {t('cash.refresh')}
            </Button>
          </CardHeader>

          <CardContent className="flex flex-col gap-4">
            {formAlert ? (
              <Alert variant="destructive" title={t('cash.errorTitle')}>
                {formAlert}
              </Alert>
            ) : null}

            <SessionStatusCard session={activeSession ?? null} />

            {isOpen && (
              <Alert variant="success" title={t('cash.readyTitle')}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span className="flex-1">
                    {t('cash.readyBody')}
                  </span>
                  <Button asChild size="sm">
                    <Link to="/billing/new">{t('cash.newInvoice')}</Link>
                  </Button>
                </div>
              </Alert>
            )}

            {isPOSBlocked && (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <div>
                  <strong>{t('cash.blockedTitle')}</strong> {t('cash.blockedBody')}
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
                  <CardTitle>{t('cash.summaryTitle')}</CardTitle>
                  <CardDescription>
                    {t('cash.summaryDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">{t('cash.methodCash')}</span>
                      <span className="text-xl font-bold">{formatLempiras(activeSession.payments_by_method.cash)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">{t('cash.methodTransfer')}</span>
                      <span className="text-xl font-bold">{formatLempiras(activeSession.payments_by_method.transfer)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">{t('cash.methodCard')}</span>
                      <span className="text-xl font-bold">{formatLempiras(activeSession.payments_by_method.card)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">{t('cash.methodOther')}</span>
                      <span className="text-xl font-bold">{formatLempiras(activeSession.payments_by_method.other)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">{t('cash.registeredPayments')}</span>
                      <span className="text-xl font-bold">{activeSession.payments_count ?? 0}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">{t('cash.pendingBalance')}</span>
                      <span className="text-xl font-bold">{formatLempiras(activeSession.pending_amount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>{t('cash.closeCardTitle')}</CardTitle>
                <CardDescription>{t('cash.closeCardDescription')}</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCloseConfirmation} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold" htmlFor="closing_amount">
                      {t('cash.closingAmountLabel')}
                    </label>
                    <Input
                      ref={closingAmountRef}
                      id="closing_amount"
                      type="text"
                      inputMode="decimal"
                      value={closingAmount}
                      onChange={(e) => {
                        setClosingAmount(e.target.value);
                        if (closingAmountError) setClosingAmountError(null);
                      }}
                      placeholder={t('cash.closingAmountPlaceholder')}
                      className="text-lg"
                      aria-invalid={closingAmountError ? 'true' : 'false'}
                      aria-describedby={closingAmountError ? 'closing-amount-error' : 'closing-amount-help'}
                    />
                    {closingAmountError ? (
                      <p id="closing-amount-error" className="text-sm text-destructive" role="alert">
                        {closingAmountError}
                      </p>
                    ) : (
                      <p id="closing-amount-help" className="text-xs text-muted-foreground">
                        {t('cash.closingAmountHelp')}
                      </p>
                    )}
                  </div>

                  {hasCashDifference && (
                    <Alert variant="warning">
                      <AlertTriangle className="h-4 w-4" />
                      <div>
                        {STRINGS.cash.differenceAlert(formatLempiras(difference))}
                      </div>
                    </Alert>
                  )}

                  {hasPendingBalance && (
                    <Alert variant="warning">
                      <AlertTriangle className="h-4 w-4" />
                      <div>
                        {STRINGS.cash.pendingAlert(pendingInvoiceCount, formatLempiras(pendingAmount))}
                      </div>
                    </Alert>
                  )}

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold" htmlFor="closing_notes">
                      {t('cash.notesLabel')}
                    </label>
                    <Textarea
                      id="closing_notes"
                      value={closingNotes}
                      onChange={(e) => setClosingNotes(e.target.value)}
                      placeholder={hasCashDifference ? t('cash.notesPlaceholderRequired') : t('cash.notesPlaceholderOptional')}
                      rows={2}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="default"
                    disabled={closeSessionMutation.isPending || !canCloseCash || hasPendingBalance}
                  >
                    {closeSessionMutation.isPending ? t('cash.closeSubmitting') : t('cash.closeSubmit')}
                  </Button>
                  {!canCloseCash && (
                    <p className="text-sm text-muted-foreground">
                      {t('cash.closeDisclaimer')}
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
          <Alert variant="warning" title={t('cash.consultModeTitle')}>
            {t('cash.consultModeBody')}
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
