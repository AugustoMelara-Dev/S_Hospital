import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppErrorBoundary } from './AppErrorBoundary';

function BrokenView() {
  throw new Error('render exploded');

  return null;
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('shows human recovery instructions and stores support evidence', () => {
    render(
      <AppErrorBoundary>
        <BrokenView />
      </AppErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: /la pantalla no pudo cargarse/i })).toBeInTheDocument();
    expect(screen.getByText(/prepare el resumen seguro/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /recargar pantalla/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abrir ayuda/i })).toHaveAttribute('href', '/help');
    expect(screen.queryByText(/consola del navegador/i)).not.toBeInTheDocument();

    const stored = JSON.parse(window.localStorage.getItem('hospital_client_issue_log') ?? '[]') as Array<{
      safe_message: string;
      technical_code: string;
    }>;

    expect(stored[0]).toMatchObject({
      safe_message: 'render exploded',
      technical_code: 'Aviso del sistema',
    });
  });
});
