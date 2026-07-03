import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiClient } from '@/lib/api';
import { ServiceSheet } from './ServiceSheet';

const noop = () => undefined;

describe('ServiceSheet', () => {
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
      <ServiceSheet
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
    fireEvent.click(screen.getByRole('button', { name: /actualizar/i }));

    await waitFor(() => {
      expect(saveService).toHaveBeenCalledWith(
        expect.objectContaining({
          price: '20.00',
          area_id: 1,
          price_change_reason: 'Ajuste aprobado por administracion',
          visible_in_billing: false,
          is_billable: false,
        }),
        1,
      );
    });
    expect(onSuccess).toHaveBeenCalled();
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
      <ServiceSheet
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
      <ServiceSheet
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
      <ServiceSheet
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

describe('ServiceSheet contract preservation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('opens with the new-service accessible name when no service is provided', () => {
    render(
      <ServiceSheet
        open
        onOpenChange={noop}
        service={null}
        categories={[{ id: 1, name: 'Laboratorio' }]}
        areas={[{ id: 1, name: 'Laboratorio' }]}
        onSuccess={noop}
      />,
    );

    expect(
      screen.getByRole('heading', { name: /nuevo servicio/i, level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/agregue un nuevo servicio al cat[aá]logo/i),
    ).toBeInTheDocument();
  });

  it('organizes the service drawer into the required Phase 8 sections', () => {
    render(
      <ServiceSheet
        open
        onOpenChange={noop}
        service={null}
        categories={[{ id: 1, name: 'Laboratorio' }]}
        areas={[{ id: 1, name: 'Laboratorio' }]}
        onSuccess={noop}
      />,
    );

    const sectionHeadings = screen
      .getAllByRole('heading', { level: 2 })
      .map((heading) => heading.textContent);

    expect(sectionHeadings).toEqual([
      'Nuevo servicio',
      'Datos básicos',
      'Precio',
      'Reglas',
      'Estado',
    ]);
    expect(screen.queryByText(/identificaci[oÃ³]n/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/tarifa y trazabilidad/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/reglas operativas/i)).not.toBeInTheDocument();
  });

  it('renders the initial values for editing mode without changing units or rounding', () => {
    render(
      <ServiceSheet
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
        scannerEnabled
        onSuccess={noop}
      />,
    );

    expect(screen.getByDisplayValue('Hemograma')).toBeInTheDocument();
    expect(screen.getByDisplayValue('275.50')).toBeInTheDocument();
    expect(screen.getByDisplayValue('LAB-HEM-01')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1234567890')).toBeInTheDocument();
    expect(screen.getByLabelText(/visible en caja/i)).toBeChecked();
    expect(screen.getByLabelText(/^facturable$/i)).toBeChecked();
  });

  it('submits scanner, barcode, QR and billing-state flags from the form', async () => {
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
      <ServiceSheet
        open
        onOpenChange={noop}
        service={null}
        categories={[{ id: 1, name: 'Laboratorio' }]}
        areas={[{ id: 1, name: 'Laboratorio' }]}
        scannerEnabled
        onSuccess={noop}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^nombre/i), { target: { value: 'Glucosa' } });
    fireEvent.change(screen.getByLabelText(/precio/i), { target: { value: '15.00' } });
    fireEvent.change(screen.getByLabelText(/código de escáner/i), { target: { value: 'LAB-GLU-001' } });
    fireEvent.change(screen.getByLabelText(/código de barra/i), { target: { value: '7700000001001' } });
    fireEvent.change(screen.getByLabelText(/código qr/i), { target: { value: 'QR-LAB-GLU' } });
    fireEvent.click(screen.getByLabelText(/visible en caja/i));
    fireEvent.click(screen.getByLabelText(/^facturable$/i));
    fireEvent.click(screen.getByRole('button', { name: /crear/i }));

    await waitFor(() => {
      expect(saveService).toHaveBeenCalledWith(
        expect.objectContaining({
          scan_code: 'LAB-GLU-001',
          barcode: '7700000001001',
          qr_code: 'QR-LAB-GLU',
          visible_in_billing: false,
          is_billable: false,
        }),
        undefined,
      );
    });
  });

  it('normalizes erythropoietin services to the fixed L 25.00 catalog price', async () => {
    const saveService = vi.spyOn(apiClient, 'saveService').mockResolvedValue({
      id: 13,
      category_id: 1,
      area_id: 1,
      name: 'Eritropoyetina 4000 UI',
      slug: 'eritropoyetina-4000-ui',
      price: '25.00',
      scan_code: null,
      barcode: null,
      qr_code: null,
      taxable: true,
      active: true,
      special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
    });

    render(
      <ServiceSheet
        open
        onOpenChange={noop}
        service={null}
        categories={[{ id: 1, name: 'Farmacia' }]}
        areas={[{ id: 1, name: 'Farmacia' }]}
        onSuccess={noop}
      />,
    );

    fireEvent.change(screen.getByLabelText(/^nombre/i), {
      target: { value: 'Eritropoyetina 4000 UI' },
    });
    fireEvent.change(screen.getByLabelText(/precio/i), {
      target: { value: '125.00' },
    });

    const ruleSelect = screen.getByRole('combobox', { name: /regla especial/i });
    fireEvent.keyDown(ruleSelect, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: /eritropoyetina con receta de di[aá]lisis/i }));

    expect(screen.getByLabelText(/precio/i)).toHaveValue('25.00');

    fireEvent.click(screen.getByRole('button', { name: /crear/i }));

    await waitFor(() => {
      expect(saveService).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Eritropoyetina 4000 UI',
          price: '25.00',
          special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
        }),
        undefined,
      );
    });
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
      <ServiceSheet
        open
        onOpenChange={noop}
        service={null}
        categories={[{ id: 1, name: 'Imagen' }, { id: 2, name: 'Cardiologia' }]}
        areas={[{ id: 1, name: 'Imagen' }]}
        onSuccess={onSuccess}
      />,
    );

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
          special_rule_code: null,
        }),
        undefined,
      );
    });
    expect(onSuccess).toHaveBeenCalled();
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
      <ServiceSheet
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
      <ServiceSheet
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

  it('exposes a sanitize-friendly error alert and does not close the sheet on failure', async () => {
    vi.spyOn(apiClient, 'saveService').mockRejectedValueOnce(
      new ApiError('SQLSTATE[HY000]: stack trace storage/logs/laravel.log', 500),
    );
    const onOpenChange = vi.fn();

    render(
      <ServiceSheet
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
      await screen.findByText(/el servidor lan no pudo completar la operaci[oó]n/i),
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
      <ServiceSheet
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

  it('does not expose delete or restore actions that are not part of the contract', () => {
    render(
      <ServiceSheet
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
