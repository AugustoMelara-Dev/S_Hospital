import { XIcon } from 'lucide-react';
import { AdminChip, AdminSearch, AdminToolbar } from '@/design-system/admin/components';
import { SECONDARY_BUTTON, SELECT_CLASS } from './catalogUi';
import { CATEGORY_FILTER_ALL, STATUS_FILTER_ACTIVE, STATUS_FILTER_ALL, STATUS_FILTER_INACTIVE, type CatalogToolbarProps } from './catalogTypes';

const FIELD_LABEL_CLASS =
  'text-[length:var(--ui-text-sm)] font-medium text-[color:var(--ui-ink)]';

/**
 * Barra de trabajo del catálogo: búsqueda, categoría, estado y limpieza en una
 * sola banda. El contador de filtros activos vive junto a la acción de limpiar
 * y no en un panel aparte.
 */
export function CatalogToolbar({ categories, categoryFilter, hasActiveFilters, isLoading, onActiveFilterChange, onCategoryFilterChange, onClearFilters, onSearchChange, searchInputId = 'catalog-search', searchValue, statusFilter }: CatalogToolbarProps) {
  return (
    <section aria-labelledby="catalog-filters-title" className="border-b border-[var(--ui-line)]">
      <h2 id="catalog-filters-title" className="sr-only">Filtros del catálogo</h2>
      <AdminToolbar className="items-end gap-2 p-3">
        <AdminSearch
          id={searchInputId}
          label="Buscar producto o servicio"
          value={searchValue}
          onValueChange={onSearchChange}
          placeholder="Buscar por nombre, categoría o área…"
          className="min-w-[15rem] flex-1"
        />
        <div className="flex min-w-44 flex-col gap-1.5">
          <label htmlFor="catalog-category" className={FIELD_LABEL_CLASS}>Categoría</label>
          <select
            id="catalog-category"
            name="catalog_category"
            className={SELECT_CLASS}
            value={categoryFilter}
            onChange={(event) => onCategoryFilterChange(event.target.value)}
            disabled={isLoading}
          >
            <option value={CATEGORY_FILTER_ALL}>Todas las categorías</option>
            {categories.map((category) => <option key={category.id} value={String(category.id)}>{category.name}{category.active ? '' : ' · Inactiva'}</option>)}
          </select>
        </div>
        <div className="flex min-w-36 flex-col gap-1.5">
          <label htmlFor="catalog-active" className={FIELD_LABEL_CLASS}>Estado</label>
          <select
            id="catalog-active"
            name="catalog_status"
            className={SELECT_CLASS}
            value={statusFilter}
            onChange={(event) => onActiveFilterChange(event.target.value)}
            disabled={isLoading}
          >
            <option value={STATUS_FILTER_ALL}>Todos</option>
            <option value={STATUS_FILTER_ACTIVE}>Activos</option>
            <option value={STATUS_FILTER_INACTIVE}>Inactivos</option>
          </select>
        </div>
        {hasActiveFilters ? <AdminChip tone="accent">Filtros activos</AdminChip> : null}
        <button
          type="button"
          data-ui-press
          className={`${SECONDARY_BUTTON} shrink-0`}
          onClick={onClearFilters}
          disabled={isLoading || !hasActiveFilters}
          aria-label="Limpiar filtros de catálogo"
        >
          <XIcon aria-hidden="true" className="size-4" strokeWidth={1.5} />
          Limpiar
        </button>
      </AdminToolbar>
    </section>
  );
}
