import { ClearOutlined, SearchOutlined } from '@ant-design/icons';
import { Button, Input, Select, Space, Typography } from 'antd';
import { CATEGORY_FILTER_ALL, STATUS_FILTER_ACTIVE, STATUS_FILTER_ALL, STATUS_FILTER_INACTIVE, type CatalogToolbarProps } from './catalogTypes';

export function CatalogToolbar({ categories, categoryFilter, hasActiveFilters, isLoading, onActiveFilterChange, onCategoryFilterChange, onClearFilters, onSearchChange, searchInputId = 'catalog-search', searchValue, statusFilter }: CatalogToolbarProps) {
  return (
    <section className="border border-slate-300 p-4" aria-labelledby="catalog-filters-title">
      <Typography.Title id="catalog-filters-title" level={4}>Explorar catálogo</Typography.Title>
      <Typography.Paragraph>Busque por nombre y refine por categoría o disponibilidad.</Typography.Paragraph>
      <Space wrap align="end">
        <label htmlFor={searchInputId}>Buscar servicio</label>
        <Input id={searchInputId} name="catalog_search" placeholder="Buscar por nombre, categoria o area..." value={searchValue} onChange={(event) => onSearchChange(event.target.value)} prefix={<SearchOutlined aria-hidden />} allowClear />
        <label htmlFor="catalog-category">Categoría</label>
        <Select id="catalog-category" value={categoryFilter} onChange={onCategoryFilterChange} options={[{ value: CATEGORY_FILTER_ALL, label: 'Todas las categorías' }, ...categories.map((category) => ({ value: String(category.id), label: category.name }))]} />
        <label htmlFor="catalog-active">Estado</label>
        <Select id="catalog-active" value={statusFilter} onChange={onActiveFilterChange} options={[{ value: STATUS_FILTER_ALL, label: 'Todos' }, { value: STATUS_FILTER_ACTIVE, label: 'Activos' }, { value: STATUS_FILTER_INACTIVE, label: 'Inactivos' }]} />
        <Button htmlType="button" onClick={onClearFilters} disabled={isLoading || !hasActiveFilters} icon={<ClearOutlined aria-hidden />} aria-label="Limpiar filtros de catálogo">Limpiar</Button>
      </Space>
    </section>
  );
}
