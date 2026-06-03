import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CategorySheet } from './CategorySheet';

describe('CategorySheet', () => {
  afterEach(() => {
    cleanup();
  });

  it('exposes the active category checkbox as a labeled control', () => {
    render(
      <CategorySheet
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/categor[ií]a activa/i)).toBeInTheDocument();
  });
});
