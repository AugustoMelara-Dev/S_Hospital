import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { apiError, makeMe, mockApi } from '@/test/mockApi';
import { renderApp } from '@/test/render';

const branding = { hospital_name: 'Hospital Escuela de Prueba', slogan: null, has_logo: false };

const cajero = makeMe({
  name: 'Luis Cajero',
  role: { code: 'cajero', name: 'Caja' },
  permissions: [
    'catalog.view',
    'invoices.view',
    'invoices.create',
    'cash.view',
    'cash.open',
    'cash.close',
    'payments.create',
    'payments.view',
    'receipts.view',
    'receipts.reprint',
    'reports.own',
    'patients.mark_dialysis_prescription',
  ],
});

describe('login', () => {
  it('redirects anonymous users to /login and shows the lockout message on 423', async () => {
    const user = userEvent.setup();
    mockApi({
      'GET /auth/me': apiError(401, 'unauthenticated', 'Sin sesión'),
      'GET /branding': branding,
      'POST /auth/login': apiError(423, 'login_locked', 'Bloqueado'),
    });
    const { router } = renderApp('/recibos');
    expect(await screen.findByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');

    await user.type(screen.getByLabelText('Usuario o correo'), 'ana');
    await user.type(screen.getByLabelText('Contraseña'), 'x');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Demasiados intentos. Espere 15 minutos.');
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    mockApi({ 'GET /auth/me': apiError(401, 'unauthenticated', ''), 'GET /branding': branding });
    renderApp('/login');
    const pw = await screen.findByLabelText('Contraseña');
    expect(pw).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Mostrar' }));
    expect(pw).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Ocultar' })).toBeInTheDocument();
  });

  it('sends a cashier to /cobrar after login', async () => {
    const user = userEvent.setup();
    let session = false;
    mockApi({
      'GET /auth/me': () => (session ? cajero : apiError(401, 'unauthenticated', '')),
      'GET /branding': branding,
      'POST /auth/login': () => {
        session = true;
        return cajero;
      },
      'GET /cash-sessions/current': null,
    });
    const { router } = renderApp('/login');
    await user.type(await screen.findByLabelText('Usuario o correo'), 'luis');
    await user.type(screen.getByLabelText('Contraseña'), 'Secreta-123456');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/cobrar'));
    expect(await screen.findByRole('heading', { name: 'Cobrar' })).toBeInTheDocument();
  });

  it('forces the password change', async () => {
    mockApi({ 'GET /auth/me': makeMe({ must_change_password: true }) });
    const { router } = renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Proteja su cuenta' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/cambiar-clave');
  });
});

describe('shell', () => {
  it('hides navigation without permission and shows the cash status', async () => {
    mockApi({
      'GET /auth/me': cajero,
      'GET /cash-sessions/current': { id: 3, status: 'open', opened_at: '2026-11-17T07:02:00-06:00', cash_register_id: 1 },
    });
    renderApp('/');
    const nav = await screen.findByRole('navigation', { name: 'Navegación principal' });
    expect(within(nav).getByRole('link', { name: /Cobrar/ })).toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /Usuarios/ })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /Auditoría/ })).not.toBeInTheDocument();
    expect(await screen.findByText(/· abierta/)).toHaveTextContent('Caja · abierta 07:02');
    expect(screen.getByRole('img', { name: /^Turno: Apertura completado/ })).toBeInTheDocument();
  });

  it('blocks routes without permission', async () => {
    mockApi({ 'GET /auth/me': cajero, 'GET /cash-sessions/current': null });
    renderApp('/admin/usuarios');
    expect(await screen.findByText('No tiene permiso para ver esta sección')).toBeInTheDocument();
    expect(await screen.findByText('Sin caja abierta')).toBeInTheDocument();
  });

  it('opens the command palette with Ctrl+K and searches receipts', async () => {
    const user = userEvent.setup();
    mockApi({ 'GET /auth/me': cajero, 'GET /cash-sessions/current': null });
    const { router } = renderApp('/');
    await screen.findByRole('heading', { name: 'Resumen' });
    await user.keyboard('{Control>}k{/Control}');
    const input = await screen.findByRole('combobox');
    await user.type(input, 'María López');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/recibos'));
    expect(router.state.location.search).toBe('?search=Mar%C3%ADa%20L%C3%B3pez');
  });

  it('F2 goes to /cobrar', async () => {
    const user = userEvent.setup();
    mockApi({ 'GET /auth/me': cajero, 'GET /cash-sessions/current': null });
    const { router } = renderApp('/recibos');
    await screen.findByRole('heading', { name: 'Recibos' });
    await user.keyboard('{F2}');
    await waitFor(() => expect(router.state.location.pathname).toBe('/cobrar'));
  });

  it('shows 404 for unknown routes', async () => {
    mockApi({ 'GET /auth/me': cajero, 'GET /cash-sessions/current': null });
    renderApp('/no-existe');
    expect(await screen.findByText('Página no encontrada')).toBeInTheDocument();
  });
});
