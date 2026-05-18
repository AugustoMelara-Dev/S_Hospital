import { type FormEvent, useState } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type CashSession, apiClient, userSafeErrorMessage } from '@/lib/api';
import { SessionStatusCard } from './components/SessionStatusCard';
import { OpenSessionForm } from './components/OpenSessionForm';
import { SessionSummary } from './components/SessionSummary';
import { CloseSessionDialog } from './components/CloseSessionDialog';
import { CashMovementsTable } from './components/CashMovementsTable';

type CashBoxViewProps = {
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

export function CashBoxView({ compact = false, onStatus, onSessionChange }: CashBoxViewProps) {
  const queryClient = useQueryClient();
  const [closingAmount, setClosingAmount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [formAlert, setFormAlert] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);

  const { data: session, isLoading, refetch } = useQuery({
    queryKey: ['cash-sessions', 'current'],
    queryFn: () => apiClient.getCurrentCashSession(),
  });

  const { data: movements } = useQuery({
    queryKey: ['cash-sessions', session?.id, 'movements'],
    queryFn: () =>
      session?.id
        ? apiClient.getCashSessionReport(String(session.id)).then((report) => report.movements)
        : Promise.resolve([]),
    enabled: !!session?.id,
  });

  const openSessionMutation = useMutation({
    mutationFn: (payload: { opening_amount: string; notes?: string | null }) =>
      apiClient.openCashSession(payload),
    onSuccess: (opened) => {
      queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
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
  });

  const closeSessionMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: { closing_amount: string; notes?: string | null } }) =>
      apiClient.closeCashSession(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
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
  });

  const expectedCashAmount = session?.expected_cash_amount ?? session?.expected_amount ?? session?.opening_amount ?? '0.00';
  const difference = formatCents(parseCents(closingAmount || '0.00') - parseCents(expectedCashAmount));
  const isOpen = session?.status === 'open';

  function handleOpenSession(data: { opening_amount: string }) {
    onStatus('Abriendo caja...');
    openSessionMutation.mutate({ opening_amount: data.opening_amount });
  }

  function handleCloseConfirmation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session) return;
    setConfirmingClose(true);
  }

  function handleCloseSession() {
    if (!session) return;
    onStatus('Cerrando caja...');
    setConfirmingClose(false);
    closeSessionMutation.mutate({
      id: session.id,
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
              <CardDescription>Operación de caja</CardDescription>
              <CardTitle id="cash-title">Caja</CardTitle>
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

            <SessionStatusCard session={session ?? null} />

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

        {isOpen && session ? (
          <>
            <SessionSummary
              session={session}
              closingAmount={closingAmount}
              difference={difference}
              onClosingAmountChange={setClosingAmount}
            />

            {session.payments_by_method && (
              <Card>
                <CardHeader>
                  <CardTitle>Resumen por Método de Pago</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Efectivo</span>
                      <span className="text-xl font-bold">L. {session.payments_by_method.cash ?? '0.00'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Transferencia</span>
                      <span className="text-xl font-bold">L. {session.payments_by_method.transfer ?? '0.00'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Tarjeta</span>
                      <span className="text-xl font-bold">L. {session.payments_by_method.card ?? '0.00'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm text-muted-foreground">Pagos registrados</span>
                      <span className="text-xl font-bold">{session.payments_count ?? 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Cerrar Caja</CardTitle>
                <CardDescription>Cierre auditado de la sesión actual</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCloseConfirmation} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold" htmlFor="closing_amount">
                      Monto Contado (L.) *
                    </label>
                    <Input
                      id="closing_amount"
                      type="text"
                      inputMode="decimal"
                      value={closingAmount}
                      onChange={(e) => setClosingAmount(e.target.value)}
                      placeholder="0.00"
                      className="text-lg"
                    />
                  </div>

                  {difference !== 0 && (
                    <Alert variant="warning">
                      <AlertTriangle className="h-4 w-4" />
                      <div>
                        Hay una diferencia de <strong>L. {difference.toFixed(2)}</strong>. Se requerirá una nota explicativa al cerrar.
                      </div>
                    </Alert>
                  )}

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold" htmlFor="closing_notes">
                      Nota de Cierre
                    </label>
                    <Textarea
                      id="closing_notes"
                      value={closingNotes}
                      onChange={(e) => setClosingNotes(e.target.value)}
                      placeholder={difference !== 0 ? 'Obligatoria si hay diferencia (sobrante/faltante).' : 'Nota opcional...'}
                      rows={2}
                    />
                  </div>

                  <Button
                    type="submit"
                    variant="default"
                    disabled={closeSessionMutation.isPending}
                  >
                    {closeSessionMutation.isPending ? 'Cerrando...' : 'Cerrar Caja'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {movements && movements.length > 0 && (
              <CashMovementsTable movements={movements} />
            )}
          </>
        ) : (
          <OpenSessionForm
            isSubmitting={openSessionMutation.isPending}
            onSubmit={handleOpenSession}
          />
        )}
      </div>

      <CloseSessionDialog
        open={confirmingClose}
        onOpenChange={setConfirmingClose}
        session={{
          opening_amount: session?.opening_amount ?? '0',
          expected_cash_amount: session?.expected_cash_amount ?? session?.expected_amount ?? undefined,
        }}
        closingAmount={closingAmount}
        closingNotes={closingNotes}
        difference={difference}
        isSubmitting={closeSessionMutation.isPending}
        onClosingNotesChange={setClosingNotes}
        onConfirm={handleCloseSession}
      />
    </section>
  );
}
