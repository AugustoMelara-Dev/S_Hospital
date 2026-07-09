import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  PAPER_PROFILES,
  PaperProfileSelector,
  SectionCard,
  StatCard,
  MoneyDisplay,
  DateDisplay,
  NumberDisplay,
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

  it('renders only the three institutional paper options with the active one marked', () => {
    render(<PaperProfileSelector value="media_carta" onChange={() => {}} />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    expect(profiles).toHaveLength(3);
    expect(screen.queryByRole('radio', { name: /ticket 80/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /ticket 58/i })).not.toBeInTheDocument();

    const activeRadio = screen.getByRole('radio', { checked: true });
    expect(activeRadio).toHaveTextContent('Media carta');
  });

  it('exposes accessible label and helper text', () => {
    render(
      <PaperProfileSelector
        value="media_carta"
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

describe('Display components', () => {
  it('renders MoneyDisplay with formatted lempiras cents', () => {
    render(<MoneyDisplay amountCents={15050} data-testid="money" />);
    expect(screen.getByText('L 150.50')).toBeInTheDocument();
  });

  it('renders DateDisplay with formatted spanish date time', () => {
    const testDate = new Date('2026-07-01T12:34:56');
    render(<DateDisplay value={testDate} />);
    // Depends on timezone formatting, but it should output at least 01/07/2026 or similar
    expect(screen.getByText(/01\/07\/2026/)).toBeInTheDocument();
  });

  it('renders NumberDisplay with configured decimal places', () => {
    render(<NumberDisplay value={12.3456} decimals={2} />);
    expect(screen.getByText('12.35')).toBeInTheDocument();
  });

  it('renders NumberDisplay with thousands grouping for scan-friendly totals', () => {
    render(<NumberDisplay value={1234.5} decimals={2} />);
    expect(screen.getByText('1,234.50')).toBeInTheDocument();
  });
});
