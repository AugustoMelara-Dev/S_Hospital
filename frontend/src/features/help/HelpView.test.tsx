import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
      safe_message: 'No se pudo conectar con el servidor local.',
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
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: /abrir el sistema/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.getByText(/use el acceso institucional del escritorio/i)).toBeInTheDocument();
    expect(screen.getByText(/no comparta contraseña ni cuenta de turno/i)).toBeInTheDocument();
    expect(screen.getByText(/servidor no disponible/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /impresora no responde/i })).toBeInTheDocument();
    expect(screen.getByText(/carta, media carta o A5/i)).toBeInTheDocument();
    expect(screen.queryByText(/segunda computadora|80mm|58mm/i)).not.toBeInTheDocument();
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
    expect(screen.getByText(/gestiona usuarios, cat.logo, configuraci.n fiscal y respaldos/i)).toBeInTheDocument();
    expect(screen.getAllByText(/recuperaci.n de datos se coordina con soporte/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/respaldos y restauraciones/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pruebas de restauraci.n/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /checklist diario por rol/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /cajero - inicio de turno/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /antes de cerrar turno/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /supervisor - revisión diaria/i })).toBeInTheDocument();
    expect(screen.getByText(/comparar efectivo esperado contra efectivo contado/i)).toBeInTheDocument();
    expect(screen.getByText(/pedir resumen seguro de ayuda/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /acciones delicadas/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /restauración de respaldo/i })).toBeInTheDocument();
    expect(screen.getByText(/nunca restaure sobre datos reales/i)).toBeInTheDocument();
    expect(screen.getByText(/no cierre para ocultar errores/i)).toBeInTheDocument();
    expect(screen.getAllByText(/no use la base de producción/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/evidencia local para soporte/i)).toBeInTheDocument();
    expect(screen.getByText(/incidentes guardados/i)).toBeInTheDocument();
    const evidenceButton = screen.getByRole('button', { name: /ver evidencia/i });
    expect(evidenceButton).toHaveAttribute('aria-expanded', 'false');
    expect(evidenceButton).toHaveAttribute('aria-controls', 'support-evidence-details');
    fireEvent.click(screen.getByRole('button', { name: /preparar resumen/i }));
    expect((await screen.findByLabelText(/resumen seguro para soporte/i) as HTMLTextAreaElement).value).toContain('Resumen seguro para soporte');
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('No se pudo conectar con el servidor local.')));
    expect(screen.getByRole('status')).toHaveTextContent(/resumen copiado/i);
    fireEvent.click(evidenceButton);
    expect(evidenceButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText(/no se pudo conectar con el servidor local/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/system\.status\.view|backups\.view|\/admin|\/settings/i)).not.toBeInTheDocument();
  });

  it('filtra tareas por lenguaje operativo sin exigir términos técnicos', () => {
    render(<HelpView />);

    fireEvent.change(screen.getByRole('searchbox', { name: /qué necesita hacer/i }), {
      target: { value: 'cobrar' },
    });

    expect(screen.getByRole('heading', { name: /^cobrar$/i })).toBeVisible();
    expect(screen.queryByRole('heading', { name: /abrir el sistema/i })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/guía relacionada/i);
  });
  it('offers a task index with anchored compact topics and a return path', () => {
    render(<HelpView />);

    const index = screen.getByRole('navigation', { name: /ndice de tareas/i });
    const chargeLink = within(index).getByRole('link', { name: /^cobrar$/i });
    expect(chargeLink).toHaveAttribute('href', '#help-guide-cobrar');
    expect(document.querySelector('#help-guide-cobrar')).not.toBeNull();

    fireEvent.click(chargeLink);
    const chargeTopic = screen.getByRole('button', { name: /cobrar/i });
    fireEvent.click(chargeTopic);
    expect(screen.getByText(/seleccione el m.todo de pago/i)).toBeVisible();
    expect(screen.getAllByRole('link', { name: /volver al .ndice/i }).length).toBeGreaterThan(0);
  });

  it('keeps cards, accordions, and checklist markers visibly structured', () => {
    render(<HelpView />);

    const shortcutsCard = screen.getByRole('heading', { name: /atajos de teclado/i }).closest('[data-slot="card"]');
    expect(shortcutsCard).toHaveClass('p-5', 'sm:p-6');

    const chargeTopic = screen.getByRole('button', { name: /^cobrar$/i }).closest('[data-slot="accordion-item"]');
    expect(chargeTopic).toHaveClass('border', 'px-4');

    const checklist = screen.getByRole('heading', { name: /cajero - inicio de turno/i }).parentElement;
    const marker = checklist?.querySelector('li > span[aria-hidden="true"]');
    expect(marker).toHaveClass('size-1.5', 'shrink-0', 'rounded-full');
  });
});
