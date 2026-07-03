import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExecutiveSummary } from './ExecutiveSummary';
import { buildExecutiveReport } from './testUtils';

describe('ExecutiveSummary', () => {
  it('summarizes collection coverage and pending balance in plain language', () => {
    render(
      <ExecutiveSummary
        report={buildExecutiveReport({
          summary: {
            ...buildExecutiveReport().summary,
            billed_total: '100.00',
            collected_total: '60.00',
            pending_total: '40.00',
            invoice_count: 4,
            receipt_count: 3,
            pending_count: 2,
          },
        })}
      />,
    );

    expect(screen.getByText(/cobrado 60\.0% de lo facturado/i)).toBeInTheDocument();
    expect(screen.getByText(/^pendiente: L 40\.00$/i)).toBeInTheDocument();
    expect(screen.getByText(/2 facturas con saldo abierto/i)).toBeInTheDocument();
  });
});
