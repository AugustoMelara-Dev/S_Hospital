import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '@/lib/api';

import { CategoryDrawer } from './CategoryDrawer';

const noop = () => undefined;
const renderDrawer = (props: Partial<React.ComponentProps<typeof CategoryDrawer>> = {}) => render(<CategoryDrawer open onOpenChange={noop} category={null} onSuccess={noop} {...props} />);

describe('CategoryDrawer', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('exposes an accessible sheet for create and edit', () => {
    const { rerender } = renderDrawer();
    expect(screen.getByRole('dialog', { name: /nueva categoría/i })).toBeInTheDocument();
    expect(screen.getByText(/cree una nueva categoría/i)).toBeInTheDocument();
    rerender(<CategoryDrawer open onOpenChange={noop} category={{ id: 4, name: 'Laboratorio', sort_order: 2, active: true }} onSuccess={noop} />);
    expect(screen.getByRole('dialog', { name: /editar categoría/i })).toBeInTheDocument();
  });

  it('organizes data and status sections', () => {
    renderDrawer();
    expect(screen.getByRole('group', { name: /datos básicos/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: /estado/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /categoría activa/i })).toBeChecked();
  });

  it('preserves create payload and edit id contracts', async () => {
    const save = vi.spyOn(apiClient, 'saveCategory').mockResolvedValue({ id: 7, name: 'Imagenologia', slug: 'imagenologia', active: true, sort_order: 3 });
    const onSuccess = vi.fn();
    renderDrawer({ onSuccess });
    fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: 'Imagenologia' } });
    fireEvent.change(screen.getByLabelText(/orden/i), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /crear categoría/i }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ name: 'Imagenologia', sort_order: 3, active: true }, undefined));
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('sends the category id while editing', async () => {
    const save = vi.spyOn(apiClient, 'saveCategory').mockResolvedValue({ id: 4, name: 'Laboratorio Clínico', slug: 'laboratorio', active: true, sort_order: 2 });
    renderDrawer({ category: { id: 4, name: 'Laboratorio', sort_order: 2, active: true } });
    fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: 'Laboratorio Clínico' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: 'Laboratorio Clínico' }), 4));
  });

  it('reports safe server errors without closing', async () => {
    vi.spyOn(apiClient, 'saveCategory').mockRejectedValue(new ApiError('SQLSTATE storage/logs', 500));
    const onOpenChange = vi.fn();
    renderDrawer({ onOpenChange });
    fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: 'Cardiologia' } });
    fireEvent.click(screen.getByRole('button', { name: /crear categoría/i }));
    expect(await screen.findByText(/servidor local no pudo completar/i)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/SQLSTATE|storage\/logs/);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
