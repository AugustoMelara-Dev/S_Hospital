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

    const passwordInput = screen.getByText('Contraseña').closest('input') || screen.getByPlaceholderText('********');
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
  });

  it('disables submit button when countdown is active', () => {
    render(<LoginView {...defaultProps} status="Demasiados intentos. Bloqueado temporalmente" />, { wrapper: Wrapper });

    const button = screen.getByRole('button', { name: /bloqueado/i });
    expect(button).toBeDisabled();
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

  it('pre-fills login and password when provided', () => {
    render(<LoginView {...defaultProps} login="admin@hospital.local" password="test123" />, { wrapper: Wrapper });

    const loginInput = screen.getByPlaceholderText('ej. cajero_01');
    const passwordInput = screen.getByPlaceholderText('********');

    expect(loginInput).toHaveValue('admin@hospital.local');
    expect(passwordInput).toHaveValue('test123');
  });
});