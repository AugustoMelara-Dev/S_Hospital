import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  type AuthUser,
  type FiscalSettings,
  apiClient,
} from './lib/api';

export function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [settings, setSettings] = useState<FiscalSettings>({
    hospital_name: '',
    rtn: '',
    default_tax_rate: '15.00',
    receipt_width: '80mm',
  });
  const [login, setLogin] = useState('admin.demo');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('Listo para iniciar sesion local.');
  const [loading, setLoading] = useState(true);

  const canEditFiscalSettings = useMemo(
    () => user?.permissions.includes('settings.fiscal.update') ?? false,
    [user],
  );

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
  }, [user]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('Validando credenciales...');

    try {
      const loggedUser = await apiClient.login(login, password);
      setUser(loggedUser);
      setPassword('');
      setStatus(
        loggedUser.must_change_password
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
          <h1>Configuracion fiscal</h1>
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
        <section className="notice" role="alert">
          Debe cambiar su contrasena antes de usar el sistema operativo.
        </section>
      ) : (
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

          <aside className="notice">
            {canEditFiscalSettings
              ? 'Admin puede editar. El backend valida el permiso.'
              : 'Lectura protegida. Solo admin puede editar configuracion fiscal.'}
          </aside>
        </section>
      )}

      <p className="form-status" role="status">
        {status}
      </p>
    </main>
  );
}
