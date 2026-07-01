import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '@/lib/api';
import { CategorySheet } from './CategorySheet';

const noop = () => undefined;

function renderSheet(props: Partial<React.ComponentProps<typeof CategorySheet>> = {}) {
  return render(
    <CategorySheet open onOpenChange={noop} category={null} onSuccess={noop} {...props} />,
  );
}

describe('CategorySheet', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens with an accessible name and description for the new category flow', () => {
    renderSheet();

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /nueva categor[ií]a/i, level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/cree una nueva categor[ií]a para organizar servicios/i),
    ).toBeInTheDocument();
  });

  it('switches to the edit title when a category is provided', () => {
    renderSheet({ category: { id: 4, name: 'Laboratorio', sort_order: 2, active: true } });

    expect(
      screen.getByRole('heading', { name: /editar categor[ií]a/i, level: 2 }),
    ).toBeInTheDocument();
  });

  it('organizes category editing into data and status sections', () => {
    renderSheet();

    const sectionHeadings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);

    expect(sectionHeadings).toEqual([
      'Nueva Categoría',
      'Datos básicos',
      'Estado',
    ]);
    expect(screen.queryByText(/datos de la categor[iÃ­]a/i)).not.toBeInTheDocument();
  });

  it('keeps the create payload contract (name, sort_order, active)', async () => {
    const saveCategory = vi.spyOn(apiClient, 'saveCategory').mockResolvedValue({
      id: 7,
      name: 'Imagenologia',
      slug: 'imagenologia',
      active: true,
      sort_order: 3,
    });
    const onSuccess = vi.fn();

    renderSheet({ onSuccess });

    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: 'Imagenologia' },
    });
    fireEvent.change(screen.getByLabelText(/orden/i), {
      target: { value: '3' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    });

    await waitFor(() => {
      expect(saveCategory).toHaveBeenCalledWith(
        { name: 'Imagenologia', sort_order: 3, active: true },
        undefined,
      );
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('sends the ID in the second argument when editing a category', async () => {
    const saveCategory = vi.spyOn(apiClient, 'saveCategory').mockResolvedValue({
      id: 4,
      name: 'Laboratorio',
      slug: 'laboratorio',
      active: true,
      sort_order: 2,
    });
    const onSuccess = vi.fn();

    renderSheet({
      category: { id: 4, name: 'Laboratorio', sort_order: 2, active: true },
      onSuccess,
    });

    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: 'Laboratorio Clínico' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));
    });

    await waitFor(() => {
      expect(saveCategory).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Laboratorio Clínico' }),
        4,
      );
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('prevents duplicate submissions while the mutation is pending', async () => {
    let resolveSave: () => void = () => undefined;
    const saveCategory = vi
      .spyOn(apiClient, 'saveCategory')
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSave = () => resolve({ id: 1, name: 'X', slug: 'x', active: true, sort_order: 0 });
          }),
      );

    renderSheet();

    fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: 'X' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /guardando|crear/i }));
    });

    expect(saveCategory).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave();
    });
  });

  it('does not expose delete or restore actions that are not part of the contract', () => {
    renderSheet();
    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restaurar/i })).not.toBeInTheDocument();
  });

  it('renders server-side errors in an accessible alert without closing the sheet', async () => {
    vi.spyOn(apiClient, 'saveCategory').mockRejectedValueOnce(
      new ApiError('SQLSTATE[HY000]: leak stack storage/logs/laravel.log', 500),
    );
    const onOpenChange = vi.fn();

    renderSheet({ onOpenChange });

    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: 'Cardiologia' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    });

    expect(
      await screen.findByText(/el servidor lan no pudo completar la operaci[oó]n/i),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/SQLSTATE|storage\/logs|stack trace/);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
