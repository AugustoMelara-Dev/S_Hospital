import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TaxRatesView } from './TaxRatesView';
import { ApiError, apiClient, type TaxRate } from '@/lib/api';

const isv15: TaxRate = {
  id: 1,
  name: 'ISV 15 %',
  percentage: '15.00',
  active: true,
  is_default: true,
};

const exento: TaxRate = {
  id: 2,
  name: 'Exento',
  percentage: '0.00',
  active: true,
  is_default: false,
};

describe('TaxRatesView', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'getTaxRates').mockResolvedValue([isv15, exento]);
    vi.spyOn(apiClient, 'createTaxRate').mockResolvedValue({
      id: 3,
      name: 'ISV 18 %',
      percentage: '18.00',
      active: true,
      is_default: false,
    });
    vi.spyOn(apiClient, 'updateTaxRate').mockResolvedValue({ ...isv15, name: 'ISV 15 % revisado' });
    vi.spyOn(apiClient, 'deleteTaxRate').mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('lista nombre, porcentaje, estado y tasa predeterminada', async () => {
    render(<TaxRatesView canEdit onStatus={vi.fn()} />);

    const table = await screen.findByRole('table', { name: /tasas de impuesto configuradas/i });
    expect(within(table).getByText('ISV 15 %')).toBeInTheDocument();
    expect(within(table).getByText('15 %')).toBeInTheDocument();
    expect(within(table).getByText('Exento')).toBeInTheDocument();
    expect(within(table).getByText('0 %')).toBeInTheDocument();
    // Encabezado + chip de la fila predeterminada.
    expect(within(table).getAllByText('Predeterminada')).toHaveLength(2);
    expect(within(table).getAllByText('Activa')).toHaveLength(2);
  });

  it('explica que el cambio afecta a facturas nuevas y no recalcula las emitidas', async () => {
    render(<TaxRatesView canEdit onStatus={vi.fn()} />);

    expect(await screen.findByText(/cambiar o eliminar una tasa afecta a las/i)).toBeInTheDocument();
    expect(screen.getByText(/las facturas ya emitidas conservan el impuesto/i)).toBeInTheDocument();
  });

  it('muestra un estado vacío accionable cuando no hay tasas', async () => {
    vi.mocked(apiClient.getTaxRates).mockResolvedValue([]);

    render(<TaxRatesView canEdit onStatus={vi.fn()} />);

    expect(await screen.findByText(/todavía no hay tasas de impuesto/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear la primera tasa/i })).toBeInTheDocument();
  });

  it('ofrece reintentar cuando la carga falla, sin inventar tasas', async () => {
    const getTaxRates = vi.mocked(apiClient.getTaxRates);
    getTaxRates
      .mockRejectedValueOnce(new ApiError('No disponible', 500))
      .mockResolvedValueOnce([isv15]);

    render(<TaxRatesView canEdit onStatus={vi.fn()} />);

    expect(await screen.findByText(/no se pudieron cargar las tasas/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reintentar carga/i }));

    expect(await screen.findByText('ISV 15 %')).toBeInTheDocument();
  });

  it('crea una tasa con motivo obligatorio y porcentaje normalizado', async () => {
    const createTaxRate = vi.mocked(apiClient.createTaxRate);
    render(<TaxRatesView canEdit onStatus={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /nueva tasa/i }));
    fireEvent.change(await screen.findByLabelText(/^nombre/i), { target: { value: 'ISV 18 %' } });
    fireEvent.change(screen.getByLabelText(/^porcentaje/i), { target: { value: '18' } });
    fireEvent.change(screen.getByLabelText(/motivo del cambio/i), {
      target: { value: 'Tasa autorizada para el nuevo año fiscal' },
    });
    fireEvent.click(screen.getByRole('button', { name: /crear tasa/i }));

    await waitFor(() => {
      expect(createTaxRate).toHaveBeenCalledWith({
        name: 'ISV 18 %',
        percentage: '18.00',
        active: true,
        is_default: false,
        reason: 'Tasa autorizada para el nuevo año fiscal',
      });
    });

    expect(await screen.findByText('ISV 18 %')).toBeInTheDocument();
  });

  it('no guarda si falta el motivo del cambio', async () => {
    const createTaxRate = vi.mocked(apiClient.createTaxRate);
    render(<TaxRatesView canEdit onStatus={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /nueva tasa/i }));
    fireEvent.change(await screen.findByLabelText(/^nombre/i), { target: { value: 'ISV 18 %' } });
    fireEvent.change(screen.getByLabelText(/^porcentaje/i), { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: /crear tasa/i }));

    expect(await screen.findByText(/indique al menos 5 caracteres explicando el motivo/i)).toBeInTheDocument();
    expect(createTaxRate).not.toHaveBeenCalled();
  });

  it('exige motivo también al editar una tasa existente', async () => {
    const updateTaxRate = vi.mocked(apiClient.updateTaxRate);
    render(<TaxRatesView canEdit onStatus={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /editar tasa isv 15 %/i }));
    fireEvent.change(await screen.findByLabelText(/^nombre/i), { target: { value: 'ISV 15 % revisado' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(await screen.findByText(/indique al menos 5 caracteres/i)).toBeInTheDocument();
    expect(updateTaxRate).not.toHaveBeenCalled();
  });

  it('elimina con motivo y confirmación explícita', async () => {
    const deleteTaxRate = vi.mocked(apiClient.deleteTaxRate);
    render(<TaxRatesView canEdit onStatus={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /eliminar tasa exento/i }));
    expect(await screen.findByRole('dialog', { name: /eliminar tasa de impuesto/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/motivo de la eliminación/i), {
      target: { value: 'Tasa duplicada en revisión' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^eliminar tasa$/i }));

    await waitFor(() => expect(deleteTaxRate).toHaveBeenCalledWith(2, 'Tasa duplicada en revisión'));
    await waitFor(() => expect(screen.queryByText('Exento')).not.toBeInTheDocument());
  });

  it('conserva el diálogo y muestra el mensaje del servidor cuando la tasa está asignada', async () => {
    vi.mocked(apiClient.deleteTaxRate).mockRejectedValue(
      new ApiError('La tasa esta asignada a servicios. Reasigne esos servicios o desactive la tasa en lugar de eliminarla.', 422),
    );

    render(<TaxRatesView canEdit onStatus={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /eliminar tasa isv 15 %/i }));
    fireEvent.change(await screen.findByLabelText(/motivo de la eliminación/i), {
      target: { value: 'Limpieza de tasas sin uso' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^eliminar tasa$/i }));

    expect(await screen.findByText(/la tasa esta asignada a servicios/i)).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: /eliminar tasa de impuesto/i })).toBeInTheDocument();
  });

  it('en modo lectura no ofrece crear, editar ni eliminar', async () => {
    render(<TaxRatesView canEdit={false} onStatus={vi.fn()} />);

    expect(await screen.findByText('ISV 15 %')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /nueva tasa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /editar tasa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /eliminar tasa/i })).not.toBeInTheDocument();
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
  });

  it('no permite eliminar sin motivo y mantiene la acción deshabilitada', async () => {
    const deleteTaxRate = vi.mocked(apiClient.deleteTaxRate);
    render(<TaxRatesView canEdit onStatus={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /eliminar tasa exento/i }));

    const confirm = screen.getByRole('button', { name: /^eliminar tasa$/i });
    expect(confirm).toBeDisabled();
    expect(deleteTaxRate).not.toHaveBeenCalled();
  });
});
