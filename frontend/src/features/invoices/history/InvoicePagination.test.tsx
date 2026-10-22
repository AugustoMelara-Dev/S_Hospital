import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PaginatedMeta } from '../../../lib/api';
import { InvoicePagination } from './InvoicePagination';

afterEach(cleanup);

function metaFixture(overrides: Partial<PaginatedMeta> = {}): PaginatedMeta {
  return { current_page: 2, per_page: 10, total: 45, ...overrides };
}

describe('InvoicePagination (admin)', () => {
  it('renders admin controls, marks the active page and keeps the nav label', () => {
    render(<InvoicePagination disabled={false} meta={metaFixture()} onChange={vi.fn()} />);

    const nav = screen.getByRole('navigation', { name: 'Paginación de facturas' });
    const active = within(nav).getByRole('link', { name: 'Página 2' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active).toHaveClass('border-[var(--ui-action)]', 'bg-[var(--ui-action)]');
    // Etiqueta sobre relleno de acción: tinta oscura (AA dark 8.03), nunca blanco.
    expect(active).toHaveClass('text-[color:var(--ui-action-foreground)]');
    expect(within(nav).getByRole('link', { name: 'Página 1' })).toHaveClass(
      'border-[var(--ui-line)]',
      'bg-[var(--ui-surface)]',
    );
  });

  it('advances and goes back within bounds without navigating the anchor', () => {
    const onChange = vi.fn();
    render(<InvoicePagination disabled={false} meta={metaFixture()} onChange={onChange} />);

    fireEvent.click(screen.getByRole('link', { name: 'Página siguiente' }));
    expect(onChange).toHaveBeenCalledWith(3);

    fireEvent.click(screen.getByRole('link', { name: 'Página anterior' }));
    expect(onChange).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole('link', { name: 'Página 3' }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('disables previous on the first page and next on the last page', () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <InvoicePagination disabled={false} meta={metaFixture({ current_page: 1 })} onChange={onChange} />,
    );

    const previous = screen.getByRole('link', { name: 'Página anterior' });
    expect(previous).toHaveAttribute('aria-disabled', 'true');
    expect(previous).toHaveAttribute('tabindex', '-1');
    fireEvent.click(previous);
    expect(onChange).not.toHaveBeenCalled();
    unmount();

    render(
      <InvoicePagination disabled={false} meta={metaFixture({ current_page: 5, total: 45 })} onChange={onChange} />,
    );
    const next = screen.getByRole('link', { name: 'Página siguiente' });
    expect(next).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(next);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('blocks every page while the list is loading', () => {
    const onChange = vi.fn();
    render(<InvoicePagination disabled meta={metaFixture()} onChange={onChange} />);

    const page = screen.getByRole('link', { name: 'Página 3' });
    expect(page).toHaveAttribute('aria-disabled', 'true');
    expect(page).toHaveAttribute('tabindex', '-1');
    fireEvent.click(page);
    expect(onChange).not.toHaveBeenCalled();
  });
});
