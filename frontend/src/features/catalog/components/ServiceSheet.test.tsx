import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/lib/api';
import { ServiceSheet } from './ServiceSheet';

describe('ServiceSheet', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('requires and sends a reason when editing a service price', async () => {
    const saveService = vi.spyOn(apiClient, 'saveService').mockResolvedValue({
      id: 1,
      category_id: 1,
      name: 'Glucosa',
      slug: 'glucosa',
      price: '20.00',
      scan_code: null,
      barcode: null,
      qr_code: null,
      taxable: true,
      active: true,
      special_rule_code: null,
    });
    const onSuccess = vi.fn();

    render(
      <ServiceSheet
        open
        onOpenChange={vi.fn()}
        service={{
          id: 1,
          category_id: 1,
          name: 'Glucosa',
          price: '15.00',
          scan_code: null,
          barcode: null,
          qr_code: null,
          taxable: true,
          active: true,
          special_rule_code: null,
        }}
        categories={[{ id: 1, name: 'Laboratorio' }]}
        onSuccess={onSuccess}
      />,
    );

    expect(screen.queryByLabelText(/motivo del cambio de precio/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: '20.00' } });
    expect(await screen.findByLabelText(/motivo del cambio de precio/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    expect(await screen.findByText(/indique el motivo del cambio de precio/i)).toBeInTheDocument();
    expect(saveService).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/motivo del cambio de precio/i), {
      target: { value: 'Ajuste aprobado por administracion' },
    });
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    await waitFor(() => {
      expect(saveService).toHaveBeenCalledWith(
        expect.objectContaining({
          price: '20.00',
          price_change_reason: 'Ajuste aprobado por administracion',
        }),
        1,
      );
    });
    expect(onSuccess).toHaveBeenCalled();
  });
});
