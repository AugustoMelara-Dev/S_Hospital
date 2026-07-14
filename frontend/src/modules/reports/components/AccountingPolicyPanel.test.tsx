import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AccountingPolicyPanel } from './AccountingPolicyPanel';

describe('AccountingPolicyPanel', () => {
  it('explains active totals without double subtracting control amounts', () => {
    render(<AccountingPolicyPanel policy={{
      scope: 'operational_cash',
      expenses_supported: false,
      exclusions_already_applied: true,
      billed_definition: 'Facturas no anuladas; anulaciones ya excluidas.',
      collected_definition: 'Pagos posteados no reversados; reversos ya excluidos.',
    }} />);

    expect(screen.getByRole('heading', { name: /criterio contable operativo/i })).toBeInTheDocument();
    expect(screen.getByText(/anulaciones ya excluidas/i)).toBeInTheDocument();
    expect(screen.getByText(/reversos ya excluidos/i)).toBeInTheDocument();
    expect(screen.getByText(/no se restan otra vez/i)).toBeInTheDocument();
    expect(screen.getByText(/egresos no estan modelados/i)).toBeInTheDocument();
    expect(screen.queryByText(/facturado menos anulado/i)).not.toBeInTheDocument();
  });
});
