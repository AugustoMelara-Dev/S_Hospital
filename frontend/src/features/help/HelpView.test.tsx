import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HelpView } from './HelpView';

describe('HelpView', () => {
  it('shows operational support guidance for common hospital failures and roles', () => {
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
  });
});
