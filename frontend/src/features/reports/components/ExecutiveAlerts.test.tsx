import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExecutiveAlerts } from './ExecutiveAlerts';
import { buildExecutiveReport } from './testUtils';

describe('ExecutiveAlerts', () => {
  it('surfaces pending, cash and audit risks in plain language', () => {
    render(
      <ExecutiveAlerts
        report={buildExecutiveReport({
          summary: {
            ...buildExecutiveReport().summary,
            pending_count: 2,
            pending_total: '400.00',
            voided_count: 1,
          },
          pending_aging: {
            ...buildExecutiveReport().pending_aging,
            '31_plus_days': { count: 2, amount: '400.00' },
          },
          audit_summary: {
            ...buildExecutiveReport().audit_summary,
            critical_events: 3,
            cash_differences: 1,
          },
        })}
      />,
    );

    expect(screen.getByRole('heading', { name: /alertas operativas/i })).toBeInTheDocument();
    expect(screen.getByText(/2 facturas tienen 31 o mas dias pendiente/i)).toBeInTheDocument();
    expect(screen.getByText(/1 cierre con diferencia de caja/i)).toBeInTheDocument();
    expect(screen.getByText(/3 eventos criticos de auditoria/i)).toBeInTheDocument();
  });
});
