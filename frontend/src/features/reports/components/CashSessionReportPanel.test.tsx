import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/design-system/ag-grid', () => ({
  InstitutionalDataGrid: ({ ariaLabel, rows, columns, emptyMessage }: {
    ariaLabel: string;
    rows: Record<string, unknown>[];
    columns: Array<{
      colId?: string;
      field?: string;
      headerName?: string;
      valueGetter?: (params: { data: Record<string, unknown> }) => unknown;
      valueFormatter?: (params: { data: Record<string, unknown>; value: unknown }) => React.ReactNode;
      cellRenderer?: (params: { data: Record<string, unknown>; value: unknown }) => React.ReactNode;
    }>;
    emptyMessage: string;
  }) => (
    <section aria-label={ariaLabel}>
      {rows.length ? (
        <table>
          <thead><tr>{columns.map((column) => <th key={column.colId}>{column.headerName}</th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index}>{columns.map((column) => {
            const value = column.valueGetter?.({ data: row }) ?? (column.field ? row[column.field] : undefined);
            return <td key={column.colId}>{column.cellRenderer?.({ data: row, value }) ?? column.valueFormatter?.({ data: row, value }) ?? String(value ?? '')}</td>;
          })}</tr>)}</tbody>
        </table>
      ) : <div role="status">{emptyMessage}</div>}
    </section>
  ),
}));
import { CashSessionReportPanel } from './CashSessionReportPanel';
import type { CashSessionReport } from '../../../lib/api/types';

describe('CashSessionReportPanel', () => {
  it('asks for a cash turn without exposing raw numeric examples', () => {
    render(
      <CashSessionReportPanel
        canExport={false}
        cashSession={null}
        cashReportId=""
        loading={false}
        error=""
        onCashReportIdChange={() => undefined}
        onExport={() => undefined}
        onExportPdf={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getByLabelText(/n.mero de caja/i)).toBeInTheDocument();
    expect(screen.getByText(/use el n.mero que aparece en caja al abrir o cerrar turno/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/ej:\s*1/i)).not.toBeInTheDocument();
  });

  it('uses report reconciliation totals for open cash sessions', () => {
    const cashSession = {
      cash_session: {
        id: 2,
        user_id: 7,
        status: 'open',
        opening_amount: '500.00',
        closing_amount: null,
        expected_amount: null,
        difference_amount: null,
        opening_notes: null,
        closing_notes: null,
        opened_at: '2026-06-02T08:00:00.000000Z',
        closed_at: null,
        user: { id: 7, name: 'Caja Principal', username: 'caja' },
      },
      totals_by_method: { cash: '17.25', transfer: '0.00', card: '5.00', other: '0.00' },
      total_cash: '17.25',
      total_transfer: '0.00',
      total_card: '5.00',
      total_other: '0.00',
      payments_count: 2,
      payments_total: '22.25',
      expected_cash_amount: '517.25',
      pending_invoice_count: 1,
      pending_amount: '23.75',
      missing_institutional_receipt_count: 1,
      reversed_payments_count: 1,
      reversed_payments_total: '10.00',
      payments: [],
      movements: [],
    } satisfies CashSessionReport;

    render(
      <CashSessionReportPanel
        canExport={false}
        cashSession={cashSession}
        cashReportId="2"
        loading={false}
        error=""
        onCashReportIdChange={() => undefined}
        onExport={() => undefined}
        onExportPdf={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(document.body.textContent).toContain('Esperado');
    expect(document.body.textContent).toContain('L 517.25');
    expect(document.body.textContent).toContain('Pendiente');
    expect(document.body.textContent).toContain('1 factura');
    expect(document.body.textContent).toContain('L 23.75');
    expect(screen.getByRole('heading', { name: /control contable de caja/i })).toBeInTheDocument();
    expect(screen.getByText(/1 recibo institucional pendiente/i)).toBeInTheDocument();
    expect(screen.getByText(/1 pago reversado/i)).toBeInTheDocument();
    expect(screen.getByText(/los egresos operativos no est.n modelados en esta versi.n/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/L 0\.00(?:\s*)Contado/);
  });

  it('uses shared table states for totals, payments and movements', () => {
    const cashSession = buildCashSessionReport({
      payments: [],
      movements: [],
      totals_by_method: { cash: '17.25', transfer: '0.00', card: '5.00', other: '0.00' },
    });

    render(
      <CashSessionReportPanel
        canExport={false}
        cashSession={cashSession}
        cashReportId="2"
        loading={false}
        error=""
        onCashReportIdChange={() => undefined}
        onExport={() => undefined}
        onExportPdf={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getAllByRole('region', { name: /totales por m.todo/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText(/sin pagos registrados/i)).toBeInTheDocument();
    expect(screen.getByText(/sin movimientos de caja/i)).toBeInTheDocument();
  });

  it('shows the closing note next to a cash difference', () => {
    const base = buildCashSessionReport();
    const cashSession = buildCashSessionReport({
      cash_session: {
        ...base.cash_session,
        status: 'closed',
        closing_amount: '518.00',
        expected_amount: '517.25',
        difference_amount: '0.75',
        closing_notes: 'Diferencia validada para reporte',
        closed_at: '2026-06-02T16:00:00.000000Z',
      },
    });

    render(
      <CashSessionReportPanel
        canExport={false}
        cashSession={cashSession}
        cashReportId="2"
        loading={false}
        error=""
        onCashReportIdChange={() => undefined}
        onExport={() => undefined}
        onExportPdf={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getByText('Diferencia')).toBeInTheDocument();
    expect(screen.getByText('L 0.75')).toBeInTheDocument();
    expect(screen.getByText('Diferencia validada para reporte')).toBeInTheDocument();
  });

  it('renders cash movement types and methods as human financial labels', () => {
    const cashSession = {
      cash_session: {
        id: 3,
        user_id: 7,
        status: 'closed',
        opening_amount: '500.00',
        closing_amount: '517.25',
        expected_amount: '517.25',
        difference_amount: '0.00',
        opening_notes: null,
        closing_notes: null,
        opened_at: '2026-06-02T08:00:00.000000Z',
        closed_at: '2026-06-02T16:00:00.000000Z',
        user: { id: 7, name: 'Caja Principal', username: 'caja' },
      },
      totals_by_method: { cash: '17.25', transfer: '0.00', card: '0.00', other: '0.00' },
      total_cash: '17.25',
      total_transfer: '0.00',
      total_card: '0.00',
      total_other: '0.00',
      payments_count: 1,
      payments_total: '17.25',
      expected_cash_amount: '517.25',
      pending_invoice_count: 0,
      pending_amount: '0.00',
      missing_institutional_receipt_count: 0,
      reversed_payments_count: 1,
      reversed_payments_total: '10.00',
      payments: [],
      movements: [
        {
          id: 31,
          cash_session_id: 3,
          payment_id: null,
          user_id: 7,
          type: 'opening',
          method: null,
          amount: '500.00',
          notes: null,
          occurred_at: '2026-06-02T08:00:00.000000Z',
          user: { id: 7, name: 'Caja Principal', username: 'caja' },
        },
        {
          id: 32,
          cash_session_id: 3,
          payment_id: 20,
          user_id: 7,
          type: 'payment_void',
          method: 'cash',
          amount: '-10.00',
          notes: 'Pago reversado',
          occurred_at: '2026-06-02T12:00:00.000000Z',
          user: { id: 7, name: 'Caja Principal', username: 'caja' },
        },
        {
          id: 33,
          cash_session_id: 3,
          payment_id: null,
          user_id: 7,
          type: 'closing',
          method: 'closing',
          amount: '517.25',
          notes: null,
          occurred_at: '2026-06-02T16:00:00.000000Z',
          user: { id: 7, name: 'Caja Principal', username: 'caja' },
        },
      ],
    } satisfies CashSessionReport;

    render(
      <CashSessionReportPanel
        canExport={false}
        cashSession={cashSession}
        cashReportId="3"
        loading={false}
        error=""
        onCashReportIdChange={() => undefined}
        onExport={() => undefined}
        onExportPdf={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(document.body.textContent).toContain('Apertura de caja');
    expect(document.body.textContent).toContain('Reverso de pago');
    expect(document.body.textContent).toContain('Cierre de caja');
    expect(document.body.textContent).toContain('Efectivo');
    expect(document.body.textContent).toContain('- L 10.00');
    expect(document.body.textContent).not.toMatch(/payment_void|closing|opening/);
  });

  it('uses human labels instead of raw dashes for missing cash report details', () => {
    const cashSession = buildCashSessionReport({
      payments: [
        {
          id: 10,
          invoice_id: 12,
          cash_session_id: 2,
          user_id: 7,
          method: 'cash',
          amount: '25.00',
          status: 'posted',
          reference: null,
          paid_at: null as unknown as string,
        },
      ],
      movements: [
        {
          id: 20,
          cash_session_id: 2,
          payment_id: null,
          user_id: 7,
          type: 'opening',
          method: null,
          amount: '500.00',
          notes: null,
          occurred_at: null as unknown as string,
        },
      ],
    });

    render(
      <CashSessionReportPanel
        canExport={false}
        cashSession={cashSession}
        cashReportId="2"
        loading={false}
        error=""
        onCashReportIdChange={() => undefined}
        onExport={() => undefined}
        onExportPdf={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getByText('Sin factura')).toBeInTheDocument();
    expect(screen.getByText('Sin paciente')).toBeInTheDocument();
    expect(screen.getByText('Sin metodo')).toBeInTheDocument();
    expect(screen.getByText('Sin nota')).toBeInTheDocument();
    expect(screen.getByText('Sin usuario')).toBeInTheDocument();
    expect(screen.getAllByText('Sin fecha')).toHaveLength(2);
    expect(screen.queryByText('-')).not.toBeInTheDocument();
  });

  it('renders malformed cash session amounts as safe financial values', () => {
    const cashSession = {
      cash_session: {
        id: 1,
        user_id: 7,
        status: 'closed',
        opening_amount: 'monto-danado',
        closing_amount: 'NaN',
        expected_amount: 'no-numero',
        difference_amount: '1.25',
        opening_notes: null,
        closing_notes: null,
        opened_at: '2026-05-31T08:00:00.000000Z',
        closed_at: '2026-05-31T16:00:00.000000Z',
        user: { id: 7, name: 'Caja Principal', username: 'caja' },
      },
      totals_by_method: { cash: 'monto-danado', transfer: '', card: 'NaN', other: 'no-numero' },
      total_cash: 'monto-danado',
      total_transfer: '',
      total_card: 'NaN',
      total_other: 'no-numero',
      payments_count: 1,
      payments_total: 'monto-danado',
      expected_cash_amount: 'no-numero',
      pending_invoice_count: 1,
      pending_amount: 'NaN',
      missing_institutional_receipt_count: 1,
      reversed_payments_count: 0,
      reversed_payments_total: 'NaN',
      payments: [
        {
          id: 10,
          invoice_id: 12,
          cash_session_id: 1,
          user_id: 7,
          method: 'cash',
          amount: 'monto-danado',
          status: 'posted',
          reference: null,
          paid_at: '2026-05-31T12:00:00.000000Z',
          invoice: {
            id: 12,
            invoice_number: 'F-000012',
            patient_name: 'Paciente Prueba',
            status: 'partial',
            total: 'monto-danado',
            paid_amount: 'NaN',
            balance_due: 'no-numero',
          },
        },
      ],
      movements: [
        {
          id: 20,
          cash_session_id: 1,
          payment_id: null,
          user_id: 7,
          type: 'adjustment',
          method: 'cash',
          amount: 'no-numero',
          notes: null,
          occurred_at: '2026-05-31T13:00:00.000000Z',
          user: { id: 7, name: 'Caja Principal', username: 'caja' },
        },
      ],
    } satisfies CashSessionReport;

    render(
      <CashSessionReportPanel
        canExport={false}
        cashSession={cashSession}
        cashReportId="1"
        loading={false}
        error=""
        onCashReportIdChange={() => undefined}
        onExport={() => undefined}
        onExportPdf={() => undefined}
        onSubmit={() => undefined}
      />,
    );

    expect(screen.getAllByText('Caja Principal').length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('L 1.25');
    expect(document.body.textContent).toContain('L 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|no-numero|undefined/);
  });
});

function buildCashSessionReport(overrides: Partial<CashSessionReport> = {}): CashSessionReport {
  return {
    cash_session: {
      id: 2,
      user_id: 7,
      status: 'open',
      opening_amount: '500.00',
      closing_amount: null,
      expected_amount: null,
      difference_amount: null,
      opening_notes: null,
      closing_notes: null,
      opened_at: '2026-06-02T08:00:00.000000Z',
      closed_at: null,
      user: { id: 7, name: 'Caja Principal', username: 'caja' },
    },
    totals_by_method: { cash: '17.25', transfer: '0.00', card: '5.00', other: '0.00' },
    total_cash: '17.25',
    total_transfer: '0.00',
    total_card: '5.00',
    total_other: '0.00',
    payments_count: 2,
    payments_total: '22.25',
    expected_cash_amount: '517.25',
    pending_invoice_count: 1,
    pending_amount: '23.75',
    missing_institutional_receipt_count: 0,
    reversed_payments_count: 0,
    reversed_payments_total: '0.00',
    payments: [],
    movements: [],
    ...overrides,
  };
}
