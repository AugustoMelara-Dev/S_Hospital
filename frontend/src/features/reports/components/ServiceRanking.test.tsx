import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ServiceRanking } from './ServiceRanking';
import { buildExecutiveReport } from './testUtils';

describe('ServiceRanking', () => {
  it('focuses executive service ranking on top billed services without secondary tables', () => {
    const report = buildExecutiveReport({
      services: {
        top_by_amount: [
          {
            service: 'Hemograma completo',
            category: 'Laboratorio',
            item_count: 12,
            quantity: '12.00',
            total: '1200.00',
            collected: '1100.00',
          },
        ],
        top_by_quantity: [
          {
            service: 'Consulta general',
            category: 'Consulta externa',
            item_count: 18,
            quantity: '18.00',
            total: '900.00',
          },
        ],
        by_category: [
          {
            category: 'Laboratorio',
            item_count: 12,
            quantity: '12.00',
            total: '1200.00',
            collected: '1100.00',
          },
        ],
        by_area: [
          {
            area_id: 1,
            area: 'Emergencia',
            item_count: 7,
            quantity: '7.00',
            total: '700.00',
          },
        ],
      },
    });

    render(<ServiceRanking report={report} />);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /servicios facturados/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /top por cantidad/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /por categoria/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /por area/i })).not.toBeInTheDocument();
    expect(screen.getByText('Hemograma completo')).toBeInTheDocument();
    expect(screen.queryByText('Consulta general')).not.toBeInTheDocument();
    expect(screen.queryByText('Emergencia')).not.toBeInTheDocument();
    expect(screen.queryByText(/lectura/i)).not.toBeInTheDocument();
  });

  it('formats quantities as units instead of money', () => {
    const report = buildExecutiveReport({
      services: {
        top_by_amount: [
          {
            service: 'Hemograma completo',
            category: 'Laboratorio',
            item_count: 12,
            quantity: '12.00',
            total: '1200.00',
            collected: '1100.00',
          },
        ],
        top_by_quantity: [
          {
            service: 'Consulta general',
            category: 'Consulta externa',
            item_count: 18,
            quantity: '18.00',
            total: '900.00',
          },
        ],
        by_category: [],
        by_area: [
          {
            area_id: 1,
            area: 'Emergencia',
            item_count: 7,
            quantity: '7.00',
            total: '700.00',
          },
        ],
      },
    });

    render(<ServiceRanking report={report} />);

    expect(screen.getAllByText('12.00').length).toBeGreaterThan(0);
    expect(screen.queryByText('18.00')).not.toBeInTheDocument();
    expect(screen.queryByText('7.00')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('L 12.00');
    expect(document.body.textContent).not.toContain('L 18.00');
    expect(document.body.textContent).not.toContain('L 7.00');
    expect(document.body.textContent).toContain('L 1,200.00');
  });

  it('uses a compact empty state when there are no billed services', () => {
    render(<ServiceRanking report={buildExecutiveReport()} />);

    expect(screen.getByText(/sin servicios facturados en el periodo/i)).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });
});
