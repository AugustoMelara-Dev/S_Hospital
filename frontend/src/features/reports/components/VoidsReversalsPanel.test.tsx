import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VoidsReversalsPanel } from './VoidsReversalsPanel';
import { buildExecutiveReport } from './testUtils';

describe('VoidsReversalsPanel', () => {
  it('uses the shared empty state when no voids or reversals exist', () => {
    render(<VoidsReversalsPanel report={buildExecutiveReport()} />);

    expect(screen.getByText(/sin anulaciones ni reversas/i)).toBeInTheDocument();
    expect(screen.getByText(/las anulaciones y reversas apareceran/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders voids and reversals inside the shared accessible table container', () => {
    render(
      <VoidsReversalsPanel
        report={buildExecutiveReport({
          voids_and_reversals: [
            {
              kind: 'void',
              invoice_number: 'FAC-000321',
              patient: 'Jose Ramirez',
              amount: '75.00',
              reason: 'Error de cobro',
              user: 'Caja Principal',
              authorized_by: 'Administracion',
              created_at: '2026-06-02T15:00:00.000000Z',
            },
          ],
        })}
      />,
    );

    expect(screen.getByRole('region', { name: /anulaciones y reversas/i })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /operaciones anuladas o reversadas/i })).toBeInTheDocument();
    expect(screen.getByText('FAC-000321')).toBeInTheDocument();
    expect(screen.getByText('Jose Ramirez')).toBeInTheDocument();
    expect(screen.getByText('Anulacion')).toBeInTheDocument();
    expect(document.body.textContent).toContain('L 75.00');
  });

  it('uses human labels instead of raw dashes when audit details are missing', () => {
    render(
      <VoidsReversalsPanel
        report={buildExecutiveReport({
          voids_and_reversals: [
            {
              kind: 'reversal',
              invoice_number: 'FAC-000654',
              patient: null,
              amount: '120.00',
              reason: null,
              user: null,
              authorized_by: null,
              created_at: null,
            },
          ],
        })}
      />,
    );

    expect(screen.getByText('Sin paciente')).toBeInTheDocument();
    expect(screen.getByText('Sin usuario')).toBeInTheDocument();
    expect(screen.getByText('Sin autorizador')).toBeInTheDocument();
    expect(screen.getByText('Sin motivo')).toBeInTheDocument();
    expect(screen.getByText('Sin fecha')).toBeInTheDocument();
    expect(screen.queryByText('-')).not.toBeInTheDocument();
  });

  it('shows a human fallback when an audit date is unavailable', () => {
    render(
      <VoidsReversalsPanel
        report={buildExecutiveReport({
          voids_and_reversals: [
            {
              kind: 'void',
              invoice_number: 'FAC-000777',
              patient: 'Paciente Auditoria',
              amount: '50.00',
              reason: 'Correccion autorizada',
              user: 'Caja Principal',
              authorized_by: 'Administracion',
              created_at: 'fecha-danada',
            },
          ],
        })}
      />,
    );

    expect(screen.getByText('Fecha no disponible')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Invalid Date|fecha-danada/i);
  });
});
