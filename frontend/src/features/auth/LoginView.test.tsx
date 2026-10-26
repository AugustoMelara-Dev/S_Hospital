import type React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginView } from './LoginView';

const Wrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe('LoginView', () => {
  const defaultProps = {
    login: '',
    password: '',
    status: '',
    onLoginChange: vi.fn(),
    onPasswordChange: vi.fn(),
    onSubmit: vi.fn(),
  };

  it('renders login form with all elements', () => {
    render(<LoginView {...defaultProps} />, { wrapper: Wrapper });

    expect(screen.getByText('Usuario o correo')).toBeInTheDocument();
    expect(screen.getByText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it('keeps the login focused on identity and credentials without technical copy', () => {
    render(<LoginView {...defaultProps} />, { wrapper: Wrapper });

    expect(screen.queryByText(/identidad provisional/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/acceso seguro|estación de trabajo|caja y facturación, listas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/infraestructura|módulos autorizados|administración|LAN|offline/i)).not.toBeInTheDocument();
    expect(screen.getByText('Ingrese con su usuario y contraseña.')).toBeVisible();
    const heading = screen.getByRole('heading', { name: 'Iniciar sesión' });
    expect(heading).toBeVisible();
    expect(heading.closest('section')).not.toBeNull();
    expect(screen.getByLabelText(/usuario o correo/i)).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText(/^contrase/i)).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.queryByText(/operación financiera clara/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/gestión hospitalaria institucional/i)).not.toBeInTheDocument();
  });

  it('calls onLoginChange when user types in login field', () => {
    const onLoginChange = vi.fn();
    render(<LoginView {...defaultProps} onLoginChange={onLoginChange} />, { wrapper: Wrapper });

    const loginInput = screen.getByText('Usuario o correo').closest('input') || screen.getByPlaceholderText('ej. cajero_01');
    if (loginInput) {
      fireEvent.change(loginInput, { target: { value: 'cajero_01' } });
      expect(onLoginChange).toHaveBeenCalledWith('cajero_01');
    }
  });

  it('calls onPasswordChange when user types in password field', () => {
    const onPasswordChange = vi.fn();
    render(<LoginView {...defaultProps} onPasswordChange={onPasswordChange} />, { wrapper: Wrapper });

    const passwordInput = screen.getByText('Contraseña').closest('input') || screen.getByPlaceholderText('Ingrese su contraseña');
    if (passwordInput) {
      fireEvent.change(passwordInput, { target: { value: 'secret123' } });
      expect(onPasswordChange).toHaveBeenCalledWith('secret123');
    }
  });

  it('calls onSubmit when form is submitted', () => {
    const onSubmit = vi.fn();
    render(<LoginView {...defaultProps} onSubmit={onSubmit} />, { wrapper: Wrapper });

    fireEvent.submit(screen.getByRole('button', { name: /iniciar sesión/i }).closest('form')!);

    expect(onSubmit).toHaveBeenCalled();
  });

  it('shows error message when status contains error', () => {
    render(<LoginView {...defaultProps} status="Credenciales inválidas" />, { wrapper: Wrapper });

    expect(screen.getByText(/credenciales inválidas/i)).toBeInTheDocument();
    expect(screen.getByRole('alert').className).toContain('--ui-danger');
  });

  it('announces benign connection progress as status instead of an alert', () => {
    render(<LoginView {...defaultProps} status="Conectando con el servidor local..." />, { wrapper: Wrapper });

    expect(screen.getByRole('status')).toHaveTextContent(/conectando con el servidor local/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('uses neutral feedback and blocks duplicate submit while validating credentials', () => {
    const onSubmit = vi.fn();
    render(
      <LoginView
        {...defaultProps}
        submitting
        status="Validando credenciales"
        onSubmit={onSubmit}
      />,
      { wrapper: Wrapper },
    );

    const button = screen.getByRole('button', { name: /comprobando acceso/i });
    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Comprobando acceso');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.submit(button.closest('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('announces an expired session as a warning with a stable recovery action', () => {
    render(<LoginView {...defaultProps} status="Sesión cerrada por el servidor. Inicie sesión nuevamente." />, { wrapper: Wrapper });

    const alert = screen.getByRole('alert');
    expect(alert.className).not.toContain('--ui-danger');
    expect(alert).toHaveTextContent(/inicie sesión nuevamente/i);
    expect(alert).not.toHaveTextContent(/redirigiendo/i);
  });

  it('disables submit button when countdown is active', () => {
    render(<LoginView {...defaultProps} status="Demasiados intentos. Bloqueado temporalmente" />, { wrapper: Wrapper });

    const button = screen.getByRole('button', { name: /bloqueado/i });
    expect(button).toBeDisabled();
  });

  it('treats backend 423 account lockout as destructive and blocks form submit', () => {
    const onSubmit = vi.fn();
    render(
      <LoginView
        {...defaultProps}
        status="Cuenta bloqueada por intentos fallidos. Espere 15 minutos o pida a un supervisor que reactive su usuario."
        onSubmit={onSubmit}
      />,
      { wrapper: Wrapper },
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/cuenta bloqueada/i);
    expect(screen.getByRole('button', { name: /bloqueado/i })).toBeDisabled();

    fireEvent.submit(screen.getByRole('button', { name: /bloqueado/i }).closest('form')!);

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows password visibility toggle', () => {
    render(<LoginView {...defaultProps} />, { wrapper: Wrapper });

    expect(screen.getByRole('button', { name: /mostrar contraseña/i })).toBeInTheDocument();
  });

  it('toggles password visibility when toggle button is clicked', () => {
    render(<LoginView {...defaultProps} />, { wrapper: Wrapper });

    const toggleButton = screen.getByRole('button', { name: /mostrar contraseña/i });
    expect(toggleButton).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.getByRole('button', { name: /ocultar contraseña/i })).toBeInTheDocument();
  });

  it('explica la recuperación local sin ofrecer un restablecimiento público', () => {
    render(<LoginView {...defaultProps} />, { wrapper: Wrapper });

    const helpButton = screen.getByRole('button', { name: /olvidó su contraseña/i });
    expect(helpButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/recuperar acceso a s_hospital/i)).not.toBeInTheDocument();

    fireEvent.click(helpButton);

    expect(helpButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/administración → usuarios/i)).toBeVisible();
    expect(screen.getByText(/recuperar acceso a s_hospital/i)).toBeVisible();
    expect(screen.getByText(/autorización del administrador del equipo/i)).toBeVisible();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('pre-fills login and password when provided', () => {
    render(<LoginView {...defaultProps} login="admin@hospital.local" password="test123" />, { wrapper: Wrapper });

    const loginInput = screen.getByPlaceholderText('ej. cajero_01');
    const passwordInput = screen.getByPlaceholderText('Ingrese su contraseña');

    expect(loginInput).toHaveValue('admin@hospital.local');
    expect(passwordInput).toHaveValue('test123');
  });

  it('avisa cuando Bloq Mayús está activo en contraseña', () => {
    render(<LoginView {...defaultProps} />, { wrapper: Wrapper });

    fireEvent.keyDown(screen.getByPlaceholderText('Ingrese su contraseña'), {
      key: 'A',
      getModifierState: (key: string) => key === 'CapsLock',
    });

    expect(screen.getByText('Bloq Mayús está activo')).toBeVisible();
  });

  it('expone una sola identidad hospitalaria por composición', () => {
    render(<LoginView {...defaultProps} />, { wrapper: Wrapper });

    expect(screen.getAllByText('S_Hospital')).toHaveLength(1);
  });
});
