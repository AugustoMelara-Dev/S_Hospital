import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HelpView } from './HelpView';

describe('HelpView', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows operational support guidance for common hospital failures and roles', async () => {
    window.localStorage.setItem('hospital_client_issue_log', JSON.stringify([{
      action: 'GET /api/health',
      module: 'api',
      route: '/help',
      safe_message: 'No se pudo conectar con el servidor LAN.',
      technical_code: 'ApiError',
      occurred_at: '2026-05-31T12:00:00.000Z',
    }]));

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    render(<HelpView />);

    expect(screen.getByRole('heading', { name: /ayuda institucional/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /abrir el sistema/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /iniciar sesion/i })).toBeInTheDocument();
    expect(screen.getByText(/use el acceso institucional del escritorio/i)).toBeInTheDocument();
    expect(screen.getByText(/no comparta contrasena ni cuenta de turno/i)).toBeInTheDocument();
    expect(screen.getByText(/servidor no disponible/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /impresora no responde/i })).toBeInTheDocument();
    expect(screen.getByText(/media carta, carta, A5, 80mm o 58mm/i)).toBeInTheDocument();
    expect(screen.getByText(/todo bien, requiere revisión o error/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /pedir soporte/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /atajos de teclado/i })).toBeInTheDocument();
    expect(screen.getByText('F6')).toBeInTheDocument();
    expect(screen.getByText(/escaneo de códigos/i)).toBeInTheDocument();
    expect(screen.getAllByText('Ctrl+K').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /se fue la luz o reinició la pc/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /caja quedó abierta/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /base de datos necesita restaurarse/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /se cerro el navegador/i })).toBeInTheDocument();
    expect(screen.getByText(/revise caja e historial antes de repetir una factura/i)).toBeInTheDocument();
    expect(screen.getAllByText(/base aislada/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/no repita la factura/i)).toBeInTheDocument();
    expect(screen.getByText(/comparta el diagnóstico/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^cajero$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^supervisor$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /^administrador$/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /checklist diario por rol/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /cajero - inicio de turno/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /antes de cerrar turno/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /supervisor - revision diaria/i })).toBeInTheDocument();
    expect(screen.getByText(/comparar efectivo esperado contra efectivo contado/i)).toBeInTheDocument();
    expect(screen.getByText(/pedir resumen seguro de ayuda/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /acciones delicadas/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /restauracion de respaldo/i })).toBeInTheDocument();
    expect(screen.getByText(/nunca restaure sobre datos reales/i)).toBeInTheDocument();
    expect(screen.getByText(/no cierre para ocultar errores/i)).toBeInTheDocument();
    expect(screen.getAllByText(/no use la base de producción/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/evidencia local para soporte/i)).toBeInTheDocument();
    expect(screen.getByText(/incidentes guardados/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /preparar resumen/i }));
    expect((await screen.findByLabelText(/resumen seguro para soporte/i) as HTMLTextAreaElement).value).toContain('Resumen seguro para soporte');
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('No se pudo conectar con el servidor LAN.')));
    expect(screen.getByText(/resumen copiado/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver evidencia/i }));
    expect(screen.getAllByText(/no se pudo conectar con el servidor lan/i).length).toBeGreaterThan(0);
  });
});
