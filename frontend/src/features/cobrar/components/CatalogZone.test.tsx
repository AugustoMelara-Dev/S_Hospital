import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Category, Service } from '@/lib/api';
import { CatalogZone } from './CatalogZone';

function serviceFixture(overrides: Partial<Service> = {}): Service {
  return {
    id: 42,
    category_id: 3,
    name: 'Hemograma completo',
    slug: 'hemograma-completo',
    price: '100.00',
    taxable: false,
    active: true,
    special_rule_code: null,
    category: { id: 3, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
    area: null,
    ...overrides,
  };
}

const CATEGORIES: Category[] = [
  { id: 3, name: 'Laboratorio', slug: 'laboratorio', active: true, sort_order: 1 },
];

type CatalogProps = Parameters<typeof CatalogZone>[0];

function renderCatalog(props: Partial<CatalogProps> = {}) {
  const handlers = {
    onSearchChange: vi.fn(),
    onCategoryChange: vi.fn(),
    onRetry: vi.fn(),
    onAddFirst: vi.fn(),
    onAdd: vi.fn(),
  };

  render(
    <CatalogZone
      canViewCatalog
      search=""
      categoryId="all"
      categories={CATEGORIES}
      services={[]}
      loading={false}
      error={null}
      {...handlers}
      {...props}
    />,
  );

  return handlers;
}

describe('CatalogZone · elección en un solo control', () => {
  it('cada resultado es un control que agrega el servicio, no una columna de acciones', async () => {
    const user = userEvent.setup();
    const glucose = serviceFixture({ id: 11, name: 'Glucosa basal', price: '15.00', taxable: true });
    const handlers = renderCatalog({ search: 'a', services: [serviceFixture(), glucose] });

    const list = screen.getByRole('list', { name: /resultados del catálogo/i });
    const rows = within(list).getAllByRole('button');

    expect(rows).toHaveLength(2);
    expect(within(list).getByText('L. 15.00')).toBeVisible();

    await user.click(screen.getByRole('button', { name: /agregar glucosa basal/i }));

    expect(handlers.onAdd).toHaveBeenCalledWith(glucose);
    expect(handlers.onSearchChange).toHaveBeenCalledWith('');
    expect(screen.getByRole('searchbox')).toHaveFocus();
    expect(screen.queryByRole('list', { name: /resultados del catálogo/i })).not.toBeInTheDocument();
  });

  it('Enter en el buscador agrega el primer resultado (acción reversible, nunca cobra)', async () => {
    const user = userEvent.setup();
    const handlers = renderCatalog({ search: 'hemo', services: [serviceFixture()] });

    await user.click(screen.getByRole('searchbox'));
    await user.keyboard('{Enter}');

    expect(handlers.onAddFirst).toHaveBeenCalledTimes(1);
    expect(handlers.onAdd).not.toHaveBeenCalled();
    expect(handlers.onSearchChange).toHaveBeenCalledWith('');
    expect(screen.getByRole('searchbox')).toHaveFocus();
  });

  it('reserva el ancho de Agregar para que el buscador no cambie al aparecer un resultado', () => {
    const handlers = {
      onSearchChange: vi.fn(),
      onCategoryChange: vi.fn(),
      onRetry: vi.fn(),
      onAddFirst: vi.fn(),
      onAdd: vi.fn(),
    };
    const { container, rerender } = render(
      <CatalogZone
        canViewCatalog
        search=""
        categoryId="all"
        categories={CATEGORIES}
        services={[]}
        loading={false}
        error={null}
        {...handlers}
      />,
    );
    const reservedSubmit = container.querySelector<HTMLButtonElement>('[data-ui-press]');
    const searchForm = reservedSubmit?.closest('form');

    expect(searchForm).toHaveClass('[&_[data-ui-press]]:invisible');

    rerender(
      <CatalogZone
        canViewCatalog
        search="hemo"
        categoryId="all"
        categories={CATEGORIES}
        services={[serviceFixture()]}
        loading={false}
        error={null}
        {...handlers}
      />,
    );

    expect(container.querySelector('[data-ui-press]')).toBe(reservedSubmit);
    expect(searchForm).not.toHaveClass('[&_[data-ui-press]]:invisible');
    expect(screen.getByRole('button', { name: /agregar resultado: hemograma completo/i })).toBeVisible();
  });

  it('mantiene buscador y categoría en una sola barra con etiquetas visibles', () => {
    renderCatalog({ services: [serviceFixture()] });

    expect(screen.getByLabelText(/buscar servicio o producto/i)).toBeVisible();
    expect(screen.getByLabelText(/^categoría$/i)).toHaveValue('all');
  });

  it('distingue vacío inicial, sin coincidencias y error con reintento', () => {
    const { unmount } = render(
      <CatalogZone
        canViewCatalog
        search=""
        categoryId="all"
        categories={CATEGORIES}
        services={[]}
        loading={false}
        error={null}
        onSearchChange={vi.fn()}
        onCategoryChange={vi.fn()}
        onRetry={vi.fn()}
        onAddFirst={vi.fn()}
        onAdd={vi.fn()}
      />,
    );

    expect(screen.queryByRole('list', { name: /resultados del catálogo/i })).not.toBeInTheDocument();
    unmount();

    renderCatalog({ search: 'zzz', services: [] });
    expect(screen.getByText(/sin coincidencias/i)).toBeVisible();

    renderCatalog({ error: 'No se pudo cargar el catálogo desde el servidor local.' });
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeVisible();
  });

  it('sin permiso de catálogo no ofrece búsqueda ni resultados', () => {
    renderCatalog({ canViewCatalog: false });

    expect(screen.getByText(/sin permiso para consultar el catálogo/i)).toBeVisible();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('navega con flechas y Enter agrega el concepto seleccionado con teclado', async () => {
    const user = userEvent.setup();
    const glucose = serviceFixture({ id: 11, name: 'Glucosa basal', price: '15.00' });
    const handlers = renderCatalog({ search: 'item', services: [serviceFixture(), glucose] });

    await user.click(screen.getByRole('searchbox'));
    await user.keyboard('{ArrowDown}{Enter}');

    expect(handlers.onAdd).toHaveBeenCalledWith(glucose);
  });

  it('muestra accesos rápidos basados en el catálogo real y permite agregarlos', async () => {
    const user = userEvent.setup();
    const glucose = serviceFixture({ id: 11, name: 'Glucosa basal', price: '15.00' });
    const handlers = renderCatalog({ search: '', categoryId: 'all', services: [serviceFixture(), glucose] });

    const quickAccessGroup = screen.getByRole('group', { name: /^accesos rápidos$/i });
    expect(quickAccessGroup).toBeVisible();

    const quickButton = within(quickAccessGroup).getByRole('button', { name: /agregar glucosa basal desde accesos rápidos/i });
    expect(quickButton).toBeVisible();

    await user.click(quickButton);
    expect(handlers.onAdd).toHaveBeenCalledWith(glucose);
  });

  it('mantiene la lista completa cerrada hasta que el operador la solicita y no agrega un resultado invisible', async () => {
    const user = userEvent.setup();
    const handlers = renderCatalog({ services: [serviceFixture()] });

    expect(screen.queryByRole('list', { name: /resultados del catálogo/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('searchbox'));
    await user.keyboard('{Enter}');
    expect(handlers.onAddFirst).not.toHaveBeenCalled();
    expect(handlers.onAdd).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /^ver catálogo$/i }));
    expect(screen.getByRole('list', { name: /resultados del catálogo/i })).toBeVisible();
    await user.click(screen.getByRole('searchbox'));
    await user.keyboard('{Enter}');
    expect(handlers.onAddFirst).toHaveBeenCalledTimes(1);
  });

  it('permite repetir deliberadamente un acceso rápido', async () => {
    const user = userEvent.setup();
    const service = serviceFixture();
    const handlers = renderCatalog({ services: [service] });
    const quickButton = screen.getByRole('button', { name: /agregar hemograma completo desde accesos rápidos/i });

    await user.click(quickButton);
    await user.click(quickButton);

    expect(handlers.onAdd).toHaveBeenCalledTimes(2);
    expect(handlers.onAdd).toHaveBeenNthCalledWith(1, service);
    expect(handlers.onAdd).toHaveBeenNthCalledWith(2, service);
  });
});

