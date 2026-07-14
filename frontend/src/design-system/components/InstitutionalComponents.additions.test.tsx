import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SectionCard, StatCard } from './InstitutionalComponents';

describe('SectionCard', () => {
  it('renders title, description and children', () => {
    render(
      <SectionCard title="Datos" description="Descripcion" data-testid="section">
        Contenido del panel
      </SectionCard>,
    );

    expect(screen.getByTestId('section')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Datos' })).toBeInTheDocument();
    expect(screen.getByText('Contenido del panel')).toBeInTheDocument();
  });
});

describe('StatCard', () => {
  it('shows label and value with optional helper', () => {
    render(<StatCard label="Sesiones" value="3" helper="hoy" tone="success" />);

    expect(screen.getByText('Sesiones')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('hoy')).toBeInTheDocument();
  });
});
