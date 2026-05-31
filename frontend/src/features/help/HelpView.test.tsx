import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HelpView } from './HelpView';

describe('HelpView', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('shows operational support guidance for common hospital failures and roles', () => {
    window.localStorage.setItem('hospital_client_issue_log', JSON.stringify([{
      action: 'GET /api/health',
      module: 'api',
      route: '/help',
      safe_message: 'No se pudo conectar con el servidor LAN.',
      technical_code: 'ApiError',
      occurred_at: '2026-05-31T12:00:00.000Z',
    }]));

    render(<HelpView />);

    expect(screen.getByRole('heading', { name: /ayuda institucional/i })).toBeInTheDocument();
    expect(screen.getByText(/servidor no disponible/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /impresora no responde/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /pedir soporte/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /se fue la luz o reinicio la pc/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /caja quedo abierta/i })).toBeInTheDocument();
    expect(screen.getByText(/no repita la factura/i)).toBeInTheDocument();
    expect(screen.getByText(/comparta el diagnostico/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /cajero/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /supervisor/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /administrador/i })).toBeInTheDocument();
    expect(screen.getAllByText(/no use la base de produccion/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/evidencia local para soporte/i)).toBeInTheDocument();
    expect(screen.getByText(/incidentes guardados/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver evidencia/i }));
    expect(screen.getByText(/no se pudo conectar con el servidor lan/i)).toBeInTheDocument();
  });
});
