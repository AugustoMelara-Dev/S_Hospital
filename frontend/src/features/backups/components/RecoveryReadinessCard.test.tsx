import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RecoveryReadinessCard } from './RecoveryReadinessCard';

describe('RecoveryReadinessCard', () => {
  it('presents local recovery guidance and sanitized readiness blockers accessibly', () => {
    render(
      <RecoveryReadinessCard
        readinessBlockers={['Validar una copia protegida', 'Cerrar la caja abierta']}
      />,
    );

    const region = screen.getByRole('region', { name: /restauración local/i });

    expect(region).toContainElement(screen.getByRole('heading', { level: 2, name: /restauración local/i }));
    expect(screen.getByText(/mantenimiento s_hospital/i)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /pendientes para recuperación/i })).toBeInTheDocument();
    expect(screen.getByText('Validar una copia protegida')).toBeInTheDocument();
    expect(screen.getByText('Cerrar la caja abierta')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /abrir centro de soporte/i })).toHaveAttribute('href', '/support');
    expect(region.textContent).not.toMatch(/\.sql|checksum|sha256|php artisan|queue:work|c:\\/i);
  });

  it('explains that recovery is ready when no blockers remain', () => {
    render(<RecoveryReadinessCard readinessBlockers={[]} />);

    expect(screen.getByText(/sin pendientes de preparación detectados/i)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /pendientes para recuperación/i })).not.toBeInTheDocument();
  });
});
