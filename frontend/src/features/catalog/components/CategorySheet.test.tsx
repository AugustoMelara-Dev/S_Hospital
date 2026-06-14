import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '@/lib/api';
import { CategorySheet } from './CategorySheet';

describe('CategorySheet', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows backend validation errors instead of failing silently', async () => {
    vi.spyOn(apiClient, 'saveCategory').mockRejectedValue(
      new ApiError('Datos invalidos.', 422, {
        name: ['El nombre ya existe.'],
      }),
    );

    render(
      <CategorySheet
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Laboratorio' } });
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));

    expect(await screen.findByText('El nombre ya existe.')).toBeInTheDocument();
    await waitFor(() => expect(apiClient.saveCategory).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Laboratorio' }),
      undefined,
    ));
  });

  it('shows a safe general message for server failures', async () => {
    vi.spyOn(apiClient, 'saveCategory').mockRejectedValue(
      new ApiError('SQLSTATE detalle interno', 500),
    );

    render(
      <CategorySheet
        open
        onOpenChange={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/nombre/i), { target: { value: 'Radiologia' } });
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));

    expect(await screen.findByText(/servidor lan no pudo completar/i)).toBeInTheDocument();
    expect(screen.queryByText(/SQLSTATE/i)).not.toBeInTheDocument();
  });
});
