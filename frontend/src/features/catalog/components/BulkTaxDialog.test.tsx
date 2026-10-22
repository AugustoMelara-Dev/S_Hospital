import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BulkTaxDialog } from './BulkTaxDialog';
import { ApiError, apiClient, type Category, type Service, type TaxRate } from '@/lib/api';

const categories: Category[] = [
  { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
  { id: 2, name: 'Consulta', slug: 'consulta', active: true, sort_order: 2 },
];

const services: Service[] = [
  { id: 10, category_id: 1, name: 'Glucosa', slug: 'glucosa', price: '15.00', taxable: false, active: true, special_rule_code: null },
  { id: 11, category_id: 1, name: 'Hemograma', slug: 'hemograma', price: '20.00', taxable: false, active: true, special_rule_code: null },
];

const taxRates: TaxRate[] = [
  { id: 1, name: 'ISV 15 %', percentage: '15.00', active: true, is_default: true },
  { id: 2, name: 'Exento', percentage: '0.00', active: true, is_default: false },
];

function renderDialog(overrides: Partial<Parameters<typeof BulkTaxDialog>[0]> = {}) {
  const onApplied = vi.fn();
  const onStatus = vi.fn();
  const onOpenChange = vi.fn();

  render(
    <BulkTaxDialog
      open
      onOpenChange={onOpenChange}
      categories={categories}
      services={services}
      taxRates={taxRates}
      canManage
      onApplied={onApplied}
      onStatus={onStatus}
      {...overrides}
    />,
  );

  return { onApplied, onStatus, onOpenChange };
}

describe('BulkTaxDialog', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('aplica la tasa predeterminada a toda una categoría con motivo', async () => {
    const bulk = vi.spyOn(apiClient, 'bulkUpdateServiceTax').mockResolvedValue(7);
    const { onApplied, onOpenChange } = renderDialog();

    expect(await screen.findByRole('dialog', { name: /editar impuestos en lote/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText(/^categoría/i)).toHaveValue('1'));
    expect(screen.getByLabelText(/tasa que se aplicará/i)).toHaveValue('1');

    fireEvent.change(screen.getByLabelText(/motivo del cambio/i), {
      target: { value: 'Revisión de impuestos del catálogo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /aplicar a los conceptos/i }));

    await waitFor(() => {
      expect(bulk).toHaveBeenCalledWith({
        category_id: 1,
        tax_rate_id: 1,
        reason: 'Revisión de impuestos del catálogo',
      });
    });
    expect(onApplied).toHaveBeenCalledWith(7);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('aplica «Exento» sólo a los conceptos seleccionados', async () => {
    const bulk = vi.spyOn(apiClient, 'bulkUpdateServiceTax').mockResolvedValue(2);
    renderDialog();

    fireEvent.click(await screen.findByLabelText(/conceptos seleccionados/i));
    fireEvent.click(screen.getByLabelText(/^glucosa/i));
    fireEvent.click(screen.getByLabelText(/^hemograma/i));
    fireEvent.change(screen.getByLabelText(/tasa que se aplicará/i), { target: { value: 'exempt' } });
    fireEvent.change(screen.getByLabelText(/motivo del cambio/i), {
      target: { value: 'Exoneración institucional aprobada' },
    });

    expect(screen.getByText(/2 conceptos seleccionados/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /aplicar a los conceptos/i }));

    await waitFor(() => {
      expect(bulk).toHaveBeenCalledWith({
        service_ids: [10, 11],
        tax_rate_id: null,
        reason: 'Exoneración institucional aprobada',
      });
    });
  });

  it('mantiene el diálogo y muestra el error del servidor sin simular el cambio', async () => {
    vi.spyOn(apiClient, 'bulkUpdateServiceTax').mockRejectedValue(
      new ApiError('La tasa está inactiva y no puede asignarse.', 422),
    );
    const { onApplied } = renderDialog();

    fireEvent.change(await screen.findByLabelText(/motivo del cambio/i), {
      target: { value: 'Intento con tasa inactiva' },
    });
    fireEvent.click(screen.getByRole('button', { name: /aplicar a los conceptos/i }));

    expect(await screen.findByText(/la tasa está inactiva/i)).toBeInTheDocument();
    expect(onApplied).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /editar impuestos en lote/i })).toBeInTheDocument();
  });

  it('no permite aplicar sin motivo y advierte si no hay tasas configuradas', async () => {
    const bulk = vi.spyOn(apiClient, 'bulkUpdateServiceTax').mockResolvedValue(0);
    renderDialog({ taxRates: [] });

    expect(await screen.findByText(/sin tasas configuradas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aplicar a los conceptos/i })).toBeDisabled();
    expect(bulk).not.toHaveBeenCalled();
  });
});
