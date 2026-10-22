import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { apiClient, type AuthUser } from './lib/api';
import { queryClient } from './lib/query-client';
import { resetRequestChain } from './lib/api/base';

type SessionOverrides = Partial<AuthUser>;

function sessionUser(overrides: SessionOverrides = {}): AuthUser {
  return {
    id: 1,
    name: 'Usuario de prueba',
    email: 'prueba@hospital.local',
    username: 'prueba',
    active: true,
    roles: ['supervisor'],
    permissions: ['cash.view', 'invoices.view', 'reports.managerial.view'],
    must_change_password: false,
    ...overrides,
  };
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function mockAuthenticatedFetch(user: AuthUser) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);

    if (url.includes('/api/auth/session')) {
      return jsonResponse({ data: user });
    }

    if (url.includes('/api/cash-sessions/current')) {
      return jsonResponse({ data: null });
    }

    return jsonResponse({ data: null });
  });
}

describe('App: nueva experiencia "Panel administrativo"', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    resetRequestChain();
    await queryClient.cancelQueries();
    queryClient.clear();
    window.history.pushState({}, '', '/');
    vi.spyOn(apiClient, 'getLogo').mockResolvedValue(null);
  });

  afterEach(async () => {
    cleanup();
    await queryClient.cancelQueries();
    queryClient.clear();
  });

  it('muestra la superficie de acceso nueva cuando no hay sesión', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ data: null }));

    render(<App />);

    expect(await screen.findByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/usuario o correo/i)).toHaveValue('');
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it('no solicita datos protegidos de caja antes de autenticar', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ data: null }));

    render(<App />);

    expect(await screen.findByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(fetchMock.mock.calls.map(([input]) => String(input))).not.toContain(
      '/api/cash-sessions/current',
    );
  });

  it('aterriza al cajero en /cobrar y muestra la barra superior de textos', async () => {
    mockAuthenticatedFetch(
      sessionUser({
        roles: ['cajero'],
        permissions: [
          'invoices.create',
          'catalog.view',
          'cash.view',
          'payments.create',
          'receipts.view',
          'invoices.view',
        ],
      }),
    );

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/cobrar'));
    expect(await screen.findByRole('heading', { level: 1, name: /^cobrar$/i })).toBeInTheDocument();

    const navigation = screen.getByRole('navigation', { name: /navegación principal/i });
    expect(navigation).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^cobrar$/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /omitir al contenido principal/i })).toHaveAttribute(
      'href',
      '#main-content',
    );
  });

  it('aterriza a supervisión en /resumen y redirige /dashboard', async () => {
    mockAuthenticatedFetch(sessionUser());
    window.history.pushState({}, '', '/dashboard');

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/resumen'));
    expect(await screen.findByRole('heading', { level: 1, name: /^resumen$/i })).toBeInTheDocument();
  });

  it('mantiene el cambio obligatorio de contraseña', async () => {
    mockAuthenticatedFetch(
      sessionUser({ must_change_password: true, roles: ['admin'], permissions: [] }),
    );

    render(<App />);

    // El flujo sigue bloqueando la sesión en PasswordChangeView (App.tsx:
    // must_change_password). El encabezado reasignado por el usted-rediseño
    // del acceso es "Proteja su cuenta" (PasswordChangeView.tsx:48); la
    // garantía intacta es la pantalla bloqueante del cambio.
    expect(
      await screen.findByRole('heading', { name: /^Proteja su cuenta$/i }),
    ).toBeInTheDocument();
  });

  it('muestra el estado no encontrado para una ruta desconocida', async () => {
    mockAuthenticatedFetch(sessionUser());
    window.history.pushState({}, '', '/ruta-inexistente');

    render(<App />);

    expect(await screen.findByText(/ruta no encontrada/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir al inicio/i })).toHaveAttribute('href', '/resumen');
  });
});
