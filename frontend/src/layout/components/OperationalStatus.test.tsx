import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { type CashSession } from '../../lib/api';
import { OperationalStatus } from './OperationalStatus';

const openCashSession: CashSession = {
  id: 12,
  user_id: 1,
  opening_amount: '100.00',
  closing_amount: null,
  expected_amount: null,
  difference_amount: null,
  status: 'open',
  opening_notes: null,
  closing_notes: null,
  opened_at: '2026-07-07T08:00:00.000Z',
  closed_at: null,
};

describe('OperationalStatus', () => {
  it('keeps the topbar focused on LAN and cash state without a visible clock chip', () => {
    render(
      <OperationalStatus
        cashSession={openCashSession}
        isOnline
        lastCheck={new Date('2026-07-07T13:15:00.000Z')}
        status="Servidor local disponible"
      />,
    );

    expect(screen.getByLabelText(/conexion local disponible/i)).toBeInTheDocument();
    expect(screen.getByText(/caja #12/i)).toBeInTheDocument();
    expect(screen.queryByText(/7 jul 2026, 13:15/i)).not.toBeInTheDocument();
  });
});
