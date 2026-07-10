import { createRef, type ComponentProps, type FormEvent } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ServiceSearch } from './ServiceSearch';
import type { Service } from '../../../lib/api';

describe('ServiceSearch', () => {
  it('renders accessible search, controlled value and safe financial values', () => {
    renderSearch({
      services: [serviceFixture({ price: 'NaN' })],
      search: 'glu',
    });

    const input = screen.getByLabelText(/buscar por nombre/i);
    expect(input).toHaveValue('glu');
    expect(input).toHaveAttribute('id', 'service-search');
    expect(input).toHaveAttribute('name', 'service_search');
    expect(screen.getByRole('button', { name: /agregar glucosa/i })).toBeInTheDocument();
    expect(document.body.textContent).toContain('L 0.00');
    expect(document.body.textContent).not.toMatch(/\bNaN\b|monto-danado|undefined/);
  });

  it('keeps normal service search free of scanner and internal code language', () => {
    renderSearch({
      scannerEnabled: false,
      search: '',
      selectedCategoryId: undefined,
      selectedAreaId: undefined,
    });

    expect(screen.getByLabelText(/buscar por nombre, area o categoria/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/scanner|codigo|código|lector/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/scanner|lector|c[oó]digo/i);
  });

  it('keeps search and filter callbacks controlled by the consumer', () => {
    const onSearchChange = vi.fn();
    const onAreaChange = vi.fn();
    const onCategoryChange = vi.fn();
    renderSearch({
      onSearchChange,
      onAreaChange,
      onCategoryChange,
      serviceAreas: [{ id: 3, name: 'Laboratorio', slug: 'laboratorio', active: true }],
      categories: [{ id: 2, name: 'Imagenes', slug: 'imagenes', active: true, sort_order: 2 }],
    });

    fireEvent.change(screen.getByLabelText(/buscar por nombre/i), { target: { value: 'hemograma' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Laboratorio' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Imagenes' }));

    expect(onSearchChange).toHaveBeenCalledWith('hemograma');
    expect(onAreaChange).toHaveBeenCalledWith(3);
    expect(onCategoryChange).toHaveBeenCalledWith(2);
  });

  it('renders loading, empty intent and no-result states without adding a service', () => {
    const onAddService = vi.fn();
    const { unmount } = renderSearch({ loading: true, onAddService });

    expect(screen.getByRole('status', { name: /cargando servicios/i })).toBeInTheDocument();

    unmount();
    const emptyRender = renderSearch({ services: [], search: '', selectedCategoryId: undefined, selectedAreaId: undefined, onAddService });
    expect(screen.getByRole('status')).toHaveTextContent(/busque o elija una categoría/i);

    emptyRender.rerender(defaultRender({ services: [], search: 'no existe', onAddService }));
    expect(screen.getByRole('status')).toHaveTextContent(/sin servicios encontrados/i);
    expect(onAddService).not.toHaveBeenCalled();
  });

  it('adds the first visible result with Enter and does not submit the parent form', () => {
    const onAddService = vi.fn();
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        {defaultRender({
          services: [serviceFixture({ id: 1, name: 'Glucosa' }), serviceFixture({ id: 2, name: 'Hemograma' })],
          search: 'g',
          onAddService,
        })}
      </form>,
    );

    fireEvent.keyDown(screen.getByLabelText(/buscar por nombre/i), { key: 'Enter', code: 'Enter' });

    expect(onAddService).toHaveBeenCalledTimes(1);
    expect(onAddService).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: 'Glucosa' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ignores a duplicated Enter while the local add is still settling', () => {
    vi.useFakeTimers();
    const onAddService = vi.fn();
    renderSearch({ services: [serviceFixture()], search: 'glu', onAddService });

    const searchbox = screen.getByRole('textbox', { name: /buscar por nombre/i });
    fireEvent.keyDown(searchbox, { key: 'Enter', code: 'Enter' });
    fireEvent.keyDown(searchbox, { key: 'Enter', code: 'Enter' });

    expect(onAddService).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(251);
    fireEvent.keyDown(searchbox, { key: 'Enter', code: 'Enter' });
    expect(onAddService).toHaveBeenCalledTimes(2);
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders operational rows with an explicit 44px add target and the EPO rule', () => {
    renderSearch({
      services: [serviceFixture({
        name: 'Eritropoyetina',
        price: '25.00',
        special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION',
      })],
      search: 'eritro',
    });

    const addButton = screen.getByRole('button', { name: 'Agregar Eritropoyetina' });
    expect(addButton).toHaveClass('min-h-11');
    expect(screen.getByText('L 25.00')).toBeInTheDocument();
    expect(screen.getByText(/gratis solo con receta de diálisis/i)).toBeInTheDocument();
  });

  it('distinguishes service loading errors from an empty result', () => {
    const { rerender } = renderSearch({ services: [], search: 'glu', error: 'No se pudo consultar el catálogo.' });

    expect(screen.getByRole('alert')).toHaveTextContent(/no se pudo consultar el catálogo/i);
    expect(screen.queryByText(/sin servicios encontrados/i)).not.toBeInTheDocument();

    rerender(defaultRender({ services: [], search: 'glu', error: undefined }));
    expect(screen.getByRole('status')).toHaveTextContent(/sin servicios encontrados/i);
  });

  it('keeps scanner value, callback and Enter behavior when scanner is enabled', () => {
    vi.useFakeTimers();
    try {
      const onScanCodeChange = vi.fn();
      const onAddByScanCode = vi.fn();
      const scannerInputRef = createRef<HTMLInputElement>();
      renderSearch({
        scannerEnabled: true,
        scanCode: 'LAB-001',
        onScanCodeChange,
        onAddByScanCode,
        scannerInputRef,
      });

      const scanner = screen.getByLabelText(/lector usb o entrada manual/i);
      expect(scanner).toHaveValue('LAB-001');

      fireEvent.change(scanner, { target: { value: 'LAB-002' } });
      fireEvent.keyDown(scanner, { key: 'Enter', code: 'Enter' });
      fireEvent.click(screen.getByRole('button', { name: /escanear/i }));

      expect(onScanCodeChange).toHaveBeenCalledWith('LAB-002');
      expect(onAddByScanCode).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(251);
      fireEvent.click(screen.getByRole('button', { name: /escanear/i }));
      expect(onAddByScanCode).toHaveBeenCalledTimes(2);
    } finally {
      vi.runOnlyPendingTimers();
      vi.useRealTimers();
    }
  });

  it('keeps scanner controls disabled while a lookup is pending', () => {
    renderSearch({
      scannerEnabled: true,
      scanningCode: true,
      scanCode: 'LAB-001',
    });

    expect(screen.getByLabelText(/lector usb o entrada manual/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /buscando/i })).toBeDisabled();
  });

  it('keeps scanner and filter controls at least 44px at every breakpoint', () => {
    renderSearch({
      scannerEnabled: true,
      serviceAreas: [{ id: 3, name: 'Laboratorio', slug: 'laboratorio', active: true }],
      categories: [{ id: 2, name: 'Imágenes', slug: 'imagenes', active: true, sort_order: 2 }],
    });

    expect(screen.getByLabelText(/lector usb o entrada manual/i)).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: /escanear/i })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: /escanear/i })).not.toHaveClass('sm:min-h-9');
    screen.getAllByRole('radio').forEach((filter) => expect(filter).toHaveClass('min-h-11'));
    expect(screen.getByRole('button', { name: 'Limpiar' })).toHaveClass('min-h-11');
    expect(screen.getByRole('button', { name: 'Limpiar' })).not.toHaveClass('sm:min-h-9');
  });

  it('supports keyboard navigation in category radio groups', async () => {
    const onCategoryChange = vi.fn();
    renderSearch({
      categories: [
        { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
        { id: 2, name: 'Imagenes', slug: 'imagenes', active: true, sort_order: 2 },
      ],
      onCategoryChange,
    });

    const categoryGroup = screen.getByRole('radiogroup', { name: /categoría/i });
    fireEvent.keyDown(categoryGroup, { key: 'ArrowRight' });

    expect(onCategoryChange).toHaveBeenCalledWith(1);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Laboratorio' })).toHaveFocus());

    fireEvent.keyDown(categoryGroup, { key: 'End' });

    expect(onCategoryChange).toHaveBeenLastCalledWith(2);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Imagenes' })).toHaveFocus());
  });

  it('does not expose hidden barcode or QR values in service results', () => {
    renderSearch({
      scannerEnabled: true,
      search: 'glu',
      services: [serviceFixture({ scan_code: 'SECRET-SCAN', barcode: 'SECRET-BAR', qr_code: 'SECRET-QR' })],
    });

    expect(screen.getByText(/disponible para lector/i)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/SECRET-SCAN|SECRET-BAR|SECRET-QR/);
  });
});

function renderSearch(overrides: Partial<ComponentProps<typeof ServiceSearch>> = {}) {
  return render(defaultRender(overrides));
}

function defaultRender(overrides: Partial<ComponentProps<typeof ServiceSearch>> = {}) {
  return (
    <ServiceSearch
      categories={[]}
      services={[]}
      selectedCategoryId="all"
      onCategoryChange={vi.fn()}
      search=""
      onSearchChange={vi.fn()}
      scanCode=""
      onScanCodeChange={vi.fn()}
      onAddService={vi.fn()}
      onAddByScanCode={vi.fn()}
      {...overrides}
    />
  );
}

function serviceFixture(overrides: Partial<Service> = {}): Service {
  return {
    id: 1,
    category_id: 1,
    area_id: 1,
    name: 'Glucosa',
    aliases: null,
    slug: 'glucosa',
    scan_code: null,
    barcode: null,
    qr_code: null,
    price: '15.00',
    taxable: true,
    active: true,
    visible_in_billing: true,
    is_billable: true,
    special_rule_code: null,
    category: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
    area: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true },
    ...overrides,
  };
}
