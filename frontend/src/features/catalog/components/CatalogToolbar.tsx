import { ClearOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Input, Select } from 'antd';
import { CATEGORY_FILTER_ALL, STATUS_FILTER_ACTIVE, STATUS_FILTER_ALL, STATUS_FILTER_INACTIVE, type CatalogToolbarProps } from './catalogTypes';

export function CatalogToolbar({ categories, categoryFilter, hasActiveFilters, isLoading, onActiveFilterChange, onCategoryFilterChange, onClearFilters, onSearchChange, searchInputId = 'catalog-search', searchValue, statusFilter }: CatalogToolbarProps) {
  return (
    <section className="border border-border p-3" aria-labelledby="catalog-filters-title">
      <h2 id="catalog-filters-title" className="mb-3 text-sm font-semibold">Filtros del catálogo</h2>
      <div className="catalog-toolbar-grid grid gap-3 lg:items-end">
        <div className="grid gap-1">
          <label className="text-xs font-medium" htmlFor={searchInputId}>Buscar servicio</label>
          <Input id={searchInputId} name="catalog_search" placeholder="Buscar por nombre, categoria o area..." value={searchValue} onChange={(event) => onSearchChange(event.target.value)} prefix={<SearchOutlined aria-hidden />} allowClear />
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium" htmlFor="catalog-category">Categoría</label>
          <Select className="w-full" id="catalog-category" value={categoryFilter} onChange={onCategoryFilterChange} options={[{ value: CATEGORY_FILTER_ALL, label: 'Todas las categorías' }, ...categories.map((category) => ({ value: String(category.id), label: category.name }))]} />
        </div>
        <div className="grid gap-1">
          <label className="text-xs font-medium" htmlFor="catalog-active">Estado</label>
          <Select className="w-full" id="catalog-active" value={statusFilter} onChange={onActiveFilterChange} options={[{ value: STATUS_FILTER_ALL, label: 'Todos' }, { value: STATUS_FILTER_ACTIVE, label: 'Activos' }, { value: STATUS_FILTER_INACTIVE, label: 'Inactivos' }]} />
        </div>
        <Button htmlType="button" onClick={onClearFilters} disabled={isLoading || !hasActiveFilters} icon={<ClearOutlined aria-hidden />} aria-label="Limpiar filtros de catálogo">Limpiar</Button>
      </div>
    </section>
  );
}
