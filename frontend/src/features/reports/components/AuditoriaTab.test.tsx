import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuditoriaTab } from './AuditoriaTab';
import type { OperationsReport } from '../../../lib/api/types';

describe('AuditoriaTab', () => {
  it('renders malformed audit money amounts as safe financial values', () => {
    const operations = {
      date_from: '2026-06-01',
      date_to: '2026-06-01',
      filters: { date_from: '2026-06-01', date_to: '2026-06-01' },
      summary: {
        void_count: 1,
        reprint_count: 0,
        payment_void_count: 1,
        backup_count: 0,
        failed_backup_count: 0,
        cashier_count: 1,
      },
      voids: [
        {
          invoice_number: '000-001-01-00000001',
          patient_name: 'Paciente Anulado',
          total: 'monto-danado',
          reason: 'Correccion',
          voided_at: '2026-06-01T10:00:00.000000Z',
          user: 'Admin Hospital',
        },
      ],
      reprints: [],
      payment_voids: [
        {
          invoice_number: '000-001-01-00000002',
          patient_name: 'Paciente Reverso',
          method: 'card',
          amount: 'NaN',
          reason: 'Pago duplicado',
          voided_at: '2026-06-01T11:00:00.000000Z',
          voided_by: 'Supervisor Hospital',
          cashier: 'Caja Principal',
        },
      ],
      backups: [],
      cashiers: [
        {
          name: 'Caja Principal',
          username: 'caja.principal',
          payment_count: 2,
          cash_session_count: 1,
          invoice_count: 2,
          total_collected: 'no-numero',
        },
      ],
    } satisfies OperationsReport;

    render(
      <AuditoriaTab
        canExport={false}
        operations={operations}
        dateFrom="2026-06-01"
        dateTo="2026-06-01"
        onDateFromChange={() => undefined}
        onDateToChange={() => undefined}
        onExport={() => undefined}
        onExportPdf={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getByText('Paciente Anulado')).toBeInTheDocument();
    expect(screen.getByText('Paciente Reverso')).toBeInTheDocument();
    expect(screen.getByText('caja.principal')).toBeInTheDocument();
    expect(document.body.textContent).toContain('L. 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-numero|undefined/);
  });
});
