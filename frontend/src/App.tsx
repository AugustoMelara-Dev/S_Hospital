import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  type AuthUser,
  type CashSession,
  type FiscalSequence,
  type FiscalSettings,
  apiClient,
} from './lib/api';
import { CashBoxView } from './features/cash/CashBoxView';
import { BackupsView } from './features/backups/BackupsView';
import { CatalogView } from './features/catalog/CatalogView';
import { InvoiceHistoryView } from './features/invoices/InvoiceHistoryView';
import { NewInvoiceView } from './features/invoices/NewInvoiceView';
import { ReportsView } from './features/reports/ReportsView';

const emptySequence: FiscalSequence = {
  document_type: 'invoice',
  prefix: '',
  min_number: 1,
  max_number: 99999999,
  current_number: 0,
  cai: '',
  valid_until: '',
  active: false,
};

export function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [settings, setSettings] = useState<FiscalSettings>({
    hospital_name: '',
    rtn: '',
    default_tax_rate: '15.00',
    receipt_width: '80mm',
  });
  const [sequences, setSequences] = useState<FiscalSequence[]>([]);
  const [cashSession, setCashSession] = useState<CashSession | null>(null);
  const [sequenceForm, setSequenceForm] = useState<FiscalSequence>(emptySequence);
  const [login, setLogin] = useState(import.meta.env.DEV ? 'admin.demo' : '');
  const [password, setPassword] = useState('');
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    password: '',
    password_confirmation: '',
  });
  const [status, setStatus] = useState('Listo para iniciar sesion local.');
  const [loading, setLoading] = useState(true);

  const canEditFiscalSettings = useMemo(
    () => user?.permissions.includes('settings.fiscal.update') ?? false,
    [user],
  );
  const canViewFiscalSettings = useMemo(
    () => user?.permissions.includes('settings.fiscal.view') ?? false,
    [user],
  );
  const canViewCatalog = useMemo(() => user?.permissions.includes('catalog.view') ?? false, [user]);
  const canCreateInvoices = useMemo(
    () => user?.permissions.includes('invoices.create') ?? false,
    [user],
  );
  const canViewInvoices = useMemo(
    () => user?.permissions.includes('invoices.view') ?? false,
    [user],
  );
  const canViewCash = useMemo(() => user?.permissions.includes('cash.view') ?? false, [user]);
  const canViewReports = useMemo(() => user?.permissions.includes('reports.view') ?? false, [user]);
  const canViewBackups = useMemo(() => user?.permissions.includes('backups.view') ?? false, [user]);

  useEffect(() => {
    apiClient
      .me()
      .then((currentUser) => {
        setUser(currentUser);
        setStatus('Sesion activa.');
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.permissions.includes('settings.fiscal.view') || user.must_change_password) {
      return;
    }

    apiClient
      .getFiscalSettings()
      .then((data) => {
        if (data) {
          setSettings(data);
        }
      })
      .catch((error: Error) => setStatus(error.message));

    apiClient
      .getFiscalSequences()
      .then((data) => {
        setSequences(data);
        setSequenceForm(data[0] ?? emptySequence);
      })
      .catch((error: Error) => setStatus(error.message));
  }, [user]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('Validando credenciales...');

    try {
      const loggedUser = await apiClient.login(login, password);
      const currentUser = await apiClient.me().catch(() => loggedUser);
      setUser(currentUser);
      setPassword('');
      setStatus(
        currentUser.must_change_password
          ? 'El usuario debe cambiar su contrasena antes de operar.'
          : 'Sesion iniciada.',
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo iniciar sesion.');
    }
  }

  async function handleLogout() {
    await apiClient.logout().catch(() => undefined);
    setUser(null);
    setStatus('Sesion cerrada.');
  }

  async function handleFiscalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('Guardando configuracion fiscal...');

    try {
      const updated = await apiClient.updateFiscalSettings(settings);
      setSettings(updated);
      setStatus('Configuracion fiscal guardada.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo guardar.');
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('Actualizando contrasena...');

    try {
      const updatedUser = await apiClient.changePassword(passwordForm);
      setUser(updatedUser);
      setPasswordForm({
        current_password: '',
        password: '',
        password_confirmation: '',
      });
      setStatus('Contrasena actualizada.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo actualizar la contrasena.');
    }
  }

  async function handleSequenceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('Guardando secuencia fiscal...');

    try {
      const saved = await apiClient.saveFiscalSequence(sequenceForm);
      const nextSequences = sequenceForm.id
        ? sequences.map((sequence) => (sequence.id === saved.id ? saved : sequence))
        : [saved, ...sequences];
      setSequences(nextSequences);
      setSequenceForm(saved);
      setStatus('Secuencia fiscal guardada.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo guardar la secuencia.');
    }
  }

  if (loading) {
    return <main className="app-shell">Cargando sesion...</main>;
  }

  if (!user) {
    return (
      <main className="auth-screen">
        <section className="login-panel" aria-labelledby="login-title">
          <p className="app-kicker">Hospital Billing OS Offline</p>
          <h1 id="login-title">Acceso local</h1>
          <form onSubmit={handleLogin} className="form-stack">
            <label>
              Usuario o email
              <input value={login} onChange={(event) => setLogin(event.target.value)} />
            </label>
            <label>
              Contrasena
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            <button type="submit">Entrar</button>
          </form>
          <p className="form-status" role="status">
            {status}
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="app-kicker">Hospital Billing OS Offline</p>
          <h1>Panel local</h1>
        </div>
        <div className="user-box">
          <strong>{user.name}</strong>
          <span>{user.roles.join(', ')}</span>
          <button type="button" onClick={handleLogout}>
            Salir
          </button>
        </div>
      </header>

      {user.must_change_password ? (
        <form onSubmit={handlePasswordSubmit} className="settings-form password-panel">
          <h2>Cambio obligatorio de contrasena</h2>
          <label>
            Contrasena actual
            <input
              type="password"
              value={passwordForm.current_password}
              onChange={(event) =>
                setPasswordForm({ ...passwordForm, current_password: event.target.value })
              }
            />
          </label>
          <label>
            Nueva contrasena
            <input
              type="password"
              value={passwordForm.password}
              onChange={(event) => setPasswordForm({ ...passwordForm, password: event.target.value })}
            />
          </label>
          <label>
            Confirmar nueva contrasena
            <input
              type="password"
              value={passwordForm.password_confirmation}
              onChange={(event) =>
                setPasswordForm({ ...passwordForm, password_confirmation: event.target.value })
              }
            />
          </label>
          <button type="submit">Actualizar contrasena</button>
        </form>
      ) : !canViewFiscalSettings &&
        !canViewCatalog &&
        !canCreateInvoices &&
        !canViewCash &&
        !canViewInvoices &&
        !canViewReports &&
        !canViewBackups ? (
        <section className="notice" role="alert">No tiene permisos operativos asignados.</section>
      ) : (
        <>
          {canViewCash ? <CashBoxView onStatus={setStatus} onSessionChange={setCashSession} /> : null}

          {canCreateInvoices ? (
            <NewInvoiceView cashSession={cashSession} onStatus={setStatus} />
          ) : null}

          {canViewInvoices ? <InvoiceHistoryView user={user} onStatus={setStatus} /> : null}

          {canViewReports ? <ReportsView onStatus={setStatus} /> : null}

          {canViewBackups ? <BackupsView user={user} onStatus={setStatus} /> : null}

          {canViewFiscalSettings ? (
            <section className="settings-layout">
              <form onSubmit={handleFiscalSubmit} className="settings-form">
                <h2>Datos fiscales del hospital</h2>
                <label>
                  Hospital
                  <input
                    value={settings.hospital_name}
                    disabled={!canEditFiscalSettings}
                    onChange={(event) =>
                      setSettings({ ...settings, hospital_name: event.target.value })
                    }
                  />
                </label>
                <label>
                  RTN
                  <input
                    value={settings.rtn}
                    disabled={!canEditFiscalSettings}
                    onChange={(event) => setSettings({ ...settings, rtn: event.target.value })}
                  />
                </label>
                <label>
                  ISV por defecto
                  <input
                    value={settings.default_tax_rate}
                    disabled={!canEditFiscalSettings}
                    onChange={(event) =>
                      setSettings({ ...settings, default_tax_rate: event.target.value })
                    }
                  />
                </label>
                <label>
                  Ancho de recibo
                  <select
                    value={settings.receipt_width}
                    disabled={!canEditFiscalSettings}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        receipt_width: event.target.value as FiscalSettings['receipt_width'],
                      })
                    }
                  >
                    <option value="80mm">80mm</option>
                    <option value="58mm">58mm</option>
                  </select>
                </label>
                <button type="submit" disabled={!canEditFiscalSettings}>
                  Guardar configuracion
                </button>
              </form>

              <form onSubmit={handleSequenceSubmit} className="settings-form">
                <h2>Secuencia fiscal</h2>
                <label>
                  CAI
                  <input
                    value={sequenceForm.cai}
                    disabled={!canEditFiscalSettings}
                    onChange={(event) =>
                      setSequenceForm({ ...sequenceForm, cai: event.target.value })
                    }
                  />
                </label>
                <label>
                  Prefijo
                  <input
                    value={sequenceForm.prefix}
                    disabled={!canEditFiscalSettings}
                    onChange={(event) =>
                      setSequenceForm({ ...sequenceForm, prefix: event.target.value })
                    }
                  />
                </label>
                <div className="field-grid">
                  <label>
                    Rango minimo
                    <input
                      type="number"
                      value={sequenceForm.min_number}
                      disabled={!canEditFiscalSettings}
                      onChange={(event) =>
                        setSequenceForm({
                          ...sequenceForm,
                          min_number: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label>
                    Rango maximo
                    <input
                      type="number"
                      value={sequenceForm.max_number}
                      disabled={!canEditFiscalSettings}
                      onChange={(event) =>
                        setSequenceForm({
                          ...sequenceForm,
                          max_number: Number(event.target.value),
                        })
                      }
                    />
                  </label>
                </div>
                <label>
                  Correlativo actual
                  <input
                    type="number"
                    value={sequenceForm.current_number}
                    disabled={!canEditFiscalSettings}
                    onChange={(event) =>
                      setSequenceForm({
                        ...sequenceForm,
                        current_number: Number(event.target.value),
                      })
                    }
                  />
                </label>
                <label>
                  Fecha limite
                  <input
                    type="date"
                    value={sequenceForm.valid_until}
                    disabled={!canEditFiscalSettings}
                    onChange={(event) =>
                      setSequenceForm({ ...sequenceForm, valid_until: event.target.value })
                    }
                  />
                </label>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={sequenceForm.active}
                    disabled={!canEditFiscalSettings}
                    onChange={(event) =>
                      setSequenceForm({ ...sequenceForm, active: event.target.checked })
                    }
                  />
                  Secuencia activa
                </label>
                <button type="submit" disabled={!canEditFiscalSettings}>
                  Guardar secuencia
                </button>
                {sequences.length > 0 ? (
                  <div className="sequence-list" aria-label="Secuencias fiscales">
                    {sequences.map((sequence) => (
                      <button
                        key={sequence.id}
                        type="button"
                        className="secondary-button"
                        onClick={() => setSequenceForm(sequence)}
                      >
                        {sequence.prefix} - {sequence.active ? 'Activa' : 'Inactiva'}
                      </button>
                    ))}
                  </div>
                ) : null}
              </form>

              <aside className="notice">
                {canEditFiscalSettings
                  ? 'Admin puede editar. El backend valida el permiso.'
                  : 'Lectura protegida. Solo admin puede editar configuracion fiscal.'}
              </aside>
            </section>
          ) : null}

          {canViewCatalog ? <CatalogView user={user} onStatus={setStatus} /> : null}
        </>
      )}

      <p className="form-status" role="status">
        {status}
      </p>
    </main>
  );
}
