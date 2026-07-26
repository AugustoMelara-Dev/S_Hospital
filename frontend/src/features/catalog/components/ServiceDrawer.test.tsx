import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '@/lib/api';
import { ServiceDrawer } from './ServiceDrawer';

const noop = () => undefined;

describe('ServiceDrawer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('requires and sends a reason when editing a service price', async () => {
    const saveService = vi.spyOn(apiClient, 'saveService').mockResolvedValue({
      id: 1,
      category_id: 1,
      area_id: 1,
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
      <ServiceDrawer
        open
        onOpenChange={vi.fn()}
        service={{
          id: 1,
          category_id: 1,
          area_id: 1,
          name: 'Glucosa',
          price: '15.00',
          scan_code: null,
          barcode: null,
          qr_code: null,
          taxable: true,
          active: true,
          visible_in_billing: true,
          is_billable: true,
          special_rule_code: null,
        }}
        categories={[{ id: 1, name: 'Laboratorio' }]}
        areas={[{ id: 1, name: 'Laboratorio' }]}
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
    fireEvent.click(screen.getByLabelText(/visible en caja/i));
    fireEvent.click(screen.getByLabelText(/^facturable$/i));
    fireEvent.change(await screen.findByLabelText(/motivo del cambio de disponibilidad/i), {
      target: { value: 'Servicio oculto temporalmente de caja' },
    });
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    await waitFor(() => {
      expect(saveService).toHaveBeenCalledWith(
        expect.objectContaining({
          price: '20.00',
          area_id: 1,
          price_change_reason: 'Ajuste aprobado por administracion',
          visible_in_billing: false,
          is_billable: false,
          availability_change_reason: 'Servicio oculto temporalmente de caja',
        }),
        1,
      );
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('summarizes audited catalog changes before saving', async () => {
    render(
      <ServiceDrawer
        open
        onOpenChange={vi.fn()}
        service={{
          id: 1,
          category_id: 1,
          area_id: 1,
          name: 'Glucosa',
          price: '15.00',
          scan_code: null,
          barcode: null,
          qr_code: null,
          taxable: true,
          active: true,
          visible_in_billing: true,
          is_billable: true,
          special_rule_code: null,
        }}
        categories={[{ id: 1, name: 'Laboratorio' }]}
        areas={[{ id: 1, name: 'Laboratorio' }]}
        onSuccess={noop}
      />,
    );

    expect(screen.queryByText(/cambios auditados/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: '20.00' } });
    fireEvent.click(screen.getByLabelText(/aplica isv/i));
    fireEvent.click(screen.getByLabelText(/visible en caja/i));

    expect(await screen.findByText(/cambios auditados/i)).toBeInTheDocument();
    expect(screen.getByText(/precio: l\. 15\.00 -> l\. 20\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/isv: aplica -> no aplica/i)).toBeInTheDocument();
    expect(screen.getByText(/visible en caja: si -> no/i)).toBeInTheDocument();
    expect(screen.getByText(/el backend exigira motivo y guardara auditoria/i)).toBeInTheDocument();
  });

  it('blocks short price change reasons before saving', async () => {
    const saveService = vi.spyOn(apiClient, 'saveService').mockResolvedValue({
      id: 1,
      category_id: 1,
      area_id: 1,
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

    render(
      <ServiceDrawer
        open
        onOpenChange={vi.fn()}
        service={{
          id: 1,
          category_id: 1,
          area_id: 1,
          name: 'Glucosa',
          price: '15.00',
          scan_code: null,
          barcode: null,
          qr_code: null,
          taxable: true,
          active: true,
          visible_in_billing: true,
          is_billable: true,
          special_rule_code: null,
        }}
        categories={[{ id: 1, name: 'Laboratorio' }]}
        areas={[{ id: 1, name: 'Laboratorio' }]}
        onSuccess={noop}
      />,
    );

    fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: '20.00' } });
    fireEvent.change(await screen.findByLabelText(/motivo del cambio de precio/i), {
      target: { value: 'x' },
    });
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    expect(await screen.findByText(/motivo del cambio de precio debe tener al menos 5 caracteres/i)).toBeInTheDocument();
    expect(saveService).not.toHaveBeenCalled();
  });

  it('blocks short tax change reasons before saving', async () => {
    const saveService = vi.spyOn(apiClient, 'saveService').mockResolvedValue({
      id: 1,
      category_id: 1,
      area_id: 1,
      name: 'Glucosa',
      slug: 'glucosa',
      price: '15.00',
      scan_code: null,
      barcode: null,
      qr_code: null,
      taxable: false,
      active: true,
      special_rule_code: null,
    });

    render(
      <ServiceDrawer
        open
        onOpenChange={vi.fn()}
        service={{
          id: 1,
          category_id: 1,
          area_id: 1,
          name: 'Glucosa',
          price: '15.00',
          scan_code: null,
          barcode: null,
          qr_code: null,
          taxable: true,
          active: true,
          visible_in_billing: true,
          is_billable: true,
          special_rule_code: null,
        }}
        categories={[{ id: 1, name: 'Laboratorio' }]}
        areas={[{ id: 1, name: 'Laboratorio' }]}
        onSuccess={noop}
      />,
    );

    fireEvent.click(screen.getByLabelText(/aplica isv/i));
    fireEvent.change(await screen.findByLabelText(/motivo del cambio de impuesto/i), {
      target: { value: 'x' },
    });
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    expect(await screen.findByText(/motivo del cambio de impuesto debe tener al menos 5 caracteres/i)).toBeInTheDocument();
    expect(saveService).not.toHaveBeenCalled();
  });

  it('requires and sends a reason when changing service availability for billing', async () => {
    const saveService = vi.spyOn(apiClient, 'saveService').mockResolvedValue({
      id: 1,
      category_id: 1,
      area_id: 1,
      name: 'Glucosa',
      slug: 'glucosa',
      price: '15.00',
      scan_code: null,
      barcode: null,
      qr_code: null,
      taxable: true,
      active: false,
      visible_in_billing: false,
      is_billable: false,
      special_rule_code: null,
    });

    render(
      <ServiceDrawer
        open
        onOpenChange={vi.fn()}
        service={{
          id: 1,
          category_id: 1,
          area_id: 1,
          name: 'Glucosa',
          price: '15.00',
          scan_code: null,
          barcode: null,
          qr_code: null,
          taxable: true,
          active: true,
          visible_in_billing: true,
          is_billable: true,
          special_rule_code: null,
        }}
        categories={[{ id: 1, name: 'Laboratorio' }]}
        areas={[{ id: 1, name: 'Laboratorio' }]}
        onSuccess={noop}
      />,
    );

    expect(screen.queryByLabelText(/motivo del cambio de disponibilidad/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/servicio activo/i));
    fireEvent.click(screen.getByLabelText(/visible en caja/i));
    expect(await screen.findByLabelText(/motivo del cambio de disponibilidad/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    expect(await screen.findByText(/indique el motivo del cambio de disponibilidad/i)).toBeInTheDocument();
    expect(saveService).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/motivo del cambio de disponibilidad/i), {
      target: { value: 'Servicio retirado temporalmente de caja' },
    });
    fireEvent.click(screen.getByLabelText(/^facturable$/i));
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    await waitFor(() => {
      expect(saveService).toHaveBeenCalledWith(
        expect.objectContaining({
          active: false,
          visible_in_billing: false,
          is_billable: false,
          availability_change_reason: 'Servicio retirado temporalmente de caja',
        }),
        1,
      );
    });
  });

  it('blocks short availability change reasons before saving', async () => {
    const saveService = vi.spyOn(apiClient, 'saveService').mockResolvedValue({
      id: 1,
      category_id: 1,
      area_id: 1,
      name: 'Glucosa',
      slug: 'glucosa',
      price: '15.00',
      scan_code: null,
      barcode: null,
      qr_code: null,
      taxable: true,
      active: false,
      special_rule_code: null,
    });

    render(
      <ServiceDrawer
        open
        onOpenChange={vi.fn()}
        service={{
          id: 1,
          category_id: 1,
          area_id: 1,
          name: 'Glucosa',
          price: '15.00',
          scan_code: null,
          barcode: null,
          qr_code: null,
          taxable: true,
          active: true,
          visible_in_billing: true,
          is_billable: true,
          special_rule_code: null,
        }}
        categories={[{ id: 1, name: 'Laboratorio' }]}
        areas={[{ id: 1, name: 'Laboratorio' }]}
        onSuccess={noop}
      />,
    );

    fireEvent.click(screen.getByLabelText(/servicio activo/i));
    fireEvent.change(await screen.findByLabelText(/motivo del cambio de disponibilidad/i), {
      target: { value: 'x' },
    });
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    expect(await screen.findByText(/motivo del cambio de disponibilidad debe tener al menos 5 caracteres/i)).toBeInTheDocument();
    expect(saveService).not.toHaveBeenCalled();
  });

  it('requires and sends a reason when editing the service tax flag', async () => {
    const saveService = vi.spyOn(apiClient, 'saveService').mockResolvedValue({
      id: 1,
      category_id: 1,
      area_id: 1,
      name: 'Glucosa',
      slug: 'glucosa',
      price: '15.00',
      scan_code: null,
      barcode: null,
      qr_code: null,
      taxable: false,
      active: true,
      special_rule_code: null,
    });

    render(
      <ServiceDrawer
        open
        onOpenChange={vi.fn()}
        service={{
          id: 1,
          category_id: 1,
          area_id: 1,
          name: 'Glucosa',
          price: '15.00',
          scan_code: null,
          barcode: null,
          qr_code: null,
          taxable: true,
          active: true,
          visible_in_billing: true,
          is_billable: true,
          special_rule_code: null,
        }}
        categories={[{ id: 1, name: 'Laboratorio' }]}
        areas={[{ id: 1, name: 'Laboratorio' }]}
        onSuccess={noop}
      />,
    );

    expect(screen.queryByLabelText(/motivo del cambio de impuesto/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/aplica isv/i));
    expect(await screen.findByLabelText(/motivo del cambio de impuesto/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    expect(await screen.findByText(/indique el motivo del cambio de impuesto/i)).toBeInTheDocument();
    expect(saveService).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/motivo del cambio de impuesto/i), {
      target: { value: 'Cambio autorizado por exoneracion institucional' },
    });
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    await waitFor(() => {
      expect(saveService).toHaveBeenCalledWith(
        expect.objectContaining({
          taxable: false,
          tax_change_reason: 'Cambio autorizado por exoneracion institucional',
        }),
        1,
      );
    });
  });
});

describe('ServiceDrawer contract preservation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens with the new-service accessible name when no service is provided', () => {
    render(
      <ServiceDrawer
        open
        onOpenChange={noop}
        service={null}
        categories={[{ id: 1, name: 'Laboratorio' }]}
        areas={[{ id: 1, name: 'Laboratorio' }]}
        onSuccess={noop}
      />,
    );

    expect(screen.getByRole('dialog', { name: /nuevo servicio/i })).toBeInTheDocument();
    expect(
      screen.getByText(/agregue un nuevo servicio al cat[aá]logo/i),
    ).toBeInTheDocument();
  });

  it('organizes the service drawer into the required Phase 8 sections', () => {
    render(
      <ServiceDrawer
        open
        onOpenChange={noop}
        service={null}
        categories={[{ id: 1, name: 'Laboratorio' }]}
        areas={[{ id: 1, name: 'Laboratorio' }]}
        onSuccess={noop}
      />,
    );

    expect(screen.getByRole('group', { name: 'Información' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Tarifa y reglas' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Disponibilidad' })).toBeInTheDocument();
    expect(screen.queryByText(/identificaci[oÃ³]n/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tarifa y trazabilidad/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reglas operativas/i)).not.toBeInTheDocument();
  });

  it('renders the initial values for editing mode without changing units or rounding', () => {
    render(
      <ServiceDrawer
        open
        onOpenChange={noop}
        service={{
          id: 9,
          category_id: 1,
          area_id: 1,
          name: 'Hemograma',
          price: '275.50',
          scan_code: 'LAB-HEM-01',
          barcode: '1234567890',
          qr_code: null,
          taxable: false,
          active: true,
          visible_in_billing: true,
          is_billable: true,
          special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
        }}
        categories={[{ id: 1, name: 'Laboratorio' }]}
        areas={[{ id: 1, name: 'Laboratorio' }]}
        onSuccess={noop}
      />,
    );

    expect(screen.getByDisplayValue('Hemograma')).toBeInTheDocument();
    expect(screen.getByDisplayValue('275.50')).toBeInTheDocument();
    expect(screen.queryByText(/LAB-HEM-01|1234567890/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/escáner|código de barra|código qr/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/visible en caja/i)).toBeChecked();
    expect(screen.getByLabelText(/^facturable$/i)).toBeChecked();
  });

  it('keeps scanner fields out of the form and submits empty codes for new services', async () => {
    const saveService = vi.spyOn(apiClient, 'saveService').mockResolvedValue({
      id: 12,
      category_id: 1,
      area_id: 1,
      name: 'Glucosa',
      slug: 'glucosa',
      price: '15.00',
      scan_code: 'LAB-GLU-001',
      barcode: '7700000001001',
      qr_code: 'QR-LAB-GLU',
      taxable: true,
      active: true,
      special_rule_code: null,
    });

    render(
      <ServiceDrawer
        open
        onOpenChange={noop}
        service={null}
        categories={[{ id: 1, name: 'Laboratorio' }]}
        areas={[{ id: 1, name: 'Laboratorio' }]}
        onSuccess={noop}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: 'Glucosa' } });
    fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: '15.00' } });
    expect(screen.queryByLabelText(/escáner|código de barra|código qr/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/visible en caja/i));
    fireEvent.click(screen.getByLabelText(/^facturable$/i));
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));

    await waitFor(() => {
      expect(saveService).toHaveBeenCalledWith(
        expect.objectContaining({
          scan_code: null,
          barcode: null,
          qr_code: null,
          visible_in_billing: false,
          is_billable: false,
        }),
        undefined,
      );
    });
  });

  it('shows the erythropoietin institutional rule as read-only and locks price and tax fields', () => {
    render(
      <ServiceDrawer
        open
        onOpenChange={noop}
        service={{
          id: 13,
          category_id: 1,
          area_id: 1,
          name: 'Eritropoyetina 4000 UI',
          price: '25.00',
          scan_code: null,
          barcode: null,
          qr_code: null,
          taxable: false,
          active: true,
          visible_in_billing: true,
          is_billable: true,
          special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
        }}
        categories={[{ id: 1, name: 'Farmacia' }]}
        areas={[{ id: 1, name: 'Farmacia' }]}
        onSuccess={noop}
      />,
    );

    expect(screen.getByLabelText(/precio/i)).toBeDisabled();
    expect(screen.queryByRole('combobox', { name: /regla especial/i })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /aplica isv/i })).toBeDisabled();
    expect(screen.getByText(/regla institucional de eritropoyetina/i)).toBeInTheDocument();
    expect(screen.getByText(/eritropoyetina mantiene precio fijo/i)).toBeInTheDocument();
  });

  it('submits the create payload with the same field names and category/area IDs', async () => {
    const saveService = vi.spyOn(apiClient, 'saveService').mockResolvedValue({
      id: 12,
      category_id: 2,
      area_id: 1,
      name: 'Radiografia',
      slug: 'radiografia',
      price: '300.00',
      scan_code: null,
      barcode: null,
      qr_code: null,
      taxable: true,
      active: true,
      special_rule_code: null,
    });
    const onSuccess = vi.fn();

    render(
      <ServiceDrawer
        open
        onOpenChange={noop}
        service={null}
        categories={[{ id: 1, name: 'Imagen' }, { id: 2, name: 'Cardiologia' }]}
        areas={[{ id: 1, name: 'Imagen' }]}
        onSuccess={onSuccess}
      />,
    );

    expect(screen.queryByRole('combobox', { name: /regla especial/i })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: 'Radiografia' },
    });
    fireEvent.change(screen.getByLabelText(/precio/i), {
      target: { value: '300.00' },
    });

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    });

    await waitFor(() => {
      expect(saveService).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Radiografia',
          price: '300.00',
          category_id: expect.any(Number),
          area_id: expect.any(Number),
          taxable: expect.any(Boolean),
          active: expect.any(Boolean),
          visible_in_billing: true,
          is_billable: true,
        }),
        undefined,
      );
      expect(saveService.mock.calls[0]?.[0]).not.toHaveProperty('special_rule_code');
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it('trims the visible service name before saving', async () => {
    const saveService = vi.spyOn(apiClient, 'saveService').mockResolvedValue({
      id: 14,
      category_id: 1,
      area_id: 1,
      name: 'Consulta externa',
      slug: 'consulta-externa',
      price: '50.00',
      scan_code: null,
      barcode: null,
      qr_code: null,
      taxable: true,
      active: true,
      special_rule_code: null,
    });

    render(
      <ServiceDrawer
        open
        onOpenChange={noop}
        service={null}
        categories={[{ id: 1, name: 'Consulta externa' }]}
        areas={[{ id: 1, name: 'Consulta externa' }]}
        onSuccess={noop}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: '  Consulta externa  ' },
    });
    fireEvent.change(screen.getByLabelText(/precio/i), {
      target: { value: '50.00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));

    await waitFor(() => {
      expect(saveService).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Consulta externa',
        }),
        undefined,
      );
    });
  });

  it('blocks zero service prices before saving', async () => {
    const saveService = vi.spyOn(apiClient, 'saveService').mockResolvedValue({
      id: 12,
      category_id: 1,
      area_id: 1,
      name: 'Consulta cero',
      slug: 'consulta-cero',
      price: '0.00',
      scan_code: null,
      barcode: null,
      qr_code: null,
      taxable: true,
      active: true,
      special_rule_code: null,
    });

    render(
      <ServiceDrawer
        open
        onOpenChange={noop}
        service={null}
        categories={[{ id: 1, name: 'Consulta externa' }]}
        areas={[{ id: 1, name: 'Consulta externa' }]}
        onSuccess={noop}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: 'Consulta cero' },
    });
    fireEvent.change(screen.getByLabelText(/precio/i), {
      target: { value: '0.00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));

    expect(await screen.findByText(/precio debe ser mayor que cero/i)).toBeInTheDocument();
    expect(saveService).not.toHaveBeenCalled();
  });

  it('keeps the edit payload contract and includes the service id', async () => {
    const saveService = vi.spyOn(apiClient, 'saveService').mockResolvedValue({
      id: 3,
      category_id: 1,
      area_id: 1,
      name: 'Consulta especializada',
      slug: 'consulta-especializada',
      price: '500.00',
      scan_code: null,
      barcode: null,
      qr_code: null,
      taxable: true,
      active: true,
      special_rule_code: null,
    });

    render(
      <ServiceDrawer
        open
        onOpenChange={noop}
        service={{
          id: 3,
          category_id: 1,
          area_id: 1,
          name: 'Consulta general',
          price: '450.00',
          scan_code: null,
          barcode: null,
          qr_code: null,
          taxable: true,
          active: true,
          special_rule_code: null,
        }}
        categories={[{ id: 1, name: 'Consulta externa' }]}
        areas={[{ id: 1, name: 'Consulta externa' }]}
        onSuccess={noop}
      />,
    );

    fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: '500.00' } });
    fireEvent.change(screen.getByLabelText(/motivo del cambio de precio/i), {
      target: { value: 'Ajuste anual administrativo' },
    });

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));
    });

    await waitFor(() => {
      expect(saveService).toHaveBeenCalledWith(
        expect.objectContaining({
          price: '500.00',
          price_change_reason: 'Ajuste anual administrativo',
        }),
        3,
      );
    });
  });

  it('exposes a sanitize-friendly error alert and does not close the drawer on failure', async () => {
    vi.spyOn(apiClient, 'saveService').mockRejectedValueOnce(
      new ApiError('SQLSTATE[HY000]: stack trace storage/logs/laravel.log', 500),
    );
    const onOpenChange = vi.fn();

    render(
      <ServiceDrawer
        open
        onOpenChange={onOpenChange}
        service={null}
        categories={[{ id: 1, name: 'Imagen' }]}
        areas={[{ id: 1, name: 'Imagen' }]}
        onSuccess={noop}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: 'Tomografia' },
    });
    fireEvent.change(screen.getByLabelText(/precio/i), {
      target: { value: '1200.00' },
    });

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    });

    expect(
      await screen.findByText(/el servidor local no pudo completar la operaci[oó]n/i),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/SQLSTATE|stack trace|storage\/logs/);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('prevents duplicate submissions while the save mutation is pending', async () => {
    let resolveSave: () => void = () => undefined;
    const saveService = vi
      .spyOn(apiClient, 'saveService')
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSave = () =>
              resolve({
                id: 1,
                category_id: 1,
                area_id: 1,
                name: 'X',
                slug: 'x',
                price: '0.00',
                scan_code: null,
                barcode: null,
                qr_code: null,
                taxable: true,
                active: true,
                special_rule_code: null,
              });
          }),
      );

    render(
      <ServiceDrawer
        open
        onOpenChange={noop}
        service={null}
        categories={[{ id: 1, name: 'Imagen' }]}
        areas={[{ id: 1, name: 'Imagen' }]}
        onSuccess={noop}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: 'X' } });
    fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: '50.00' } });

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /crear/i }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: /guardando|crear/i }));
    });

    expect(saveService).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      resolveSave();
    });
  });

  it('locks the service form while the save request is pending', async () => {
    let resolveSave: () => void = () => undefined;
    vi.spyOn(apiClient, 'saveService').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = () =>
            resolve({
              id: 1,
              category_id: 1,
              area_id: 1,
              name: 'Consulta',
              slug: 'consulta',
              price: '50.00',
              scan_code: null,
              barcode: null,
              qr_code: null,
              taxable: true,
              active: true,
              special_rule_code: null,
            });
        }),
    );

    render(
      <ServiceDrawer
        open
        onOpenChange={noop}
        service={null}
        categories={[{ id: 1, name: 'Consulta externa' }]}
        areas={[{ id: 1, name: 'Consulta externa' }]}
        onSuccess={noop}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: 'Consulta' } });
    fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: '50.00' } });
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /guardando/i })).toBeDisabled());
    expect(screen.getByLabelText(/^nombre/i)).toBeDisabled();
    expect(screen.getByLabelText(/precio/i)).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /categor/i })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /aplica isv/i })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /servicio activo/i })).toBeDisabled();

    await waitFor(() => {
      resolveSave();
    });
  });

  it('does not expose delete or restore actions that are not part of the contract', () => {
    render(
      <ServiceDrawer
        open
        onOpenChange={noop}
        service={{
          id: 1,
          category_id: 1,
          area_id: 1,
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
        areas={[{ id: 1, name: 'Laboratorio' }]}
        onSuccess={noop}
      />,
    );

    expect(screen.queryByRole('button', { name: /eliminar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /restaurar/i })).not.toBeInTheDocument();
  });
});
