import { type FormEvent, useEffect, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Input } from '../../components/ui/input';
import { LoadingState } from '../../components/ui/states';
import { type CashSession, apiClient } from '../../lib/api';

type CashBoxViewProps = {
  onStatus: (message: string) => void;
  onSessionChange?: (session: CashSession | null) => void;
};

export function CashBoxView({ onStatus, onSessionChange }: CashBoxViewProps) {
  const [session, setSession] = useState<CashSession | null>(null);
  const [openingAmount, setOpeningAmount] = useState('500.00');
  const [closingAmount, setClosingAmount] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [formAlert, setFormAlert] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void refreshCurrentSession();
  }, []);

  async function refreshCurrentSession() {
    setLoading(true);

    try {
      const current = await apiClient.getCurrentCashSession();
      setSession(current);
      setFormAlert(null);
      onSessionChange?.(current);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo leer la caja actual.';
      setFormAlert(message);
      onStatus(message);
    } finally {
      setLoading(false);
    }
  }

  async function openSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onStatus('Abriendo caja...');

    try {
      const opened = await apiClient.openCashSession({ opening_amount: openingAmount });
      setSession(opened);
      onSessionChange?.(opened);
      setClosingAmount('');
      setClosingNotes('');
      setFormAlert(null);
      onStatus('Caja abierta.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo abrir caja.';
      setFormAlert(message);
      onStatus(message);
    }
  }

  function requestCloseConfirmation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      return;
    }

    setConfirmingClose(true);
  }

  async function closeSession() {
    if (!session) {
      return;
    }

    onStatus('Cerrando caja...');
    setConfirmingClose(false);

    try {
      const closed = await apiClient.closeCashSession(session.id, {
        closing_amount: closingAmount,
        notes: closingNotes.trim() === '' ? null : closingNotes,
      });
      setSession(closed);
      onSessionChange?.(null);
      setClosingNotes('');
      setFormAlert(null);
      onStatus('Caja cerrada.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cerrar caja.';
      setFormAlert(message);
      onStatus(message);
    }
  }

  return (
    <section id="caja" className="cash-layout" aria-labelledby="cash-title">
      <Card>
        <CardHeader className="md:flex-row md:items-end md:justify-between">
          <div>
            <CardDescription>Operacion de caja</CardDescription>
            <CardTitle id="cash-title">Caja</CardTitle>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={refreshCurrentSession}>
            Actualizar
          </Button>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {formAlert ? (
            <div className="error-summary" role="alert" aria-live="assertive">
              {formAlert}
            </div>
          ) : null}

          {loading ? (
            <LoadingState label="Cargando estado de caja..." />
          ) : session?.status === 'open' ? (
            <div className="cash-state open-state" role="status">
              <Badge>Caja abierta</Badge>
              <strong>Monto inicial L. {session.opening_amount}</strong>
              <span>Abierta desde {formatDate(session.opened_at)}</span>
            </div>
          ) : (
            <div className="cash-state" role="status">
              <Badge variant="outline">Sin caja abierta</Badge>
              <strong>Pagos bloqueados</strong>
              <span>Abra caja antes de emitir y cobrar facturas.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {session?.status === 'open' ? (
        <form className="cash-panel" onSubmit={requestCloseConfirmation}>
          <CardDescription>Cierre auditado</CardDescription>
          <h2>Cerrar caja</h2>
          <label>
            Monto contado
            <Input
              value={closingAmount}
              onChange={(event) => setClosingAmount(event.target.value)}
              placeholder="517.25"
            />
          </label>
          <label>
            Nota de cierre
            <textarea
              value={closingNotes}
              onChange={(event) => setClosingNotes(event.target.value)}
              placeholder="Obligatoria si hay sobrante o faltante."
            />
          </label>
          <Button type="submit">Cerrar caja</Button>
          <dl className="totals-list">
            <div>
              <dt>Esperado</dt>
              <dd>{session.expected_amount ? `L. ${session.expected_amount}` : 'Se calcula al cierre'}</dd>
            </div>
            <div>
              <dt>Contado</dt>
              <dd>{session.closing_amount ? `L. ${session.closing_amount}` : 'Pendiente'}</dd>
            </div>
            <div>
              <dt>Diferencia</dt>
              <dd>{session.difference_amount ? `L. ${session.difference_amount}` : 'Pendiente'}</dd>
            </div>
          </dl>
        </form>
      ) : (
        <form className="cash-panel" onSubmit={openSession}>
          <CardDescription>Apertura de turno</CardDescription>
          <h2>Abrir caja</h2>
          <label>
            Monto inicial
            <Input value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} />
          </label>
          <Button type="submit">Abrir caja</Button>
        </form>
      )}

      <ConfirmDialog
        confirmLabel="Confirmar cierre"
        danger
        onCancel={() => setConfirmingClose(false)}
        onConfirm={() => void closeSession()}
        open={confirmingClose}
        title="Confirmar cierre de caja"
      >
        <div className="flex flex-col gap-2">
          <p>Caja: <strong>{session ? `#${session.id}` : 'Sin caja'}</strong></p>
          <p>Esperado: <strong>{session?.expected_amount ? `L. ${session.expected_amount}` : 'Se calcula al cierre'}</strong></p>
          <p>Contado: <strong>L. {closingAmount || '0.00'}</strong></p>
          <p>Diferencia: <strong>{session?.difference_amount ? `L. ${session.difference_amount}` : 'Se calculara al cerrar'}</strong></p>
          <p>Nota: <strong>{closingNotes.trim() || 'Sin nota'}</strong></p>
          <p>Revise el monto contado antes de confirmar. Esta accion queda auditada.</p>
        </div>
      </ConfirmDialog>
    </section>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
