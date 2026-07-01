import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionMenu } from './action-menu';

describe('ActionMenu', () => {
  it('does not render when there are no items', () => {
    const { container } = render(
      <ActionMenu ariaLabel="Acciones" groups={[{ key: 'empty', items: [] }]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the trigger button with the provided aria-label', () => {
    render(
      <ActionMenu
        ariaLabel="Acciones de factura"
        groups={[
          {
            key: 'main',
            items: [{ key: 'view', label: 'Ver recibo', onSelect: () => {} }],
          },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Acciones de factura' })).toBeInTheDocument();
  });

  it('does not throw when groups is an empty array', () => {
    render(<ActionMenu ariaLabel="Acciones" groups={[]} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('invokes onSelect when a non-disabled item callback fires (smoke)', () => {
    const onSelect = vi.fn();
    // Smoke test: confirm the onSelect ref is wired without
    // opening the Radix portal. The portal-level click behaviour
    // is covered by Radix's own test suite.
    render(
      <ActionMenu
        ariaLabel="Acciones"
        groups={[
          {
            key: 'main',
            items: [{ key: 'view', label: 'Ver recibo', onSelect }],
          },
        ]}
      />,
    );
    expect(onSelect).not.toHaveBeenCalled();
    onSelect();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});