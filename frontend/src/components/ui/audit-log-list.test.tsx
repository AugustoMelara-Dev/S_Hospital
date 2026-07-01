import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuditLogList, type AuditLogEntry } from './audit-log-list';

const baseEntries: AuditLogEntry[] = [
  {
    id: 1,
    action: 'invoices.create',
    result: 'success',
    reason: null,
    user: { name: 'Cajero Demo', username: 'cajero' },
    created_at: '2026-06-30T15:00:00.000Z',
  },
  {
    id: 2,
    action: 'invoices.void',
    result: 'success',
    reason: 'Error operativo en cobro',
    user: { name: 'Supervisor Demo' },
    created_at: '2026-06-30T15:10:00.000Z',
  },
  {
    id: 3,
    action: 'fiscal_sequence.changed_with_reason',
    result: 'denied',
    reason: 'Sin permiso fiscal.sequences.reset',
    user: { name: 'Cajero Demo', username: 'cajero' },
    created_at: '2026-06-30T15:20:00.000Z',
  },
];

describe('AuditLogList', () => {
  it('renders empty state when there are no entries', () => {
    render(<AuditLogList entries={[]} />);
    expect(screen.getByText('Sin movimientos auditados')).toBeInTheDocument();
  });

  it('renders entries with humanized action and result', () => {
    render(<AuditLogList entries={baseEntries} />);

    expect(screen.getByText('Invoices Create')).toBeInTheDocument();
    expect(screen.getByText('Invoices Void')).toBeInTheDocument();
    expect(screen.getByText('Fiscal Sequence Changed With Reason')).toBeInTheDocument();

    expect(screen.getAllByText('Éxito').length).toBeGreaterThan(0);
    expect(screen.getByText('Denegado')).toBeInTheDocument();

    expect(screen.getByText(/Error operativo en cobro/)).toBeInTheDocument();
    expect(screen.getAllByText(/Cajero Demo/).length).toBeGreaterThan(0);
  });
});