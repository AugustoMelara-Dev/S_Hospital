import type { AppRoute } from '../routes';
import { apiClient } from '../lib/api';

type AppShellProps = {
  routes: AppRoute[];
};

export function AppShell({ routes }: AppShellProps) {
  const apiBaseUrl = apiClient.baseUrl || 'same-origin /api';

  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="app-title">
        <div className="hero__content">
          <p className="app-kicker">Hospital Billing OS Offline</p>
          <h1 id="app-title">Backend y frontend listos para construir el core de facturacion.</h1>
          <p className="hero__copy">
            Bootstrap React + TypeScript preparado para trabajar contra la API Laravel local, sin
            implementar todavia auth, catalogo, caja, pagos ni reportes.
          </p>
        </div>

        <aside className="status-panel" aria-label="Estado del bootstrap frontend">
          <span className="status-panel__label">API base</span>
          <strong>{apiBaseUrl}</strong>
          <span className="status-panel__hint">Configurable con VITE_API_BASE_URL.</span>
        </aside>
      </section>

      <section className="route-section" aria-labelledby="routes-title">
        <div>
          <h2 id="routes-title">Rutas preparadas</h2>
          <p>La navegacion real se conectara en fases posteriores.</p>
        </div>

        <ul className="route-list" aria-label="Rutas base">
          {routes.map((route) => (
            <li key={route.path}>
              <span>{route.label}</span>
              <small>
                {route.path} · {route.phase}
              </small>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

