import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders a stable human label for financial states', () => {
    render(<StatusBadge status="paid" />);

    expect(screen.getByText('Pagada')).toBeInTheDocument();
  });

  it('allows explicit copy when a screen needs a more specific label', () => {
    render(<StatusBadge status="pending">Backup pendiente</StatusBadge>);

    expect(screen.getByText('Backup pendiente')).toBeInTheDocument();
  });
});

