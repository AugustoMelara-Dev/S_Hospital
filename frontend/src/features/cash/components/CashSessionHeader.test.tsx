import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { CashSession } from '@/lib/api';
import { CashSessionHeader } from './CashSessionHeader';

describe('CashSessionHeader', () => {
  it('identifies a supervised foreign cashbox without offering invoice creation', () => {
    render(
      <MemoryRouter>
        <CashSessionHeader
          canCloseAnyCash
          canCreateInvoices
          isOwnSession={false}
          isLoading={false}
          onRefresh={vi.fn()}
          session={sessionFixture()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/maría fernanda lópez/i)).toBeVisible();
    expect(screen.getByText(/supervisión habilitada/i)).toBeVisible();
    expect(screen.queryByRole('link', { name: /nueva factura/i })).not.toBeInTheDocument();
  });

  it('labels the own-session scope for a regular cashier', () => {
    render(
      <MemoryRouter>
        <CashSessionHeader
          canCloseAnyCash={false}
          canCreateInvoices
          isOwnSession
          isLoading={false}
          onRefresh={vi.fn()}
          session={sessionFixture()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/caja propia/i)).toBeVisible();
    expect(screen.queryByText(/supervisión habilitada/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /nueva factura/i })).toHaveAttribute('href', '/billing/new');
  });

  it('does not offer invoice creation without invoices.create even on the own cashbox', () => {
    render(
      <MemoryRouter>
        <CashSessionHeader
          canCloseAnyCash={false}
          canCreateInvoices={false}
          isOwnSession
          isLoading={false}
          onRefresh={vi.fn()}
          session={sessionFixture()}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(/caja propia/i)).toBeVisible();
    expect(screen.queryByRole('link', { name: /nueva factura/i })).not.toBeInTheDocument();
  });
});

function sessionFixture(): CashSession {
  return {
    id: 17,
    user_id: 9,
    user: { id: 9, name: 'María Fernanda López', username: 'mlopez' },
    opening_amount: '100.00',
    closing_amount: null,
    expected_amount: '125.00',
    difference_amount: null,
    status: 'open',
    opening_notes: null,
    closing_notes: null,
    opened_at: '2026-07-10T08:00:00-06:00',
    closed_at: null,
  };
}
