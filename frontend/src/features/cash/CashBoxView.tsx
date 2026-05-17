import { type FormEvent, useEffect, useState } from 'react';
import { type CashSession, apiClient } from '../../lib/api';

type CashBoxViewProps = {
  onStatus: (message: string) => void;
  onSessionChange?: (session: CashSession | null) => void;
};

export function CashBoxView({ onStatus, onSessionChange }: CashBoxViewProps) {
  const [session, setSession] = useState<CashSession | null>(null);
  const [openingAmount, setOpeningAmount] = useState('500.00');
  const [closingAmount, setClosingAmount] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void refreshCurrentSession();
  }, []);

  async function refreshCurrentSession() {
    setLoading(true);

    try {
      const current = await apiClient.getCurrentCashSession();
      setSession(current);
      onSessionChange?.(current);
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'No se pudo leer la caja actual.');
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
      onStatus('Caja abierta.');
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'No se pudo abrir caja.');
    }
  }

  async function closeSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session) {
      return;
    }

    onStatus('Cerrando caja...');

    try {
      const closed = await apiClient.closeCashSession(session.id, { closing_amount: closingAmount });
      setSession(closed);
      onSessionChange?.(null);
      onStatus('Caja cerrada.');
    } catch (error) {
      onStatus(error instanceof Error ? error.message : 'No se pudo cerrar caja.');
    }
  }

  return (
    <section className="cash-layout" aria-labelledby="cash-title">
      <div className="cash-panel">
        <div className="section-heading">
          <div>
            <p className="app-kicker">Fase 5</p>
            <h2 id="cash-title">Caja</h2>
          </div>
          <button type="button" className="secondary-button compact-button" onClick={refreshCurrentSession}>
            Actualizar
          </button>
        </div>

        {loading ? (
          <p>Cargando estado de caja...</p>
        ) : session?.status === 'open' ? (
          <div className="cash-state open-state" role="status">
            <strong>Caja abierta</strong>
            <span>Monto inicial L. {session.opening_amount}</span>
            <span>Abierta desde {formatDate(session.opened_at)}</span>
          </div>
        ) : (
          <div className="cash-state" role="status">
            <strong>Sin caja abierta</strong>
            <span>Los pagos quedan bloqueados hasta abrir caja.</span>
          </div>
        )}
      </div>

      {session?.status === 'open' ? (
        <form className="cash-panel" onSubmit={closeSession}>
          <h2>Cerrar caja</h2>
          <label>
            Monto contado
            <input
              value={closingAmount}
              onChange={(event) => setClosingAmount(event.target.value)}
              placeholder="517.25"
            />
          </label>
          <button type="submit">Cerrar caja</button>
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
          <h2>Abrir caja</h2>
          <label>
            Monto inicial
            <input value={openingAmount} onChange={(event) => setOpeningAmount(event.target.value)} />
          </label>
          <button type="submit">Abrir caja</button>
        </form>
      )}
    </section>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-HN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}
