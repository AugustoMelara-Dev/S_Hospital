import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  it('closes the menu after selecting an enabled action', async () => {
    const onSelect = vi.fn();
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

    const trigger = screen.getByRole('button', { name: 'Acciones' });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Enter', code: 'Enter', keyCode: 13, charCode: 13 });

    const item = await screen.findByRole('menuitem', { name: 'Ver recibo' });
    fireEvent.click(item);

    expect(onSelect).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });
});
