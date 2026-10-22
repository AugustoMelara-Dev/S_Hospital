import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Service } from '@/lib/api';

const mediaState = vi.hoisted(() => ({ isMobile: false }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: () => mediaState.isMobile }));

import { ServiceCatalogTable } from './ServiceCatalogTable';

describe('ServiceCatalogTable', () => {
  beforeEach(() => { mediaState.isMobile = false; });

  it('renders institutional loading, empty and error actions', () => {
    const clear = vi.fn(); const retry = vi.fn();
    const { rerender } = render(<ServiceCatalogTable {...baseProps()} isLoading />);
    expect(screen.getByRole('status')).toHaveTextContent(/cargando productos y servicios/i);
    rerender(<ServiceCatalogTable {...baseProps()} isEmpty hasActiveFilters onClearFilters={clear} />);
    fireEvent.click(screen.getByRole('button', { name: /limpiar filtros/i }));
    rerender(<ServiceCatalogTable {...baseProps()} loadError="Servidor no disponible" onRetry={retry} />);
    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(clear).toHaveBeenCalledOnce(); expect(retry).toHaveBeenCalledOnce();
  });

  it('renders prioritized operational columns without internal scanner codes', () => {
    render(<ServiceCatalogTable {...baseProps()} services={[serviceFixture({ scan_code: 'LAB-1', barcode: '123', qr_code: 'QR-1' })]} />);
    ['Producto o servicio', 'Categoría', 'Área', 'Precio', 'Estado', 'Acciones'].forEach((name) => expect(screen.getByRole('columnheader', { name })).toBeInTheDocument());
    expect(screen.queryByText(/LAB-1|123|QR-1/i)).not.toBeInTheDocument();
  });

  it('does not expose long internal codes in the operational table', () => {
    const longCode = 'CODIGO-OPERATIVO-EXCEPCIONALMENTE-LARGO-SIN-ESPACIOS-123456789';
    render(<ServiceCatalogTable {...baseProps()} services={[serviceFixture({ scan_code: longCode })]} />);

    expect(screen.queryByText(new RegExp(longCode))).not.toBeInTheDocument();
  });

  it('uses a mobile list that distinguishes same-name services by category and area without codes', () => {
    mediaState.isMobile = true;
    render(<ServiceCatalogTable {...baseProps()} services={[
      serviceFixture({ id: 1, name: 'Consulta', scan_code: 'CON-EXT' }),
      serviceFixture({
        id: 2,
        name: 'Consulta',
        scan_code: 'CON-EME',
        category: { id: 2, name: 'Emergencia', slug: 'emergencia', active: true, sort_order: 2 },
        area: { id: 2, name: 'Urgencias', slug: 'urgencias', active: true },
      }),
    ]} />);

    const mobileList = screen.getByRole('list', { name: /productos y servicios del catálogo en móvil/i });
    const items = within(mobileList).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/Consulta.*Laboratorio/i);
    expect(items[1]).toHaveTextContent(/Consulta.*Emergencia.*Urgencias/i);
    expect(mobileList).not.toHaveTextContent(/CON-EXT|CON-EME/);
  });

  it('renders billing summaries and HNL prices through column renderers', () => {
    render(<ServiceCatalogTable {...baseProps()} services={[serviceFixture({ name: 'Eritropoyetina', price: '25.00', special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' })]} />);
    expect(screen.getByText('Eritropoyetina')).toBeInTheDocument();
    // El precio del catálogo se pinta como dinero. La nota operativa de la regla
    // EPO cita la misma tarifa vigente (no una hardcodeada), así que el valor
    // puede aparecer más de una vez en la fila.
    const prices = screen.getAllByText('L. 25.00');
    expect(prices.length).toBeGreaterThanOrEqual(1);
    expect(prices[0]).toHaveAttribute('data-ui-money', 'true');
    expect(screen.getAllByText(/receta/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /acciones de servicio eritropoyetina/i })).toBeInTheDocument();
  });

  it('keeps the actions column declared and pinned so it cannot scroll out of view', () => {
    render(<ServiceCatalogTable {...baseProps()} services={[serviceFixture({ name: 'Eritropoyetina' })]} />);

    const actionsHeader = screen.getByRole('columnheader', { name: /acciones/i });

    expect(actionsHeader.className).toMatch(/sticky/);
    expect(actionsHeader.className).toMatch(/right-0/);
    // La celda fijada pinta su propio fondo: sin él, el contenido pasaría por
    // debajo al desplazar la tabla.
    expect(actionsHeader.className).toMatch(/bg-\[var\(--ui-surface-alt\)\]/);
  });

  it('keeps history available without exposing edit or status actions to read-only users', async () => {
    const user = userEvent.setup();
    render(<ServiceCatalogTable {...baseProps()} canManage={false} onRowActions={{ ...baseProps().onRowActions, canManage: false }} services={[serviceFixture()]} />);

    await user.click(screen.getByRole('button', { name: /acciones de servicio/i }));
    expect(screen.getByRole('menuitem', { name: /ver historial/i })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /^editar$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /activar|desactivar/i })).not.toBeInTheDocument();
  });

  it('describes the erythropoietin rule with the tariff from the catalog, never with a hardcoded amount', () => {
    render(<ServiceCatalogTable {...baseProps()} services={[serviceFixture({ name: 'Eritropoyetina', price: '30.00', special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' })]} />);

    const note = screen.getByText(/tarifa vigente del catálogo/i);

    expect(note).toHaveTextContent(/sin cobro con receta de diálisis/i);
    expect(note).toHaveTextContent(/L\. 30\.00/);
    expect(note).not.toHaveTextContent(/L\. 25\.00/);
  });

  it('does not publish a tariff for the erythropoietin rule when the catalog has no configured price', () => {
    render(<ServiceCatalogTable {...baseProps()} services={[serviceFixture({ name: 'Eritropoyetina', price: '0.00', special_rule_code: 'ERYTHROPOIETIN_DIALYSIS_PRESCRIPTION' })]} />);

    const note = screen.getByText(/tarifa vigente del catálogo/i);

    expect(note).toHaveTextContent(/sin cobro con receta de diálisis/i);
    expect(note).not.toHaveTextContent(/\d/);
  });
});

function baseProps() { return { areas: [], canManage: true, categories: [], hasActiveFilters: false, isEmpty: false, isLoading: false, loadError: '', onClearFilters: vi.fn(), onRetry: vi.fn(), onRowActions: { canManage: true, onEdit: vi.fn(), onHistory: vi.fn(), onToggleActive: vi.fn() }, services: [serviceFixture()] }; }
function serviceFixture(overrides: Partial<Service> = {}): Service { return { id: 1, category_id: 1, area_id: 1, name: 'Glucosa', aliases: null, slug: 'glucosa', scan_code: null, barcode: null, qr_code: null, price: '15.00', taxable: true, active: true, visible_in_billing: true, is_billable: true, special_rule_code: null, category: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 }, area: { id: 1, name: 'Laboratorio', slug: 'laboratorio', active: true }, ...overrides }; }
