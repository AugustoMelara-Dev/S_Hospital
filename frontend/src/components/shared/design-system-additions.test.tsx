import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  PAPER_PROFILES,
  PaperProfileSelector,
  SectionCard,
  StatCard,
} from './design-system';

describe('SectionCard', () => {
  it('renders title, description and children', () => {
    render(
      <SectionCard title="Datos" description="Descripcion" data-testid="section">
        Contenido del panel
      </SectionCard>,
    );

    expect(screen.getByTestId('section')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Datos' })).toBeInTheDocument();
    expect(screen.getByText('Descripcion')).toBeInTheDocument();
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

describe('PaperProfileSelector', () => {
  const profiles = PAPER_PROFILES;

  it('renders 5 radio options with the active one marked', () => {
    render(<PaperProfileSelector value="media_carta" onChange={() => {}} />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(profiles.length);

    const activeRadio = screen.getByRole('radio', { checked: true });
    expect(activeRadio).toHaveTextContent('Media carta');
  });

  it('exposes accessible label and helper text', () => {
    render(
      <PaperProfileSelector
        value="80mm"
        onChange={() => {}}
        helperText="Los margenes y el tamano se calculan automaticamente."
      />,
    );

    expect(screen.getByRole('radiogroup', { name: /tipo de papel/i })).toBeInTheDocument();
    expect(
      screen.getByText('Los margenes y el tamano se calculan automaticamente.'),
    ).toBeInTheDocument();
  });
});
