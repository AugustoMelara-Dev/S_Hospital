import { fireEvent, render, screen } from '@testing-library/react';
import { configureAxe } from 'vitest-axe';
import { describe, expect, it, vi } from 'vitest';
import { RouteState } from './RouteState';

const axe = configureAxe({
  rules: {
    'color-contrast': { enabled: false },
  },
});

describe('RouteState', () => {
  it('ofrece recuperación real y foco semántico en error', async () => {
    const onClick = vi.fn();
    const { container } = render(
      <RouteState
        kind="error"
        title="No pudimos cargar caja"
        description="Revise la conexión local."
        action={{ label: 'Reintentar', onClick }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it.each(['loading', 'empty', 'denied', 'offline', 'not-found'] as const)(
    'renderiza %s con título y descripción',
    (kind) => {
      render(<RouteState kind={kind} title="Estado" description="Descripción operativa" />);

      expect(screen.getByRole('heading', { name: 'Estado' })).toBeVisible();
      expect(screen.getByText('Descripción operativa')).toBeVisible();
    },
  );

  it('usa estado accesible durante la carga y expone su detalle', () => {
    render(
      <RouteState
        kind="loading"
        title="Cargando caja"
        description="Preparando el turno."
        detail="Puede tardar unos segundos."
      />,
    );

    expect(screen.getByRole('status', { name: 'Cargando caja' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Ver detalle'));
    expect(screen.getByText('Puede tardar unos segundos.')).toBeVisible();
  });

  it('navega mediante un enlace real cuando la acción tiene destino', () => {
    render(
      <RouteState
        kind="not-found"
        title="Ruta no encontrada"
        description="La pantalla no existe."
        action={{ label: 'Ir al inicio', href: '/dashboard' }}
      />,
    );

    expect(screen.getByRole('link', { name: 'Ir al inicio' })).toHaveAttribute('href', '/dashboard');
  });

  it('no renderiza una acción sin destino ni manejador', () => {
    render(
      <RouteState
        kind="denied"
        title="Acceso restringido"
        description="Este módulo no está disponible."
        action={{ label: 'Continuar' }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Continuar' })).not.toBeInTheDocument();
  });

  it('respeta el nivel de heading solicitado', () => {
    render(
      <RouteState
        kind="error"
        title="Error contextual"
        description="No reemplaza el título de la ruta."
        headingLevel={2}
      />,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Error contextual' })).toBeVisible();
  });

  it('genera identificadores únicos para dos estados del mismo tipo', () => {
    render(
      <>
        <RouteState kind="empty" title="Primer estado" description="Sin datos." />
        <RouteState kind="empty" title="Segundo estado" description="Sin datos." />
      </>,
    );

    const states = screen.getAllByLabelText(/estado/i, { selector: 'section' });
    const firstId = states[0].getAttribute('aria-labelledby');
    const secondId = states[1].getAttribute('aria-labelledby');

    expect(firstId).toBeTruthy();
    expect(secondId).toBeTruthy();
    expect(firstId).not.toBe(secondId);
    expect(document.getElementById(firstId!)).toHaveTextContent('Primer estado');
    expect(document.getElementById(secondId!)).toHaveTextContent('Segundo estado');
  });

  it('mantiene la acción con target mínimo de 44 px', () => {
    render(
      <RouteState
        kind="error"
        title="No disponible"
        description="Intente de nuevo."
        action={{ label: 'Reintentar', onClick: vi.fn() }}
      />,
    );

    expect(screen.getByRole('button', { name: 'Reintentar' })).toHaveClass('min-h-11');
  });
});
