import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  it('renders a stable human label for financial states', () => {
    render(<StatusBadge status="paid" />);

    expect(screen.getByText('Pagada')).toBeInTheDocument();
  });

  it('allows explicit copy when a screen needs a more specific label', () => {
    render(<StatusBadge status="pending">Backup pendiente</StatusBadge>);

    expect(screen.getByText('Backup pendiente')).toBeInTheDocument();
  });

  it('keeps semantic classes for financial states in light and dark themes', () => {
    const { rerender } = render(<StatusBadge status="paid" />);

    expect(screen.getByText('Pagada')).toHaveClass('bg-success/15', 'text-success-foreground');

    document.documentElement.classList.add('dark');
    rerender(<StatusBadge status="partial" />);

    expect(screen.getByText('Parcial')).toHaveClass('bg-warning/15', 'text-warning-foreground', 'dark:text-warning-foreground');

    rerender(<StatusBadge status="void" />);

    expect(screen.getByText('Anulada')).toHaveClass('bg-destructive', 'text-destructive-foreground');
  });
});
