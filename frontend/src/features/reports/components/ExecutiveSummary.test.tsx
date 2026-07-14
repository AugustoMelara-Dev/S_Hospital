import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExecutiveSummary } from './ExecutiveSummary';
import { buildExecutiveReport } from './testUtils';
import type { ExecutiveReport } from '@/lib/api';

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

  it('ignores malformed comparison deltas instead of crashing the summary', () => {
    render(
      <ExecutiveSummary
        report={buildExecutiveReport({
          comparison: {
            ...buildExecutiveReport().comparison,
            billed: {
              ...buildExecutiveReport().comparison.billed,
              delta_percentage: 'NaN' as unknown as ExecutiveReport['comparison']['billed']['delta_percentage'],
            },
          },
          summary: {
            ...buildExecutiveReport().summary,
            billed_total: '125.00',
          },
        })}
      />,
    );

    expect(screen.getByText('L 125.00')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('NaN');
  });
});
